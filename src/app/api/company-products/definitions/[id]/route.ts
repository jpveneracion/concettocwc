import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getCompanyProductById,
  updateCompanyProduct,
  deleteCompanyProduct
} from '@/lib/company-product-queries';
import type { UpdateCompanyProductRequest } from '@/types/company-product';

/**
 * GET /api/company-products/definitions/[id]
 * Get single company product details
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await getCompanyProductById(params.id, session.companyId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/company-products/definitions/[id]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

/**
 * PUT /api/company-products/definitions/[id]
 * Update company product
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { collection, description, unit } = body;

    // Build updates object with only provided fields
    const updates: UpdateCompanyProductRequest = {};
    if (collection !== undefined) updates.collection = collection;
    if (description !== undefined) updates.description = description;
    if (unit !== undefined) updates.unit = unit;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Validate updates if provided
    if (updates.description && updates.description.trim().length === 0) {
      return NextResponse.json({ error: 'description cannot be empty' }, { status: 400 });
    }

    if (updates.description && updates.description.length > 1000) {
      return NextResponse.json({ error: 'description cannot exceed 1000 characters' }, { status: 400 });
    }

    const updatedProduct = await updateCompanyProduct(params.id, session.companyId, updates);

    return NextResponse.json(updatedProduct);
  } catch (err) {
    console.error('PUT /api/company-products/definitions/[id]', err);

    if (err instanceof Error && err.message === 'Cannot update promoted products') {
      return NextResponse.json({ error: 'Cannot update promoted products' }, { status: 403 });
    }

    if (err instanceof Error && err.message === 'Product not found') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE /api/company-products/definitions/[id]
 * Delete company product
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteCompanyProduct(params.id, session.companyId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/company-products/definitions/[id]', err);

    if (err instanceof Error && err.message === 'Cannot delete promoted products') {
      return NextResponse.json({ error: 'Cannot delete promoted products' }, { status: 403 });
    }

    if (err instanceof Error && err.message === 'Product not found') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}