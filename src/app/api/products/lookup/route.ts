import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'code query param required' }, { status: 400 });
  }

  try {
    const [product] = await sql`
      SELECT id, code, collection, description,
             supplier_cost::float, retail_price::float, unit
      FROM products
      WHERE UPPER(code) = ${code} AND active = true
    `;
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/lookup', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
