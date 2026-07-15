import { NextResponse } from 'next/server';
import type { AccountChoiceData } from '@/types/oauth';
import { validateCompanyCode, createCompany, linkOAuthAccount, findUserByEmail } from '@/lib/oauth';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const data: AccountChoiceData = await req.json();
    const cookieStore = await cookies();

    // Get temporary OAuth data from headers or cookie
    const tempProvider = req.headers.get('x-temp-provider') as 'google' | 'microsoft' | 'pi';
    const tempProviderId = req.headers.get('x-temp-provider-id');
    const tempToken = req.headers.get('x-temp-token');

    if (!tempProvider || !tempProviderId) {
      return NextResponse.json({ error: 'Session expired' }, { status: 400 });
    }

    // Validate email
    const emailHash = crypto.createHash('sha256').update(data.email.toLowerCase().trim()).digest('hex');
    const existingUser = await findUserByEmail(data.email);

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    let companyId: string;

    if (data.action === 'join') {
      // Join existing company
      if (!data.company_code) {
        return NextResponse.json({ error: 'Company code required' }, { status: 400 });
      }

      const company = await validateCompanyCode(data.company_code);
      if (!company) {
        return NextResponse.json({ error: 'Invalid company code' }, { status: 400 });
      }

      companyId = company.id;
    } else {
      // Create new company
      if (!data.company_name) {
        return NextResponse.json({ error: 'Company name required' }, { status: 400 });
      }

      // Generate unique company code
      const companyCode = await generateUniqueCompanyCode();
      const company = await createCompany({
        code: companyCode,
        name: data.company_name,
        address: data.company_address || '',
        mobile: data.company_mobile || '',
        email: data.company_email || ''
      });

      companyId = company.id;
    }

    // Create user with OAuth account
    const accountData = {
      provider: tempProvider,
      provider_user_id: tempProviderId,
      email: data.email,
      username: tempProvider === 'pi' ? (req.headers.get('x-temp-username') || undefined) : undefined,
      wallet_address: tempProvider === 'pi' ? (req.headers.get('x-temp-wallet') || undefined) : undefined,
      access_token: tempToken || undefined,
      refresh_token: undefined,
      expires_at: null
    };

    // Generate random password for OAuth users
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user with password
    const [user] = await sql`
      INSERT INTO users (company_id, email, email_hash, password_hash)
      VALUES (${companyId}, ${data.email}, ${emailHash}, ${passwordHash})
      RETURNING id, email, company_id
    `;

    // Link OAuth account
    await linkOAuthAccount(user.id, accountData);

    // Set session cookie
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      companyId: user.company_id,
      email: user.email,
      provider: tempProvider
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      redirect: '/dashboard',
      company: { code: data.action === 'join' ? data.company_code : null }
    });

  } catch (error) {
    console.error('Account choice error:', error);
    return NextResponse.json({ error: 'Account creation failed' }, { status: 500 });
  }
}

// Generate unique company code
async function generateUniqueCompanyCode(): Promise<string> {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const existing = await sql`SELECT id FROM companies WHERE code = ${code}`;
  if (existing.length > 0) {
    return generateUniqueCompanyCode(); // Retry if collision
  }
  return code;
}