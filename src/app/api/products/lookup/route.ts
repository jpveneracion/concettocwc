import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'code query param required' }, { status: 400 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use SECURITY DEFINER function for product lookup
    const result = await sql(
      'SELECT lookup_product_by_code($1::text, $2::uuid) as product',
      [code, session.companyId]
    );

    if (result.length === 0 || !result[0].product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const productRaw = result[0].product;
    const product = typeof productRaw === 'string' ? JSON.parse(productRaw) : productRaw;
    if (!product.code) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/lookup', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
