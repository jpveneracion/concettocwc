import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { setTenantContext } from '@/lib/rls';

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

    // Set app role context for SECURITY DEFINER functions
    await sql('SELECT set_config($1, $2, true)', ['app.role', 'concetto_boms']);

    // Use SECURITY DEFINER function for deletion - NO direct SQL
    const [result] = await sql('SELECT delete_product($1::uuid) as result', [id]);
    console.log('Delete result:', result);

    if (!result || !result.result || !result.result.success) {
      console.log('WARNING: Delete failed for product ID:', id);
      return NextResponse.json({ error: result?.result?.error || 'Product not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedProduct: result.result });
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
    // Use SECURITY DEFINER function for product lookup
    const result = await sql('SELECT get_product_by_id($1::uuid) as product', [id]);

    if (result.length === 0 || !result[0].product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const product = JSON.parse(result[0].product);
    if (!product.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/[id]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
