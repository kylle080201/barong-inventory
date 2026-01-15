import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';
import mongoose from 'mongoose';

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

