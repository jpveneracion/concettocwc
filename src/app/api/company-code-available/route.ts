import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('code') ?? '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // A company's own current code is always "available" to keep
    const session = await getSession();
    if (session?.companyCode && code === session.companyCode.trim().toUpperCase()) {
      return NextResponse.json({ available: true });
    }

    // check_company_exists is SECURITY DEFINER, so it also works without a
    // session/RLS context (signup page checks availability before login).
    const result = await sql('SELECT check_company_exists($1) as exists', [code]);
    return NextResponse.json({ available: !(result[0]?.exists ?? false) });
  } catch (err) {
    console.error('GET /api/company-code-available', err);
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
