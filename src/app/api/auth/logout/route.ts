import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/auth/logout', err);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
