import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Hash email for searchable authentication
function hashEmailForSearch(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const emailHash = hashEmailForSearch(email);

    // Find user with company using email_hash for authentication
    let users = await sql`
      SELECT
        users.id as user_id,
        users.email,
        users.email_encrypted,
        users.password_hash,
        companies.id as company_id,
        companies.code as company_code
      FROM users
      JOIN companies ON companies.id = users.company_id
      WHERE users.email_hash = ${emailHash}
    `;

    // Fallback to email search if email_hash not found (for users without email_hash populated)
    if (users.length === 0) {
      users = await sql`
        SELECT
          users.id as user_id,
          users.email,
          users.email_encrypted,
          users.password_hash,
          companies.id as company_id,
          companies.code as company_code
        FROM users
        JOIN companies ON companies.id = users.company_id
        WHERE users.email = ${email.toLowerCase().trim()}
      `;
    }

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = users[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check if using default password
    const isDefaultPassword = await bcrypt.compare('admin123', user.password_hash);

    // Check if company has pricing set up (collections)
    const [pricingCheck] = await sql`
      SELECT COUNT(*) as count
      FROM company_collections
      WHERE company_id = ${user.company_id}
    `;
    const hasPricing = Number(pricingCheck.count) > 0;

    // Set session cookie - use decrypted email if needed
    const sessionEmail = user.email || email; // fallback to input email if stored is null

    const cookieStore = await cookies();
    cookieStore.set('session', JSON.stringify({
      userId: user.user_id,
      companyId: user.company_id,
      companyCode: user.company_code,
      email: sessionEmail,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      success: true,
      company: {
        code: user.company_code,
      },
      defaultPassword: isDefaultPassword,
      hasPricing,
    });
  } catch (err) {
    console.error('POST /api/auth/login', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
