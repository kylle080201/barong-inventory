import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';
import { recordSale } from '@/lib/services/sales';
import { errorResponse, unauthorized } from '@/lib/services/http';

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
    const user = (request as any).user;
    if (!user || !user.id) return unauthorized();

    const body = await request.json();
    const sale = await recordSale(user.id, body);

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, 'POST /api/sales', 'Failed to record sale');
  }
}
