import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim().toUpperCase();

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await sql`
      SELECT
        p.code, p.collection, p.description, p.unit
      FROM products p
      WHERE
        UPPER(p.code) LIKE ${query + '%'}
        AND p.active = true
      ORDER BY p.code
      LIMIT 10
    `;

    return NextResponse.json(products);
  } catch (err) {
    console.error('GET /api/products/autocomplete', err);
    return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
  }
}