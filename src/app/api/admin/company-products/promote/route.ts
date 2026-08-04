/**
 * POST /api/admin/company-products/promote
 *
 * Promote a company product to global catalog with RLS context management
 *
 * Authentication: Required session with RLS context
 * Authorization: Superadmin role required for cross-company access
 * RLS: Establishes superadmin context for promotion workflow
 *
 * Request body: { company_product_id: string, review_notes: string }
 * Returns: JSON with success message and promotion result
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/api-middleware';
import { promoteCompanyProduct } from '@/lib/company-product-queries';

/**
 * Promote company product to global catalog with RLS middleware
 * Uses requireSuperadmin to establish proper RLS context for cross-company access
 */
export async function POST(req: NextRequest) {
  try {
    // Establish RLS context with superadmin role for promotion workflow
    // This ensures:
    // 1. Proper authentication and authorization
    // 2. RLS tenant context set for superadmin cross-company access
    // 3. Automatic context cleanup after operation
    const session = await requireSuperadmin();

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
    // This operation now runs with proper superadmin RLS context
    // allowing cross-company access for the promotion workflow
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
        { error: 'Forbidden: Superadmin access required for product promotion' },
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