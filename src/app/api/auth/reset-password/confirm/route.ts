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

    // Find valid reset token using SECURITY DEFINER function
    const result = await sql('SELECT validate_reset_token($1) as token_data', [token]);
    const resetToken = result[0]?.token_data || null;

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password using SECURITY DEFINER function
    await sql('SELECT update_user_password($1::uuid, $2)', [resetToken.user_id, passwordHash]);

    // Mark token as used using SECURITY DEFINER function
    await sql('SELECT mark_reset_token_used($1)', [token]);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (err) {
    console.error('POST /api/auth/reset-password/confirm', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
