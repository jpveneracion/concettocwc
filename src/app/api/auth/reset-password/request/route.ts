import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import crypto from 'crypto';

// Generate a secure random token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email using SECURITY DEFINER function
    const result = await sql('SELECT find_user_by_email($1) as user_data', [email.toLowerCase()]);
    const userJson = result[0]?.user_data || null;

    if (!userJson) {
      // Don't reveal if email exists or not (security best practice)
      // But still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link will be sent to your email.'
      });
    }

    const user = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;

    // Generate reset token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token using SECURITY DEFINER function
    const tokenResult = await sql(
      'SELECT create_password_reset_token($1::uuid, $2, $3) as token_data',
      [user.id, token, expiresAt]
    );

    if (!tokenResult || tokenResult.length === 0) {
      console.error('Failed to create password reset token');
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link will be sent to your email.'
      });
    }

    const tokenData = JSON.parse(tokenResult[0].token_data);
    if (!tokenData.success) {
      console.error('Password reset token creation failed:', tokenData.error);
    }

    // TODO: Send email with reset link
    // For now, log the reset link to console
    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    console.log('====================================');
    console.log('PASSWORD RESET EMAIL');
    console.log('====================================');
    console.log(`To: ${user.email}`);
    console.log(`Company: ${user.company_name}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('====================================');
    console.log('');
    console.log('NOTE: Email sending not configured yet.');
    console.log('Set up SMTP/Nodemailer/Resend to send actual emails.');
    console.log('For now, the reset link is logged above.');
    console.log('====================================');

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link will be sent to your email.'
    });
  } catch (err) {
    console.error('POST /api/auth/reset-password/request', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
