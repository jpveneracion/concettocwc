import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { promoteCompanyProduct } from '@/lib/company-product-queries';

/**
 * POST /api/admin/company-products/promote
 *
 * Promote a company product to global catalog
 *
 * Authentication: Required session
 * Authorization: Admin or superadmin role required
 *
 * Request body: { company_product_id: string, review_notes: string }
 * Returns: JSON with success message and promotion result
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check authorization - must be admin or superadmin
    await requireAdmin(session.userId);

    // Parse request body
    const body = await req.json();
    const { company_product_id, review_notes } = body;

    // Validate required fields
    if (!company_product_id) {
      return NextResponse.json(
        { error: 'company_product_id is required' },
        { status: 400 }
      );
    }

    if (!review_notes || typeof review_notes !== 'string' || review_notes.trim().length === 0) {
      return NextResponse.json(
        { error: 'review_notes are required' },
        { status: 400 }
      );
    }

    // Promote the company product to global catalog
    const result = await promoteCompanyProduct(company_product_id, session.userId);

    // Return success response
    return NextResponse.json({
      message: 'Product promoted to global catalog successfully',
      result
    });

  } catch (error) {
    console.error('Error promoting company product:', error);

    // Handle authorization errors specifically
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Handle not found errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Company product not found or already promoted' },
        { status: 404 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Failed to promote product' },
      { status: 500 }
    );
  }
}