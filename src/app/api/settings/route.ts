import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // query() sets the RLS context (get_company_settings guards on
    // get_current_company_id()); raw sql() leaves it NULL and the guard raises.
    const settingsResult = await query<{ company: Record<string, unknown> | null }>(
      'SELECT get_company_settings($1::uuid) as company',
      [session.companyId],
      session.companyId,
      session.role || 'user'
    );
    const company = settingsResult.rows[0]?.company;
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    // get_company_settings returns the name under the `company` key
    // (SELECT ... name as company ...) - expose it as `name` for the page form
    return NextResponse.json({ ...company, name: company.company ?? company.name });
  } catch (err) {
    console.error('GET /api/settings', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, address, mobile, email, currency, prepared_by, terms, del_note, closing_note } = body;
    const minimum_area_sqft = Math.max(0, Number(body.minimum_area_sqft) || 0);

    const result = await query(
      'SELECT update_company_settings($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as company',
      [
        session.companyId, name, address, mobile, email, currency, prepared_by, terms, del_note, closing_note, minimum_area_sqft
      ],
      session.companyId,
      session.role || 'user'
    );
    const company = result.rows[0]?.company;
    return NextResponse.json(company);
  } catch (err) {
    console.error('PUT /api/settings', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
