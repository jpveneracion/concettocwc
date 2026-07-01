import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, user } = body;

    // Validate required fields
    if (!company?.code || !company?.name) {
      return NextResponse.json({ error: 'Company code and name are required' }, { status: 400 });
    }
    if (!user?.email || !user?.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (user.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const companyCode = company.code.toUpperCase().trim();
    const userEmail = user.email.toLowerCase().trim();

    // Check if company code already exists
    const existingCompany = await sql`
      SELECT id FROM companies WHERE UPPER(code) = ${companyCode}
    `;
    if (existingCompany.length > 0) {
      return NextResponse.json({ error: 'Company code already exists' }, { status: 409 });
    }

    // Check if user email already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE UPPER(email) = ${userEmail}
    `;
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(user.password, 10);

    // Create company
    const [newCompany] = await sql`
      INSERT INTO companies (code, name, address, mobile, email, prepared_by)
      VALUES (
        ${companyCode},
        ${company.name.trim()},
        ${company.address?.trim() ?? ''},
        ${company.mobile?.trim() ?? ''},
        ${company.email?.trim() ?? ''},
        ${company.prepared_by?.trim() ?? ''}
      )
      RETURNING id, code, name
    `;

    // Create user linked to company
    const [newUser] = await sql`
      INSERT INTO users (company_id, email, password_hash)
      VALUES (${newCompany.id}, ${userEmail}, ${passwordHash})
      RETURNING id, email
    `;

    return NextResponse.json({
      success: true,
      company: { code: newCompany.code, name: newCompany.name },
      user: { email: newUser.email },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/auth/signup', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
