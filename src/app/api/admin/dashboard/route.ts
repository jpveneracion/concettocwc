// src/app/api/admin/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import {
  DashboardAnalytics,
  PaymentMethod,
  SubscriptionPlan
} from '@/types/subscription';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();

    // Admin access verified - only admin users can access analytics

    // Get date range from query params (default: last 30 days)
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch analytics data
    const analytics = await getDashboardAnalytics(startDate);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getDashboardAnalytics(startDate: Date): Promise<DashboardAnalytics> {

  try {
    // Total payments by method
    const paymentMethodResult = await sql(`
      SELECT
        payment_method,
        COALESCE(SUM(payment_amount), 0) as total_amount,
        COUNT(*) as count
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY payment_method
    `, [startDate]);

    const total_gcash_payments = paymentMethodResult.find((row: any) => row.payment_method === 'gcash')?.total_amount || 0;
    const total_crypto_payments = paymentMethodResult.find((row: any) => row.payment_method === 'crypto')?.total_amount || 0;
    const total_usd_payments = paymentMethodResult.find((row: any) => row.payment_method === 'usd_bank')?.total_amount || 0;

    // Active subscriptions
    const activeSubsResult = await sql(`
      SELECT COUNT(*) FROM users WHERE subscription_activated = true
    `);
    const active_subscriptions = parseInt(activeSubsResult[0]?.count || '0');

    // Pending codes
    const pendingResult = await sql(`
      SELECT COUNT(*) FROM activation_codes
      WHERE is_active = true AND used_by IS NULL
    `);
    const pending_codes = parseInt(pendingResult[0]?.count || '0');

    // Average revenue per user
    const totalRevenue = total_gcash_payments + total_crypto_payments + total_usd_payments;
    const avg_revenue_per_user = active_subscriptions > 0
      ? totalRevenue / active_subscriptions
      : 0;

    // Trial to conversion rate
    const totalSignupsResult = await sql(`
      SELECT COUNT(*) FROM users WHERE created_at >= $1
    `, [startDate]);
    const total_signups = parseInt(totalSignupsResult[0]?.count || '0');
    const trial_to_conversion_rate = total_signups > 0
      ? (active_subscriptions / total_signups) * 100
      : 0;

    // Payment method distribution
    const paymentMethodDistribution = await sql(`
      SELECT
        payment_method,
        COALESCE(SUM(payment_amount), 0) as amount,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY payment_method
      ORDER BY amount DESC
    `, [startDate]);

    // Discount distribution
    const discountDistribution = await sql(`
      SELECT
        discount_percent,
        COUNT(*) as count,
        COALESCE(SUM(payment_amount), 0) as total_amount
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY discount_percent
      ORDER BY discount_percent
    `, [startDate]);

    // Plan distribution
    const planDistribution = await sql(`
      SELECT
        subscription_plan,
        COUNT(*) as count,
        COALESCE(SUM(payment_amount), 0) as revenue,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM users
      WHERE subscription_activated = true
      AND subscription_plan IS NOT NULL
      GROUP BY subscription_plan
      ORDER BY revenue DESC
    `, [startDate]);

    // Revenue over time (daily)
    const revenueOverTime = await sql(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(CASE WHEN payment_method = 'gcash' THEN payment_amount ELSE 0 END), 0) as gcash,
        COALESCE(SUM(CASE WHEN payment_method = 'crypto' THEN payment_amount ELSE 0 END), 0) as crypto,
        COALESCE(SUM(CASE WHEN payment_method = 'usd_bank' THEN payment_amount ELSE 0 END), 0) as usd,
        COALESCE(SUM(payment_amount), 0) as total
      FROM activation_codes
      WHERE used_at IS NOT NULL
      AND created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [startDate]);

    // Activation usage over time
    const usageOverTime = await sql(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE used_by IS NULL) as generated,
        COUNT(*) FILTER (WHERE used_by IS NOT NULL) as used,
        COUNT(*) FILTER (WHERE used_by IS NULL) as pending
      FROM activation_codes
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [startDate]);

    return {
      total_gcash_payments,
      total_crypto_payments,
      total_usd_payments,
      active_subscriptions,
      pending_codes,
      average_revenue_per_user: avg_revenue_per_user,
      trial_to_conversion_rate,
      payment_method_distribution: paymentMethodDistribution as any,
      discount_distribution: discountDistribution as any,
      plan_distribution: planDistribution as any,
      revenue_over_time: revenueOverTime as any,
      activation_usage_over_time: usageOverTime as any
    };

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    throw error;
  }
}