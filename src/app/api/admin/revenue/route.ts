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
    // Total revenue by payment method
    const paymentMethodRevenue = await sql(`
      SELECT
        payment_method,
        COALESCE(SUM(payment_amount), 0) as total_amount,
        COUNT(*) as transaction_count,
        AVG(payment_amount) as avg_transaction_value
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `, [startDate]);

    // Revenue over time
    const revenueOverTime = await sql(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN payment_amount ELSE 0 END), 0) as gcash,
        COALESCE(SUM(CASE WHEN payment_method = 'crypto' THEN payment_amount ELSE 0 END), 0) as crypto,
        COALESCE(SUM(CASE WHEN payment_method = 'usd_bank' THEN payment_amount ELSE 0 END), 0) as usd_bank,
        COALESCE(SUM(CASE WHEN payment_method = 'other' THEN payment_amount ELSE 0 END), 0) as other,
        COALESCE(SUM(payment_amount), 0) as total
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [startDate]);

    // Revenue by discount tier
    const revenueByDiscount = await sql(`
      SELECT
        discount_percent,
        COUNT(*) as code_count,
        COALESCE(SUM(payment_amount), 0) as total_revenue,
        AVG(payment_amount) as avg_revenue_per_code
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY discount_percent
      ORDER BY discount_percent ASC
    `, [startDate]);

    // Revenue by subscription plan
    const revenueByPlan = await sql(`
      SELECT
        u.subscription_plan,
        COUNT(*) as subscription_count,
        COALESCE(SUM(ac.payment_amount), 0) as total_revenue,
        AVG(ac.payment_amount) as avg_revenue_per_subscription
      FROM users u
      INNER JOIN activation_codes ac ON u.activation_code = ac.code
      WHERE u.subscription_activated = true
      AND u.subscription_plan IS NOT NULL
      AND ac.used_at IS NOT NULL
      AND ac.created_at >= $1
      GROUP BY u.subscription_plan
      ORDER BY total_revenue DESC
    `, [startDate]);

    // Summary statistics
    const totalRevenue = await sql(`
      SELECT
        COALESCE(SUM(payment_amount), 0) as total_revenue,
        COUNT(*) as total_transactions,
        AVG(payment_amount) as avg_transaction_value
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
    `, [startDate]);

    return {
      payment_method_revenue: paymentMethodRevenue,
      revenue_over_time: revenueOverTime,
      revenue_by_discount: revenueByDiscount,
      revenue_by_plan: revenueByPlan,
      summary: totalRevenue[0] || {
        total_revenue: 0,
        total_transactions: 0,
        avg_transaction_value: 0
      }
    };
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    throw error;
  }
}