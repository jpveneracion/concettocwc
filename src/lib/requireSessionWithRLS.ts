// src/lib/requireSessionWithRLS.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setTenantContext } from '@/lib/rls';

/**
 * Higher-order function that ensures RLS context is set for protected routes
 * Replaces manual app.role setting with proper RLS tenant context
 */
export function requireSessionWithRLS(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getSession();
    await setTenantContext(session.companyId, session.role || 'user');

    try {
      return await handler(req, session);
    } finally {
      // Transaction-scoped, no reset needed
    }
  };
}

/**
 * For routes that need admin-level RLS context
 */
export function requireAdminWithRLS(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getSession();

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await setTenantContext(session.companyId, session.role || 'admin');

    try {
      return await handler(req, session);
    } finally {
      // Transaction-scoped, no reset needed
    }
  };
}

/**
 * For routes that need superadmin-level RLS context
 */
export function requireSuperadminWithRLS(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getSession();

    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    await setTenantContext(session.companyId, 'superadmin');

    try {
      return await handler(req, session);
    } finally {
      // Transaction-scoped, no reset needed
    }
  };
}