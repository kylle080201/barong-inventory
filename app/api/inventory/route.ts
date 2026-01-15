import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';

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
    
    // Remove category and color if they exist (shouldn't be sent, but just in case)
    const { category, color, ...cleanBody } = body;
    
    // Validate required fields
    if (!cleanBody.name || !cleanBody.size || cleanBody.price === undefined || cleanBody.cost === undefined || cleanBody.quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, size, price, cost, quantity' },
        { status: 400 }
      );
    }
    
    // Validate size is in the enum
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    if (!validSizes.includes(cleanBody.size)) {
      return NextResponse.json(
        { success: false, error: `Size must be one of: ${validSizes.join(', ')}` },
        { status: 400 }
      );
    }
    
    const item = await Inventory.create({
      ...cleanBody,
      userId: user.id,
    });
    
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/inventory error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: messages },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create inventory item' },
      { status: 400 }
    );
  }
}

