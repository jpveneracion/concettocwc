import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [company] = await sql`
      SELECT id, code, name, address, mobile, email,
             prepared_by, terms, del_note, closing_note, updated_at
      FROM companies
      WHERE id = ${session.companyId}
    `;
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json(company);
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
    const { name, address, mobile, email, prepared_by, terms, del_note, closing_note } = body;

    const [company] = await sql`
      UPDATE companies SET
        name         = ${name},
        address      = ${address},
        mobile       = ${mobile},
        email        = ${email},
        prepared_by  = ${prepared_by},
        terms        = ${terms},
        del_note     = ${del_note},
        closing_note = ${closing_note},
        updated_at   = now()
      WHERE id = ${session.companyId}
      RETURNING id, code, name, address, mobile, email,
                prepared_by, terms, del_note, closing_note, updated_at
    `;
    return NextResponse.json(company);
  } catch (err) {
    console.error('PUT /api/settings', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
