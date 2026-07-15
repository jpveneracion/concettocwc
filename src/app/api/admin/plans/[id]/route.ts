// src/app/api/admin/plans/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  formatSubscriptionPlanForAPI
} from '@/lib/subscription-plans';

/**
 * GET - Get single subscription plan by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Get plan from database
    const plan = await getSubscriptionPlanById(id);

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      plan: formatSubscriptionPlanForAPI(plan)
    });
  } catch (error) {
    console.error('Error fetching plan:', error);

    // Handle permission errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update existing subscription plan
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    const body = await req.json();
    const { name, description, amount, currency, interval, discount_percent, features, paymongo_plan_id, is_active } = body;

    // Build updates object (only include defined fields)
    const updates: Record<string, string | number | boolean | string[] | Record<string, any> | null> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (currency !== undefined) updates.currency = currency;
    if (interval !== undefined) updates.interval = interval;
    if (discount_percent !== undefined) updates.discount_percent = discount_percent;
    if (features !== undefined) updates.features = features;
    if (paymongo_plan_id !== undefined) updates.paymongo_plan_id = paymongo_plan_id;
    if (is_active !== undefined) updates.is_active = is_active;

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No update data provided' },
        { status: 400 }
      );
    }

    // Update plan in database
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

    // Handle permission errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Plan with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete subscription plan
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Delete plan from database
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

    // Handle permission errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Handle foreign key constraint violations
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { error: 'Cannot delete plan that is in use by active subscriptions' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}