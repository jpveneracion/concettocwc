import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getCompanyProducts,
  companyProductCodeExists,
  createCompanyProduct
} from '@/lib/company-product-queries';
import type {
  CompanyProductListResponse,
  CreateCompanyProductRequest
} from '@/types/company-product';

/**
 * GET /api/company-products/definitions
 * Get company products with optional filtering
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'all' | 'pending' | 'approved' | null;
    const search = searchParams.get('search') || undefined;

    // Validate status parameter
    if (status && !['all', 'pending', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    // Get products
    const products = await getCompanyProducts(
      session.companyId,
      status || undefined,
      search
    );

    // Calculate response data
    const total = products.length;
    const hasUnapproved = products.some(p => !p.is_approved_for_global);

    const response: CompanyProductListResponse = {
      products,
      total,
      has_unapproved: hasUnapproved
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('GET /api/company-products/definitions', err);
    return NextResponse.json(
      { error: 'Failed to fetch company products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/company-products/definitions
 * Create a new company product
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, collection, description, unit } = body;

    // Validate required fields
    if (!code || !description) {
      return NextResponse.json(
        { error: 'code and description are required' },
        { status: 400 }
      );
    }

    // Trim and validate input lengths
    const trimmedCode = code.trim();
    const trimmedDescription = description.trim();
    const trimmedCollection = collection?.trim() || undefined;

    if (trimmedCode.length === 0) {
      return NextResponse.json(
        { error: 'code cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedCode.length > 50) {
      return NextResponse.json(
        { error: 'code must be 50 characters or less' },
        { status: 400 }
      );
    }

    if (trimmedDescription.length === 0) {
      return NextResponse.json(
        { error: 'description cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedDescription.length > 500) {
      return NextResponse.json(
        { error: 'description must be 500 characters or less' },
        { status: 400 }
      );
    }

    if (trimmedCollection && trimmedCollection.length > 100) {
      return NextResponse.json(
        { error: 'collection must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Convert code to uppercase and check for duplicates
    const upperCaseCode = trimmedCode.toUpperCase();
    const codeExists = await companyProductCodeExists(session.companyId, upperCaseCode);

    if (codeExists) {
      return NextResponse.json(
        { error: 'A product with this code already exists' },
        { status: 409 }
      );
    }

    // Create the product
    const createRequest: CreateCompanyProductRequest = {
      code: upperCaseCode,
      collection: trimmedCollection,
      description: trimmedDescription,
      unit: unit || 'sqft'
    };

    const product = await createCompanyProduct(
      createRequest,
      session.companyId,
      session.userId
    );

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('POST /api/company-products/definitions', err);
    return NextResponse.json(
      { error: 'Failed to create company product' },
      { status: 500 }
    );
  }
}