import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const [settings] = await sql`
      SELECT id, company, address, mobile, email,
             prepared_by, terms, del_note, closing_note, updated_at
      FROM settings
      LIMIT 1
    `;
    if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    return NextResponse.json(settings);
  } catch (err) {
    console.error('GET /api/settings', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { company, address, mobile, email, prepared_by, terms, del_note, closing_note } = body;

    const [settings] = await sql`
      UPDATE settings SET
        company      = ${company},
        address      = ${address},
        mobile       = ${mobile},
        email        = ${email},
        prepared_by  = ${prepared_by},
        terms        = ${terms},
        del_note     = ${del_note},
        closing_note = ${closing_note},
        updated_at   = now()
      RETURNING id, company, address, mobile, email,
                prepared_by, terms, del_note, closing_note, updated_at
    `;
    return NextResponse.json(settings);
  } catch (err) {
    console.error('PUT /api/settings', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
