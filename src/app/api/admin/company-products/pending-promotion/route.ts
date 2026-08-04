/**
 * GET /api/admin/company-products/pending-promotion
 *
 * Get all company products awaiting admin promotion to global catalog with RLS context management
 *
 * Authentication: Required session with RLS context
 * Authorization: Superadmin role required for cross-company access
 * RLS: Establishes superadmin context for reading pending products from all companies
 *
 * Returns: JSON with products array and total count
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/api-middleware';
import { getPendingPromotionProducts } from '@/lib/company-product-queries';

/**
 * Get pending promotion products with RLS middleware
 * Uses requireSuperadmin to establish proper RLS context for cross-company read access
 */
export async function GET(req: NextRequest) {
  try {
    // Establish RLS context with superadmin role for promotion workflow
    // This ensures:
    // 1. Proper authentication and authorization
    // 2. RLS tenant context set for superadmin cross-company access
    // 3. Automatic context cleanup after operation
    const session = await requireSuperadmin();

    // Get all pending promotion products
    // This query now runs with proper superadmin RLS context
    // allowing read access to company_product_definitions from all companies
    const products = await getPendingPromotionProducts();

    // Return response with products and total count
    return NextResponse.json({
      products,
      total: products.length
    });

  } catch (error) {
    console.error('Error fetching pending promotion products:', error);

    // Handle authorization errors specifically
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required for promotion workflow' },
        { status: 403 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}