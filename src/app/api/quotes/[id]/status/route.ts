import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    // Validate status
    if (!status || !['draft', 'sent', 'delivered', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: draft, sent, delivered, cancelled' },
        { status: 400 }
      );
    }

    // Update only the status field
    await sql`
      UPDATE quotes
      SET status = ${status},
          updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${session.companyId}
    `;

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('PATCH /api/quotes/[id]/status', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
