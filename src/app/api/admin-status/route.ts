import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * GET /api/auth/admin-status
 * Check if current user has admin privileges
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const { sql } = await import('@/lib/db');
    const result = await sql`
      SELECT role, is_admin FROM users WHERE id = ${session.userId}::uuid
    `;

    const user = result[0];
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.is_admin === true;

    return NextResponse.json({
      isAdmin,
      role: user?.role || 'user'
    });
  } catch (err) {
    console.error('GET /api/auth/admin-status', err);
    return NextResponse.json({ error: 'Failed to check admin status' }, { status: 500 });
  }
}