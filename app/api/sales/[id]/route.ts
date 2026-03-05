import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';
import mongoose from 'mongoose';

// PUT - Update a sale
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User not found' },
        { status: 401 }
      );
    }
    
    // Find the sale and verify it belongs to the user and is not deleted
    const sale = await Sale.findOne({ 
      _id: id,
      userId: user.id,
      deletedAt: null,
    });
    
    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found or you do not have permission to edit it' },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { saleDate, items, discount = 0, paymentMethod, customerName, customerContact, notes } = body;
    
    // Validate date is not in the future
    const saleDateObj = saleDate ? new Date(saleDate) : sale.saleDate;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (saleDateObj > today) {
      return NextResponse.json(
        { success: false, error: 'Sale date cannot be in the future' },
        { status: 400 }
      );
    }
    
    // Calculate new subtotal and total
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const total = subtotal - (discount || 0);
    
    // Restore original inventory quantities first
    for (const oldItem of sale.items) {
      const inventoryItem = await Inventory.findOne({
        _id: oldItem.inventoryId,
        userId: user.id,
      });
      
      if (inventoryItem) {
        inventoryItem.quantity += oldItem.quantity;
        await inventoryItem.save();
      }
    }
    
    // Validate and update inventory quantities with new quantities
    for (const item of items) {
      // Ensure size is included
      if (!item.size) {
        const inventoryItem = await Inventory.findOne({ 
          _id: item.inventoryId, 
          userId: user.id 
        }).lean();
        if (inventoryItem) {
          item.size = inventoryItem.size || '';
        }
      }
      
      const inventoryItem = await Inventory.findOne({ 
        _id: item.inventoryId, 
        userId: user.id 
      });
      
      if (!inventoryItem) {
        // Restore all items if validation fails
        for (const oldItem of sale.items) {
          const invItem = await Inventory.findOne({
            _id: oldItem.inventoryId,
            userId: user.id,
          });
          if (invItem) {
            invItem.quantity -= oldItem.quantity;
            await invItem.save();
          }
        }
        return NextResponse.json(
          { success: false, error: `Inventory item ${item.name} not found or not accessible` },
          { status: 404 }
        );
      }
      
      if (inventoryItem.quantity < item.quantity) {
        // Restore all items if validation fails
        for (const oldItem of sale.items) {
          const invItem = await Inventory.findOne({
            _id: oldItem.inventoryId,
            userId: user.id,
          });
          if (invItem) {
            invItem.quantity -= oldItem.quantity;
            await invItem.save();
          }
        }
        return NextResponse.json(
          { success: false, error: `Insufficient stock for ${item.name}` },
          { status: 400 }
        );
      }
      
      inventoryItem.quantity -= item.quantity;
      await inventoryItem.save();
    }
    
    // Update the sale
    sale.saleDate = saleDateObj;
    sale.items = items;
    sale.subtotal = subtotal;
    sale.discount = discount;
    sale.total = total;
    sale.paymentMethod = paymentMethod;
    sale.customerName = customerName || undefined;
    sale.customerContact = customerContact || undefined;
    sale.notes = notes || undefined;
    
    await sale.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Sale updated successfully',
      data: sale 
    });
  } catch (error: any) {
    console.error('PUT /api/sales/[id] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update sale' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a sale (set deletedAt)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User not found' },
        { status: 401 }
      );
    }
    
    // Find the sale and verify it belongs to the user and is not already deleted
    // First, find the sale by ID and userId
    const sale = await Sale.findOne({ 
      _id: id,
      userId: user.id,
    });
    
    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }
    
    // Check if already deleted
    if (sale.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Sale is already deleted' },
        { status: 400 }
      );
    }
    
    console.log('Found sale to delete:', { 
      id: sale._id, 
      userId: sale.userId, 
      deletedAt: sale.deletedAt 
    });
    
    // Restore inventory quantities since we're undoing the sale
    for (const item of sale.items) {
      const inventoryItem = await Inventory.findOne({
        _id: item.inventoryId,
        userId: user.id,
      });
      
      if (inventoryItem) {
        inventoryItem.quantity += item.quantity;
        await inventoryItem.save();
      }
    }
    
    // Soft delete: set deletedAt to current date
    // Use native MongoDB update to ensure the field is saved
    const deletedAtDate = new Date();
    
    console.log('Attempting to update sale with deletedAt:', {
      id: id,
      userId: user.id,
      deletedAtDate: deletedAtDate.toISOString(),
    });
    
    // Convert to ObjectId for the query
    const saleObjectId = new mongoose.Types.ObjectId(id);
    const userObjectId = new mongoose.Types.ObjectId(user.id);
    
    // Use updateOne directly - this bypasses Mongoose document tracking
    const updateResult = await Sale.updateOne(
      { _id: saleObjectId, userId: userObjectId },
      { $set: { deletedAt: deletedAtDate } },
      { upsert: false }
    );
    
    console.log('Update result:', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      acknowledged: updateResult.acknowledged,
    });
    
    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Sale not found or update failed' },
        { status: 404 }
      );
    }
    
    if (updateResult.modifiedCount === 0) {
      console.warn('Update matched but did not modify - sale might already have deletedAt set');
    }
    
    // Reload from database using native query to verify it was saved
    const updatedSale = await Sale.findOne({ _id: saleObjectId }).lean();
    
    console.log('Sale after update (from DB):', {
      id: updatedSale?._id?.toString(),
      deletedAt: updatedSale?.deletedAt,
      deletedAtType: typeof updatedSale?.deletedAt,
      deletedAtISO: updatedSale?.deletedAt ? new Date(updatedSale.deletedAt).toISOString() : undefined,
      rawDeletedAt: updatedSale?.deletedAt,
      allFields: Object.keys(updatedSale || {}),
    });
    
    if (!updatedSale) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify updated sale' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Sale deleted successfully',
      data: { 
        id: updatedSale._id.toString(), 
        deletedAt: updatedSale.deletedAt ? new Date(updatedSale.deletedAt).toISOString() : null
      } 
    });
  } catch (error: any) {
    console.error('DELETE /api/sales/[id] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete sale' },
      { status: 500 }
    );
  }
}

