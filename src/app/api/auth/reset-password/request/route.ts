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

    // Find user by email
    const [user] = await sql`
      SELECT u.id, u.email, u.company_id, c.name as company_name
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE LOWER(u.email) = ${email.toLowerCase()}
    `;

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      // But still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link will be sent to your email.'
      });
    }

    // Generate reset token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `;

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
