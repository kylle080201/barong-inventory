import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';

// GET - Fetch all sales with optional date filtering
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    await connectDB();
    
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User not found' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let query: any = { 
      userId: user.id,
      deletedAt: null, // Only get non-deleted sales
    };
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) {
        query.saleDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.saleDate.$lte = new Date(endDate);
      }
    }
    
    const sales = await Sale.find(query).sort({ saleDate: -1 }).lean();
    
    // Populate size from inventory if missing (for backward compatibility)
    const salesWithSize = await Promise.all(
      sales.map(async (sale: any) => {
        const itemsWithSize = await Promise.all(
          sale.items.map(async (item: any) => {
            if (!item.size) {
              const inventoryItem = await Inventory.findById(item.inventoryId).lean();
              if (inventoryItem) {
                item.size = inventoryItem.size || '';
              }
            }
            return item;
          })
        );
        return {
          ...sale,
          items: itemsWithSize,
        };
      })
    );
    
    return NextResponse.json({ success: true, data: salesWithSize });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new sale
export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    await connectDB();
    
    const user = (request as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User not found' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { items, discount = 0, paymentMethod, customerName, customerContact, notes } = body;
    
    // Calculate subtotal and total
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const total = subtotal - (discount || 0);
    
    // Validate and update inventory quantities (only user's inventory)
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
        return NextResponse.json(
          { success: false, error: `Inventory item ${item.name} not found or not accessible` },
          { status: 404 }
        );
      }
      if (inventoryItem.quantity < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for ${item.name}` },
          { status: 400 }
        );
      }
      inventoryItem.quantity -= item.quantity;
      await inventoryItem.save();
    }
    
    const sale = await Sale.create({
      saleDate: new Date(),
      items,
      subtotal,
      discount,
      total,
      paymentMethod,
      customerName,
      customerContact,
      notes,
      userId: user.id,
    });
    
    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

