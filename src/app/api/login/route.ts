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
    console.log('🔐 Login attempt started');
    const { email, password } = await req.json();

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    console.log('📧 Looking up user:', email);
    const emailHash = hashEmailForSearch(email);

    // Find user with company using email_hash for authentication
    let users = await sql`
      SELECT
        users.id as user_id,
        users.email,
        users.email_encrypted,
        users.email_hash,
        users.password_hash,
        companies.id as company_id,
        companies.code as company_code
      FROM users
      JOIN companies ON companies.id = users.company_id
      WHERE users.email_hash = ${emailHash}
    `;

    // Fallback to email search if email_hash not found (for users without email_hash populated)
    let foundViaEmailFallback = false;
    if (users.length === 0) {
      users = await sql`
        SELECT
          users.id as user_id,
          users.email,
          users.email_encrypted,
          users.email_hash,
          users.password_hash,
          companies.id as company_id,
          companies.code as company_code
        FROM users
        JOIN companies ON companies.id = users.company_id
        WHERE users.email = ${email.toLowerCase().trim()}
      `;
      foundViaEmailFallback = users.length > 0;
    }

    if (users.length === 0) {
      console.log('❌ No user found');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = users[0];
    console.log('✅ User found:', user.user_id);

    // Verify password
    console.log('🔑 Verifying password...');
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('❌ Invalid password');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    console.log('✅ Password valid');

    // Auto-populate email_hash if user was found via email fallback and password is correct
    if (foundViaEmailFallback && user.email && !user.email_hash) {
      const autoEmailHash = hashEmailForSearch(user.email);
      await sql`
        UPDATE users
        SET email_hash = ${autoEmailHash}
        WHERE id = ${user.user_id}
      `;
      console.log(`Auto-populated email_hash for user ${user.user_id} (${user.email})`);
    }

    // Check if using default password
    let isDefaultPassword = false;
    try {
      isDefaultPassword = await bcrypt.compare('admin123', user.password_hash);
    } catch (bcryptError) {
      console.error('Bcrypt error checking default password:', bcryptError);
      // Continue anyway - this isn't critical
    }

    // Check if company has pricing set up (collections) with timeout
    let hasPricing = false;
    try {
      const pricingCheckPromise = sql`
        SELECT COUNT(*) as count
        FROM company_collections
        WHERE company_id = ${user.company_id}
      `;

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pricing check timeout')), 3000)
      );

      const [pricingCheck] = await Promise.race([pricingCheckPromise, timeoutPromise]) as any;
      hasPricing = pricingCheck && Number(pricingCheck.count) > 0;
    } catch (pricingError) {
      console.error('Pricing check failed (non-critical):', pricingError);
      hasPricing = false; // Default to false if check fails
    }

    // Set session cookie - use decrypted email if needed
    const sessionEmail = user.email || email; // fallback to input email if stored is null

    console.log('🍪 Setting session cookie...');
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
    console.log('✅ Session cookie set successfully');

    console.log('🎯 Returning login response...');
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
