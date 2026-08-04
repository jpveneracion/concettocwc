import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';

export async function GET() {
  try {
    // Set app role context for SECURITY DEFINER function
    await sql('SELECT set_config($1, $2, true)', ['app.role', 'concetto_boms']);

    const productsResult = await sql('SELECT get_active_products() as product');
    const products = productsResult.map(row => row.product);
    console.log(`GET /api/products returning ${products.length} products`);
    if (products.length > 0) {
      console.log('Sample product:', products[0]);
    }
    return NextResponse.json(products);
  } catch (err) {
    console.error('GET /api/products', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Require admin access for product creation
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireAdmin(session.userId);

    // Set app role context for SECURITY DEFINER function
    await sql('SELECT set_config($1, $2, true)', ['app.role', 'concetto_boms']);

    const body = await req.json();
    const { code, collection, description, unit } = body;

    if (!code || !description) {
      return NextResponse.json({ error: 'code and description are required' }, { status: 400 });
    }

    const [product] = await sql('SELECT upsert_product($1, $2, $3, $4) as product', [
      code.trim().toUpperCase(),
      collection?.trim() ?? '',
      description.trim(),
      unit ?? 'sqft'
    ]);
    const productData = product.product;

    return NextResponse.json(productData, { status: 201 });
  } catch (err) {
    console.error('POST /api/products', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}
