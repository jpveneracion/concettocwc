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
      SELECT get_user_admin_status(${session.userId}::uuid) as admin_data
    `;

    const adminData = result[0].admin_data;
    const isAdmin = adminData.is_admin === true;

    return NextResponse.json({
      isAdmin,
      role: adminData.role || 'user'
    });
  } catch (err) {
    console.error('GET /api/auth/admin-status', err);
    return NextResponse.json({ error: 'Failed to check admin status' }, { status: 500 });
  }
}