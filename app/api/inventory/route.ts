import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';
import { createInventoryItem } from '@/lib/services/inventory';
import { errorResponse } from '@/lib/services/http';

// GET - Fetch all inventory items
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
    const search = searchParams.get('search');
    
    let query: any = { userId: user.id };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Use lean() to skip Mongoose validation on existing documents
    const items = await Inventory.find(query).sort({ createdAt: -1 }).lean();
    
    // Clean up any category/color fields from existing documents
    const cleanedItems = items.map((item: any) => {
      const { category, color, ...rest } = item;
      return rest;
    });
    
    return NextResponse.json({ success: true, data: cleanedItems });
  } catch (error: any) {
    console.error('GET /api/inventory error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

// POST - Create new inventory item
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
    const item = await createInventoryItem(user.id, body);

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, 'POST /api/inventory', 'Failed to create inventory item');
  }
}

