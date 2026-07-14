import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require admin access for product deletion
    const session = await getSession();
    if (!session) {
      console.log('DELETE product failed: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('DELETE product attempt by user:', session.userId, session.email);

    await requireAdmin(session.userId);

    await sql`
      UPDATE products SET active = false, updated_at = now()
      WHERE id = ${id}::uuid
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/products/[id]', err);

    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

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
