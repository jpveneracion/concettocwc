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

    const [product] = await sql`
      SELECT
        p.id, p.code, p.collection, p.description, p.unit,
        COALESCE(cc.supplier_cost::float, 0) as supplier_cost,
        COALESCE(cc.retail_price::float, 0) as retail_price
      FROM products p
      LEFT JOIN company_collections cc ON cc.collection = p.collection AND cc.company_id = ${session.companyId}
      WHERE UPPER(p.code) = ${code} AND p.active = true
    `;
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/lookup', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
