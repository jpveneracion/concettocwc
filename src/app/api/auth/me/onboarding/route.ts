// src/app/api/auth/me/onboarding/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * Onboarding status API endpoint
 * GET: Fetch user's general onboarding status from database
 * POST: Update onboarding status (completed/skipped)
 */

interface OnboardingStatusResponse {
  completed: boolean;
  skipped: boolean;
}

interface OnboardingUpdateRequest {
  completed?: boolean;
  skipped?: boolean;
}

/**
 * GET /api/auth/me/onboarding
 * Returns the user's general onboarding status
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        completed: false,
        skipped: false
      });
    }

    // Query onboarding_progress table for general onboarding
    const result = await query<{
      completed: boolean;
      skipped: boolean;
    }>(
      `SELECT completed, skipped
       FROM onboarding_progress
       WHERE user_id = $1
       AND onboarding_type = 'general'
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.userId],
      session.companyId,
      session.role || 'user'
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        completed: false,
        skipped: false
      });
    }

    return NextResponse.json({
      completed: result.rows[0].completed,
      skipped: result.rows[0].skipped
    });
  } catch (error) {
    console.error('GET /api/auth/me/onboarding error:', error);
    return NextResponse.json({
      completed: false,
      skipped: false
    });
  }
}

/**
 * POST /api/auth/me/onboarding
 * Updates the user's general onboarding status
 * Body: { completed?: boolean, skipped?: boolean }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as OnboardingUpdateRequest;
    const { completed, skipped } = body;

    if (typeof completed !== 'boolean' && typeof skipped !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Upsert onboarding progress record
    const result = await query<{
      completed: boolean;
      skipped: boolean;
    }>(
      `INSERT INTO onboarding_progress (user_id, onboarding_type, completed, skipped, completed_at)
       VALUES ($1, 'general', $2, $3, $4)
       ON CONFLICT (user_id, onboarding_type)
       DO UPDATE SET
         completed = EXCLUDED.completed,
         skipped = EXCLUDED.skipped,
         completed_at = CASE WHEN EXCLUDED.completed = true THEN NOW() ELSE onboarding_progress.completed_at END,
         updated_at = NOW()
       RETURNING completed, skipped`,
      [
        session.userId,
        completed ?? false,
        skipped ?? false,
        completed ? new Date().toISOString() : null
      ],
      session.companyId,
      session.role || 'user'
    );

    return NextResponse.json({
      completed: result.rows[0].completed,
      skipped: result.rows[0].skipped
    });
  } catch (error) {
    console.error('POST /api/auth/me/onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to update onboarding status' },
      { status: 500 }
    );
  }
}
