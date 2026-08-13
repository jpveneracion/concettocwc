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

    // Use SECURITY DEFINER function for product search
    const productsResult = await sql(
      'SELECT search_products_autocomplete($1::text) as product',
      [query]
    );

    const products = productsResult.map((row: any) => typeof row.product === 'string' ? JSON.parse(row.product) : row.product);
    return NextResponse.json(products);
  } catch (err) {
    console.error('GET /api/products/autocomplete', err);
    return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
  }
}