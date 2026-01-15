import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';

// GET - Fetch single inventory item
export async function GET(
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
    
    const item = await Inventory.findOne({ _id: id, userId: user.id }).lean();
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    // Remove category and color if they exist
    const { category, color, ...cleanItem } = item as any;
    
    return NextResponse.json({ success: true, data: cleanItem });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update inventory item
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
    
    const body = await request.json();
    
    // Remove category and color from update body if they exist
    const { category: _category, color: _color, ...cleanBody } = body;
    
    // Ensure userId cannot be changed
    delete cleanBody.userId;
    
    const item = await Inventory.findOneAndUpdate(
      { _id: id, userId: user.id },
      cleanBody,
      {
        new: true,
        runValidators: true,
      }
    ).lean();
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    // Remove category and color if they exist
    const { category: _category2, color: _color2, ...cleanItem } = item as any;
    
    return NextResponse.json({ success: true, data: cleanItem });
  } catch (error: any) {
    console.error('PUT /api/inventory/[id] error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: messages },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

// DELETE - Delete inventory item
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
    
    const item = await Inventory.findOneAndDelete({ _id: id, userId: user.id });
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

