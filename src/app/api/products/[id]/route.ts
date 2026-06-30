import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await sql`
      UPDATE products SET active = false, updated_at = now()
      WHERE id = ${id}::uuid
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/products/[id]', err);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [product] = await sql`
      SELECT id, code, collection, description,
             supplier_cost::float, retail_price::float, unit, active,
             created_at, updated_at
      FROM products
      WHERE id = ${id}::uuid
    `;
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/[id]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
