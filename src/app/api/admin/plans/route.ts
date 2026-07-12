// src/app/api/admin/plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// GET - Get available subscription plans
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();

    // Define available subscription plans
    const plans = [
      {
        id: 'monthly',
        name: 'Monthly',
        description: 'Flexible monthly subscription',
        price: 100,
        currency: 'PHP',
        interval: 'month',
        discount_percent: 0
      },
      {
        id: 'quarterly',
        name: 'Quarterly',
        description: 'Save 25% with quarterly billing',
        price: 75,
        currency: 'PHP',
        interval: 'quarter',
        discount_percent: 25
      },
      {
        id: 'annual',
        name: 'Annual',
        description: 'Best value - save 35% with annual billing',
        price: 65,
        currency: 'PHP',
        interval: 'year',
        discount_percent: 35
      }
    ];

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}