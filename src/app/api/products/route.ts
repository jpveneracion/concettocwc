import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const products = await sql`
      SELECT id, code, collection, description,
             supplier_cost::float, retail_price::float, unit, active,
             created_at, updated_at
      FROM products
      WHERE active = true
      ORDER BY code ASC
    `;
    return NextResponse.json(products);
  } catch (err) {
    console.error('GET /api/products', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, collection, description, supplier_cost, retail_price, unit } = body;

    if (!code || !description) {
      return NextResponse.json({ error: 'code and description are required' }, { status: 400 });
    }

    const [product] = await sql`
      INSERT INTO products (code, collection, description, supplier_cost, retail_price, unit)
      VALUES (
        ${code.trim().toUpperCase()},
        ${collection?.trim() ?? ''},
        ${description.trim()},
        ${supplier_cost ?? 0},
        ${retail_price ?? 0},
        ${unit ?? 'sqft'}
      )
      ON CONFLICT (code) DO UPDATE SET
        collection   = EXCLUDED.collection,
        description  = EXCLUDED.description,
        supplier_cost = EXCLUDED.supplier_cost,
        retail_price = EXCLUDED.retail_price,
        unit         = EXCLUDED.unit,
        updated_at   = now()
      RETURNING id, code, collection, description,
                supplier_cost::float, retail_price::float, unit, active,
                created_at, updated_at
    `;
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('POST /api/products', err);
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}
