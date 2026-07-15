import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rejectPendingProduct } from '@/lib/product-queries';
import { rejectCompanyProduct } from '@/lib/company-product-queries';
import { requireAdmin } from '@/lib/permissions';

/**
 * POST /api/pending-products/reject
 * Reject pending product
 * Admin only
 * Now handles both pending_products and company_product_definitions tables
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

    // Check if product is from pending_products table
    const pendingProduct = await import('@/lib/db').then(async ({ sql }) => {
      const result = await sql`
        SELECT id FROM pending_products
        WHERE id = ${pending_product_id}::uuid AND status = 'pending'
      `;
      return result[0];
    });

    if (pendingProduct) {
      // Handle pending_products table rejection
      await rejectPendingProduct(
        pending_product_id,
        userId,
        review_notes
      );

      return NextResponse.json({ message: 'Product rejected successfully' }, { status: 200 });
    }

    // Check if product is from company_product_definitions table
    const companyProduct = await import('@/lib/db').then(async ({ sql }) => {
      const result = await sql`
        SELECT id FROM company_product_definitions
        WHERE id = ${pending_product_id}::uuid AND is_approved_for_global = false
      `;
      return result[0];
    });

    if (companyProduct) {
      // Handle company_product_definitions table rejection
      await rejectCompanyProduct(
        pending_product_id,
        userId,
        review_notes
      );

      return NextResponse.json({ message: 'Company product rejected successfully' }, { status: 200 });
    }

    // Product not found in either table
    return NextResponse.json({ error: 'Pending product not found or already processed' }, { status: 404 });

  } catch (err) {
    console.error('POST /api/pending-products/reject', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to reject pending product' }, { status: 500 });
  }
}