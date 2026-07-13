import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approvePendingProduct, findDuplicateProducts } from '@/lib/product-queries';
import { requireAdmin } from '@/lib/permissions';

/**
 * POST /api/pending-products/approve
 * Approve pending product and move to main products table
 * Admin only: Removes ALL pending products with the same code (duplicate handling)
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

    // Check for duplicates before approving
    const pendingProduct = await import('@/lib/db').then(async ({ sql }) => {
      const result = await sql`
        SELECT code, description FROM pending_products
        WHERE id = ${pending_product_id}::uuid AND status = 'pending'
      `;
      return result[0];
    });

    if (!pendingProduct) {
      return NextResponse.json({ error: 'Pending product not found or already processed' }, { status: 404 });
    }

    // Find duplicates with same code
    const duplicates = await findDuplicateProducts(pendingProduct.code);

    // Approve the product (this will also remove duplicates)
    const approvedProduct = await approvePendingProduct(
      pending_product_id,
      userId,
      review_notes
    );

    // Return response with information about duplicates removed
    const response: any = {
      product: approvedProduct,
      message: 'Product approved successfully'
    };

    if (duplicates.length > 1) {
      response.duplicates_removed = duplicates.length - 1;
      response.message = `Product approved. ${duplicates.length - 1} duplicate(s) with same code removed.`;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('POST /api/pending-products/approve', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to approve pending product' }, { status: 500 });
  }
}