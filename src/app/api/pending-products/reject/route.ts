import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rejectPendingProduct } from '@/lib/product-queries';
import { requireAdmin } from '@/lib/permissions';

/**
 * POST /api/pending-products/reject
 * Reject pending product
 * Admin only
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Require admin access
    await requireAdmin(userId);

    const body = await req.json();
    const { pending_product_id, review_notes } = body;

    // Input validation
    if (!pending_product_id) {
      return NextResponse.json({ error: 'pending_product_id is required' }, { status: 400 });
    }

    await rejectPendingProduct(
      pending_product_id,
      userId,
      review_notes
    );

    return NextResponse.json({ message: 'Product rejected successfully' }, { status: 200 });
  } catch (err) {
    console.error('POST /api/pending-products/reject', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to reject pending product' }, { status: 500 });
  }
}