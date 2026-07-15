// src/app/api/admin/plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';

// GET - Get available subscription plans
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Import subscription plans utility
    const { getAllSubscriptionPlans, formatSubscriptionPlansForAPI } = await import('@/lib/subscription-plans');

    // Fetch plans with appropriate filter
    const plans = await getAllSubscriptionPlans(
      includeInactive ? {} : { is_active: true }
    );

    return NextResponse.json({ plans: formatSubscriptionPlansForAPI(plans) });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new subscription plan
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    const body = await req.json();
    const { name, description, amount, currency, interval, discount_percent, features, is_active } = body;

    // Import subscription plans utility
    const { createSubscriptionPlan, formatSubscriptionPlanForAPI } = await import('@/lib/subscription-plans');

    // Basic validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Plan name is required' },
        { status: 400 }
      );
    }

    if (amount === undefined || amount < 0) {
      return NextResponse.json(
        { error: 'Amount must be a non-negative number' },
        { status: 400 }
      );
    }

    if (!interval || !['month', 'quarter', 'year'].includes(interval)) {
      return NextResponse.json(
        { error: 'Interval must be one of: month, quarter, year' },
        { status: 400 }
      );
    }

    // Create plan
    const newPlan = await createSubscriptionPlan({
      name,
      description,
      amount,
      currency: currency || 'PHP',
      interval,
      discount_percent: discount_percent || 0,
      features: features || [],
      is_active: is_active !== undefined ? is_active : true
    });

    return NextResponse.json({
      success: true,
      plan: formatSubscriptionPlanForAPI(newPlan)
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update existing subscription plan
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    const body = await req.json();
    const { id, name, description, amount, currency, interval, discount_percent, features, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Import subscription plans utility
    const { updateSubscriptionPlan, formatSubscriptionPlanForAPI } = await import('@/lib/subscription-plans');

    // Build updates object (only include defined fields)
    const updates: Record<string, string | number | boolean | string[] | Record<string, any>> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (currency !== undefined) updates.currency = currency;
    if (interval !== undefined) updates.interval = interval;
    if (discount_percent !== undefined) updates.discount_percent = discount_percent;
    if (features !== undefined) updates.features = features;
    if (is_active !== undefined) updates.is_active = is_active;

    // Update plan
    const updatedPlan = await updateSubscriptionPlan(id, updates);

    if (!updatedPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: formatSubscriptionPlanForAPI(updatedPlan)
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete subscription plan
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Import subscription plans utility
    const { deleteSubscriptionPlan } = await import('@/lib/subscription-plans');

    // Delete plan
    const success = await deleteSubscriptionPlan(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}