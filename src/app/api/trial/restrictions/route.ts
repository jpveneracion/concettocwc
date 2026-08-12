import { NextRequest, NextResponse } from 'next/server';
import { getUserRestrictionState } from '@/lib/trial-restrictions';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({
        level: 'partial',
        trialExpired: true,
        trialExpiresAt: null,
        subscriptionActive: false,
        allowedOperations: [],
        canCreatePastOrders: true,
        canCreateFutureOrders: false,
        maxOrderDate: null
      });
    }

    const restrictionState = await getUserRestrictionState(session.userId);
    return NextResponse.json(restrictionState);
  } catch (error) {
    console.error('Failed to fetch restriction state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restriction state' },
      { status: 500 }
    );
  }
}