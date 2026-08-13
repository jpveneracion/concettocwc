// src/app/api/admin/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { sql } from '@/lib/db';
import { safeParseJSON } from '@/lib/json';
import {
  DashboardAnalytics,
  PaymentMethod,
  SubscriptionPlan,
  SubscriptionPlanDetails,
  SubscriptionPlanInterval,
  SubscriptionPlanStatus,
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
    // Total payments by method using SECURITY DEFINER function
    const paymentMethodResult = await sql(
      'SELECT get_dashboard_payment_method_stats($1::timestamp with time zone) as stats',
      [startDate]
    );

    let total_gcash_payments = 0, total_crypto_payments = 0, total_usd_payments = 0;

    if (paymentMethodResult.length > 0) {
      const statsData = paymentMethodResult.map((row: any) => safeParseJSON(row.stats));
      total_gcash_payments = statsData.find((row: PaymentMethodRow) => row.payment_method === 'gcash')?.total_amount || 0;
      total_crypto_payments = statsData.find((row: PaymentMethodRow) => row.payment_method === 'crypto')?.total_amount || 0;
      total_usd_payments = statsData.find((row: PaymentMethodRow) => row.payment_method === 'usd_bank')?.total_amount || 0;
    }

    // Active subscriptions using SECURITY DEFINER function
    const activeSubsResult = await sql('SELECT get_dashboard_active_subscriptions_count() as count');
    const active_subscriptions = parseInt(activeSubsResult[0]?.count ? safeParseJSON(activeSubsResult[0].count).count : '0');

    // Pending codes using SECURITY DEFINER function
    const pendingResult = await sql('SELECT get_dashboard_pending_codes_count() as count');
    const pending_codes = parseInt(pendingResult[0]?.count ? safeParseJSON(pendingResult[0].count).count : '0');

    // Average revenue per user
    const totalRevenue = total_gcash_payments + total_crypto_payments + total_usd_payments;
    const avg_revenue_per_user = active_subscriptions > 0
      ? totalRevenue / active_subscriptions
      : 0;

    // Trial to conversion rate using SECURITY DEFINER function
    const totalSignupsResult = await sql(
      'SELECT get_dashboard_signups_count($1::timestamp with time zone) as count',
      [startDate]
    );
    const total_signups = parseInt(totalSignupsResult[0]?.count ? safeParseJSON(totalSignupsResult[0].count).count : '0');
    const trial_to_conversion_rate = total_signups > 0
      ? (active_subscriptions / total_signups) * 100
      : 0;

    // Payment method distribution using SECURITY DEFINER function
    const paymentMethodDistributionResult = await sql(
      'SELECT get_dashboard_payment_method_distribution($1::timestamp with time zone) as distribution',
      [startDate]
    );

    const paymentMethodDistribution = paymentMethodDistributionResult.map((row: any) => safeParseJSON(row.distribution));

    // Discount distribution using SECURITY DEFINER function
    const discountDistributionResult = await sql(
      'SELECT get_dashboard_discount_distribution($1::timestamp with time zone) as distribution',
      [startDate]
    );

    const discountDistribution = discountDistributionResult.map((row: any) => safeParseJSON(row.distribution));

    // Plan distribution using SECURITY DEFINER function
    const planDistributionResult = await sql(
      'SELECT get_dashboard_plan_distribution($1::timestamp with time zone) as distribution',
      [startDate]
    );

    const planDistribution = planDistributionResult.map((row: any) => safeParseJSON(row.distribution));

    // Revenue over time using SECURITY DEFINER function
    const revenueOverTimeResult = await sql(
      'SELECT get_dashboard_revenue_over_time($1::timestamp with time zone) as revenue_data',
      [startDate]
    );

    const revenueOverTime = revenueOverTimeResult.map((row: any) => safeParseJSON(row.revenue_data));

    // Activation usage over time using SECURITY DEFINER function
    const usageOverTimeResult = await sql(
      'SELECT get_dashboard_usage_over_time($1::timestamp with time zone) as usage_data',
      [startDate]
    );

    const usageOverTime = usageOverTimeResult.map((row: any) => safeParseJSON(row.usage_data));

    // Transform database results to proper typed interfaces
    const paymentMethodStats: PaymentMethodStats[] = paymentMethodDistribution.map((row: any) => ({
      method: row.payment_method as PaymentMethod,
      amount: row.amount,
      count: row.count,
      percentage: row.percentage
    }));

    const discountStats: DiscountStats[] = discountDistribution.map((row: any) => ({
      discount_percent: row.discount_percent,
      count: row.count,
      total_amount: row.total_amount
    }));

    const planDistributionTyped: PlanStats[] = planDistribution.map((row: any) => ({
      plan: {
        id: row.subscription_plan,
        name: row.subscription_plan,
        description: '',
        price: 0,
        currency: 'PHP',
        interval: 'month' as SubscriptionPlanInterval,
        discount_percent: 0,
        features: {},
        status: SubscriptionPlanStatus.ACTIVE,
        is_active: true,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      } as SubscriptionPlanDetails,
      count: row.count,
      revenue: row.revenue,
      percentage: row.percentage
    }));

    const revenueOverTimeTyped: RevenueDataPoint[] = revenueOverTime.map((row: any) => ({
      date: row.date,
      gcash: row.gcash,
      crypto: row.crypto,
      usd: row.usd,
      total: row.total
    }));

    const usageOverTimeTyped: UsageDataPoint[] = usageOverTime.map((row: any) => ({
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