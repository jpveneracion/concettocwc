import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Find valid reset token
    const [resetToken] = await sql`
      SELECT prt.user_id, prt.expires_at
      FROM password_reset_tokens prt
      WHERE prt.token = ${token}
        AND prt.expires_at > NOW()
        AND prt.used_at IS NULL
      ORDER BY prt.created_at DESC
      LIMIT 1
    `;

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${resetToken.user_id}
    `;

    // Mark token as used
    await sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token = ${token}
    `;

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (err) {
    console.error('POST /api/auth/reset-password/confirm', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
