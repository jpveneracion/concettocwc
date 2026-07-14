import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';

export async function GET() {
  try {
    const products = await sql`
      SELECT id, code, collection, description, unit, active, created_at, updated_at
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
    // Require admin access for product creation
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireAdmin(session.userId);

    const body = await req.json();
    const { code, collection, description, unit } = body;

    if (!code || !description) {
      return NextResponse.json({ error: 'code and description are required' }, { status: 400 });
    }

    const [product] = await sql`
      INSERT INTO products (code, collection, description, unit)
      VALUES (
        ${code.trim().toUpperCase()},
        ${collection?.trim() ?? ''},
        ${description.trim()},
        ${unit ?? 'sqft'}
      )
      ON CONFLICT (code) DO UPDATE SET
        collection   = EXCLUDED.collection,
        description  = EXCLUDED.description,
        unit         = EXCLUDED.unit,
        updated_at   = now()
      RETURNING id, code, collection, description, unit, active, created_at, updated_at
    `;
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('POST /api/products', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}
