import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import bcrypt from 'bcrypt';

async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    throw new Error('Unauthorized');
  }

  const session = JSON.parse(sessionCookie.value);
  return session;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    // Get user's current password hash
    const [user] = await sql`
      SELECT password_hash
      FROM users
      WHERE id = ${session.userId}
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash}
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/auth/change-password', err);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
