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
      const minimumArea = Number(data.minimum_area_sqft);
      if (!Number.isFinite(minimumArea) || minimumArea < 0) {
        return NextResponse.json({ error: 'Minimum area is required and must be 0 or greater' }, { status: 400 });
      }

      // Generate unique company code
      const companyCode = await generateUniqueCompanyCode();
      const company = await createCompany({
        code: companyCode,
        name: data.company_name,
        address: data.company_address || '',
        mobile: data.company_mobile || '',
        email: data.company_email || '',
        minimum_area_sqft: minimumArea
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

    // Create user with password using security definer function
    const userResult = await sql`
      SELECT create_user(
        ${data.email},
        ${passwordHash},
        ${emailHash},
        ${companyId}::uuid,
        'user'
      ) as user_data
    `;

    if (!userResult || userResult.length === 0) {
      throw new Error('User creation failed');
    }

    const userDataRaw = userResult[0].user_data;
    const user = typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw;
    const userData = {
      id: user.id,
      email: user.email,
      company_id: user.company_id
    };

    // Link OAuth account
    await linkOAuthAccount(userData.id, accountData);

    // Set session cookie
    cookieStore.set('session', JSON.stringify({
      userId: userData.id,
      companyId: userData.company_id,
      email: userData.email,
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
  const existing = await sql`
    SELECT check_company_exists(${code}) as exists
  `;
  if (existing.length > 0 && existing[0].exists) {
    return generateUniqueCompanyCode(); // Retry if collision
  }
  return code;
}