import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { checkSubscriptionAccess } from '@/lib/subscription';

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

    // Check subscription access - require full access for status updates
    const access = await checkSubscriptionAccess(session);
    if (access.mode !== 'full') {
      return NextResponse.json({
        error: 'Active subscription required for quote status updates',
        checkoutUrl: '/subscription/checkout',
        mode: access.mode,
        reason: access.reason
      }, { status: 403 });
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
