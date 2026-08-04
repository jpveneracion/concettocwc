// src/app/api/admin/revenue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Get date range from query params (default: last 30 days)
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch revenue data
    const revenueData = await getRevenueAnalytics(startDate);

    return NextResponse.json(revenueData);
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getRevenueAnalytics(startDate: Date) {
  try {
    // Use SECURITY DEFINER functions for all revenue analytics queries
    // This bypasses RLS policies while maintaining security through admin authentication

    // Total revenue by payment method
    const paymentMethodRevenue = await sql(`
      SELECT get_revenue_by_payment_method($1::timestamp with time zone)
    `, [startDate]);

    // Revenue over time
    const revenueOverTime = await sql(`
      SELECT get_revenue_over_time($1::timestamp with time zone)
    `, [startDate]);

    // Revenue by discount tier
    const revenueByDiscount = await sql(`
      SELECT get_revenue_by_discount($1::timestamp with time zone)
    `, [startDate]);

    // Revenue by subscription plan (the problematic FROM users query)
    const revenueByPlan = await sql(`
      SELECT get_revenue_by_subscription_plan($1::timestamp with time zone)
    `, [startDate]);

    // Summary statistics
    const totalRevenueResult = await sql(`
      SELECT get_revenue_summary($1::timestamp with time zone) as summary_data
    `, [startDate]);

    const summary = totalRevenueResult[0]?.summary_data
      ? JSON.parse(totalRevenueResult[0].summary_data)
      : {
          total_revenue: 0,
          total_transactions: 0,
          avg_transaction_value: 0
        };

    return {
      payment_method_revenue: paymentMethodRevenue,
      revenue_over_time: revenueOverTime,
      revenue_by_discount: revenueByDiscount,
      revenue_by_plan: revenueByPlan,
      summary: summary
    };
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    throw error;
  }
}