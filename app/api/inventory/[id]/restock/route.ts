import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { restockInventoryItem } from '@/lib/services/inventory';
import { errorResponse, unauthorized } from '@/lib/services/http';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const user = (request as any).user;
    if (!user || !user.id) return unauthorized();

    const body = await request.json();
    const item = await restockInventoryItem(user.id, id, Number(body.amount));

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    return errorResponse(error, 'POST /api/inventory/[id]/restock', 'Failed to restock product');
  }
}
