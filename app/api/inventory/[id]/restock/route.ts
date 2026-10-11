import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount < 1) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a whole number greater than 0' },
        { status: 400 }
      );
    }

    const item = await Inventory.findOneAndUpdate(
      { _id: id, userId: user.id },
      { $inc: { quantity: amount } },
      { new: true }
    ).lean();

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const { category: _category, color: _color, ...cleanItem } = item as any;

    return NextResponse.json({ success: true, data: cleanItem });
  } catch (error: any) {
    console.error('POST /api/inventory/[id]/restock error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to restock product' },
      { status: 500 }
    );
  }
}
