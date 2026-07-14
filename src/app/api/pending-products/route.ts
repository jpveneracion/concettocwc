import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getPendingProducts,
  productCodeExists,
  createPendingProduct
} from '@/lib/product-queries';
import type { ProductStatus, UserRole } from '@/types/product';

// Database query result interface
interface UserRoleResult {
  role: string;
}

/**
 * GET /api/pending-products
 * List pending products with role-based filtering
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const companyId = session.companyId;

    // Get user role from database
    const userResult = await import('@/lib/db').then(({ sql }) =>
      sql`SELECT role FROM users WHERE id = ${userId}::uuid`
    );
    const userRole = ((userResult[0] as UserRoleResult)?.role || 'user') as UserRole;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    // Validate status against enum values
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    const status = statusParam && validStatuses.includes(statusParam.toUpperCase())
      ? (statusParam.toUpperCase() as ProductStatus)
      : undefined;

    const products = await getPendingProducts(companyId, userRole, status);

    return NextResponse.json({
      products,
      total: products.length,
      page: 1,
      limit: 50
    });
  } catch (err) {
    console.error('GET /api/pending-products', err);
    return NextResponse.json({ error: 'Failed to fetch pending products' }, { status: 500 });
  }
}

/**
 * POST /api/pending-products
 * Create pending product for admin review
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, collection, description, unit } = body;

    // Input validation
    if (!code || !description) {
      return NextResponse.json({ error: 'code and description are required' }, { status: 400 });
    }

    // Basic input sanitization
    const sanitizedCode = code.trim().toUpperCase();
    const sanitizedDescription = description.trim();
    const sanitizedCollection = collection?.trim();

    if (sanitizedCode.length === 0 || sanitizedDescription.length === 0) {
      return NextResponse.json({ error: 'code and description cannot be empty' }, { status: 400 });
    }

    if (sanitizedCode.length > 50) {
      return NextResponse.json({ error: 'code cannot exceed 50 characters' }, { status: 400 });
    }

    if (sanitizedDescription.length > 1000) {
      return NextResponse.json({ error: 'description cannot exceed 1000 characters' }, { status: 400 });
    }

    const userId = session.userId;
    const companyId = session.companyId;

    // Check if product code exists globally (in products or pending_products)
    const codeExists = await productCodeExists(sanitizedCode);
    if (codeExists) {
      return NextResponse.json({ error: 'Product code already exists' }, { status: 409 });
    }

    const product = await createPendingProduct(
      { code: sanitizedCode, collection: sanitizedCollection, description: sanitizedDescription, unit },
      companyId,
      userId
    );

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('POST /api/pending-products', err);
    return NextResponse.json({ error: 'Failed to create pending product' }, { status: 500 });
  }
}