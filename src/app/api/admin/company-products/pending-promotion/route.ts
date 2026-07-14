// src/app/api/admin/company-products/pending-promotion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPendingPromotionProducts } from '@/lib/company-product-queries';

/**
 * GET /api/admin/company-products/pending-promotion
 *
 * Get all company products awaiting admin promotion to global catalog
 *
 * Authentication: Required session
 * Authorization: Admin or superadmin role required
 *
 * Returns: JSON with products array and total count
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check authorization - must be admin or superadmin
    await requireAdmin(session.userId);

    // Get all pending promotion products
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
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}