// src/app/api/auth/trial-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getTrialStatusResponse } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();

    const trialStatus = await getTrialStatusResponse(session.userId);

    return NextResponse.json(trialStatus);
  } catch (error) {
    console.error('Error getting trial status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}