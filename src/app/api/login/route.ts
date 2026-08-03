import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { setTenantContext } from '@/lib/rls';

// Helper function to get the appropriate cookie domain based on environment
function getCookieDomain(): string | undefined {
  // For development: don't set domain (browser default for localhost)
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }

  // For production: use environment variable if set
  if (process.env.COOKIE_DOMAIN) {
    const domain = process.env.COOKIE_DOMAIN.trim();
    // Ensure domain starts with dot for subdomain support
    return domain.startsWith('.') ? domain : `.${domain}`;
  }

  // Default: no domain (let browser handle it)
  return undefined;
}

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

    // Find user with company using SECURITY DEFINER function for user lookup
    let users = await sql`
      SELECT
        u.user_id,
        u.user_email as email,
        u.email_hash,
        u.user_password_hash as password_hash,
        u.company_id,
        c.code as company_code
      FROM find_user_by_email_hash(${emailHash}) u
      JOIN companies c ON c.id = u.company_id
    `;

    // Fallback to email search if email_hash not found (for users without email_hash populated)
    let foundViaEmailFallback = false;
    if (users.length === 0) {
      console.log('🔍 Email hash not found, trying email fallback with SECURITY DEFINER function...');

      users = await sql`
        SELECT
          u.id as user_id,
          u.email,
          u.email_encrypted,
          u.email_hash,
          u.password_hash,
          c.id as company_id,
          c.code as company_code
        FROM find_user_by_email(${email.toLowerCase().trim()}) u
        JOIN companies c ON c.id = u.company_id
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
      console.log('🔧 Auto-populating email_hash using SECURITY DEFINER function...');
      const autoEmailHash = hashEmailForSearch(user.email);
      await sql('SELECT update_user_email_hash($1, $2)', [user.user_id, autoEmailHash]);
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

    // FIXED: Get user role FIRST, before setting context
    const [userRoleResult] = await sql('SELECT get_user_admin_status($1) as user_status', [user.user_id]);
    const userRole = userRoleResult?.user_status;

    // Normalize role for RLS (handle 'super_admin' -> 'superadmin' conversion)
    const normalizedRole = (() => {
      const role = userRole?.role?.toLowerCase() || 'user';
      if (role === 'super_admin') return 'superadmin';
      if (role === 'admin' || role === 'user' || role === 'superadmin') return role;
      return 'user';
    })();

    // FIXED: Establish RLS context BEFORE dependent operations
    try {
      await setTenantContext(user.company_id, normalizedRole);
      console.log('✅ RLS context established for user:', user.user_id, 'company:', user.company_id, 'role:', normalizedRole);
    } catch (rlsError) {
      console.error('❌ Failed to establish RLS context (authentication will proceed):', rlsError);
      // Don't fail login if RLS context establishment fails
    }

    // FIXED: NOW check if company has pricing (AFTER context is set)
    let hasPricing = false;
    try {
      const pricingCheckPromise = sql('SELECT check_company_has_pricing($1) as has_pricing', [user.company_id]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pricing check timeout')), 3000)
      );
      const [pricingCheck] = await Promise.race([pricingCheckPromise, timeoutPromise]) as any;
      hasPricing = pricingCheck && pricingCheck.has_pricing;
    } catch (pricingError) {
      console.error('Pricing check failed (non-critical):', pricingError);
      hasPricing = false;
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
      role: normalizedRole,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      domain: getCookieDomain(),
    });
    console.log('✅ Session cookie set successfully with role:', normalizedRole);

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
