import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { setTrialExpiration } from '@/lib/subscription';
import { setTenantContext } from '@/lib/rls';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Hash email for searchable authentication
function hashEmailForSearch(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, user } = body;

    // Validate required fields
    if (!company?.code || !company?.name) {
      return NextResponse.json({ error: 'Company code and name are required' }, { status: 400 });
    }
    const minimumArea = Number(company.minimum_area_sqft);
    if (!Number.isFinite(minimumArea) || minimumArea < 0) {
      return NextResponse.json({ error: 'Minimum area is required and must be 0 or greater' }, { status: 400 });
    }
    if (!user?.email || !user?.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (user.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const companyCode = company.code.toUpperCase().trim();
    const userEmail = user.email.toLowerCase().trim();
    const emailHash = hashEmailForSearch(userEmail);

    // Check if company code already exists using SECURITY DEFINER function
    const existingCompany = await sql('SELECT check_company_exists($1) as exists', [companyCode]);
    if (existingCompany.length > 0 && existingCompany[0].exists) {
      return NextResponse.json({ error: 'Company code already exists' }, { status: 409 });
    }

    // Check if user email already exists using email_hash via SECURITY DEFINER function
    const existingUser = await sql('SELECT check_user_exists_by_email_hash($1) as exists', [emailHash]);
    if (existingUser.length > 0 && existingUser[0].exists) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(user.password, 10);

    // Create company using SECURITY DEFINER function
    const [companyResult] = await sql('SELECT create_company($1, $2, $3, $4, $5, $6, $7) as company', [
      companyCode,
      company.name.trim(),
      company.address?.trim() ?? '',
      company.mobile?.trim() ?? '',
      company.email?.trim() ?? '',
      company.prepared_by?.trim() ?? '',
      minimumArea
    ]);

    const newCompany = companyResult.company;

    // Create user linked to company with email_hash for authentication using SECURITY DEFINER function
    const [userResult] = await sql('SELECT create_user($1, $2, $3, $4, $5) as user', [
      userEmail,
      passwordHash,
      emailHash,
      newCompany.id,
      'user'
    ]);

    const newUser = userResult.user;

    // Activate 3-day trial for new user
    await setTrialExpiration(newUser.id, 3);
    console.log(`✅ 3-day trial activated for new user ${newUser.id}`);

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
