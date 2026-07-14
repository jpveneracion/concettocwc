// src/app/api/admin/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { sql } from '@/lib/db';
import {
  DashboardAnalytics,
  PaymentMethod,
  SubscriptionPlan,
  PaymentMethodStats,
  DiscountStats,
  PlanStats,
  RevenueDataPoint,
  UsageDataPoint
} from '@/types/subscription';

// Database query result interfaces
interface PaymentMethodRow {
  payment_method: string;
  total_amount: number;
  count: number;
}

interface CountResult {
  count: string;
}

interface PaymentMethodDistributionRow {
  payment_method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface DiscountDistributionRow {
  discount_percent: number;
  count: number;
  total_amount: number;
}

interface PlanDistributionRow {
  subscription_plan: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface RevenueOverTimeRow {
  date: string;
  gcash: number;
  crypto: number;
  usd: number;
  total: number;
}

interface UsageOverTimeRow {
  date: string;
  generated: number;
  used: number;
  pending: number;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

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

    const total_gcash_payments = (paymentMethodResult as PaymentMethodRow[]).find((row: PaymentMethodRow) => row.payment_method === 'gcash')?.total_amount || 0;
    const total_crypto_payments = (paymentMethodResult as PaymentMethodRow[]).find((row: PaymentMethodRow) => row.payment_method === 'crypto')?.total_amount || 0;
    const total_usd_payments = (paymentMethodResult as PaymentMethodRow[]).find((row: PaymentMethodRow) => row.payment_method === 'usd_bank')?.total_amount || 0;

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
        u.subscription_plan,
        COUNT(*) as count,
        COALESCE(SUM(ac.payment_amount_usd), 0) as revenue,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM users u
      LEFT JOIN activation_codes ac ON u.activation_code = ac.code
      WHERE u.subscription_activated = true
      AND u.subscription_plan IS NOT NULL
      AND u.created_at >= $1
      GROUP BY u.subscription_plan
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

    // Transform database results to proper typed interfaces
    const paymentMethodStats: PaymentMethodStats[] = (paymentMethodDistribution as PaymentMethodDistributionRow[]).map((row: PaymentMethodDistributionRow) => ({
      method: row.payment_method as PaymentMethod,
      amount: row.amount,
      count: row.count,
      percentage: row.percentage
    }));

    const discountStats: DiscountStats[] = (discountDistribution as DiscountDistributionRow[]).map((row: DiscountDistributionRow) => ({
      discount_percent: row.discount_percent,
      count: row.count,
      total_amount: row.total_amount
    }));

    const planDistributionTyped: PlanStats[] = (planDistribution as PlanDistributionRow[]).map((row: PlanDistributionRow) => ({
      plan: row.subscription_plan as SubscriptionPlan,
      count: row.count,
      revenue: row.revenue,
      percentage: row.percentage
    }));

    const revenueOverTimeTyped: RevenueDataPoint[] = (revenueOverTime as RevenueOverTimeRow[]).map((row: RevenueOverTimeRow) => ({
      date: row.date,
      gcash: row.gcash,
      crypto: row.crypto,
      usd: row.usd,
      total: row.total
    }));

    const usageOverTimeTyped: UsageDataPoint[] = (usageOverTime as UsageOverTimeRow[]).map((row: UsageOverTimeRow) => ({
      date: row.date,
      generated: row.generated,
      used: row.used,
      pending: row.pending
    }));

    return {
      total_gcash_payments,
      total_crypto_payments,
      total_usd_payments,
      active_subscriptions,
      pending_codes,
      average_revenue_per_user: avg_revenue_per_user,
      trial_to_conversion_rate,
      payment_method_distribution: paymentMethodStats,
      discount_distribution: discountStats,
      plan_distribution: planDistributionTyped,
      revenue_over_time: revenueOverTimeTyped,
      activation_usage_over_time: usageOverTimeTyped
    };

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    throw error;
  }
}