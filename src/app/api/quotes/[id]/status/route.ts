import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { setTenantContext, resetTenantContext } from '@/lib/rls';

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

    // Set RLS context for tenant isolation
    await setTenantContext(session.companyId, session.role || 'user');

    try {
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

      // Delivered quotes are locked and cannot change status
      const [existingQuoteResult] = await sql('SELECT get_company_quote_by_id($1, $2) as quote', [session.companyId, id]);
      const quote = existingQuoteResult?.quote;
      if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      if (quote.status === 'delivered' && status !== 'delivered') {
        return NextResponse.json(
          { error: 'Cannot change status from delivered.' },
          { status: 403 }
        );
      }

      // Update status through SECURITY DEFINER function
      await sql('SELECT update_quote_status($1, $2)', [id, status]);

      return NextResponse.json({ success: true, status });
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
  } catch (err) {
    console.error('PATCH /api/quotes/[id]/status', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
