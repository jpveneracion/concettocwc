import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { decryptPII } from '@/lib/crypto';
import { getUTCNow, createUTCDate } from '@/lib/utc-utils';

// TypeScript interfaces for SQL query results
interface RevenueTrendRow {
  label: string;
  revenue: string | number;
}

interface PopularCollectionRow {
  product_collection: string;
  count: string | number;
  revenue: string | number;
}

interface TopCustomerRow {
  customer_name_encrypted: string;
  total_revenue: string | number;
  quote_count: string | number;
}

export async function GET(req: NextRequest) {
  try {
    console.log('=== DASHBOARD API START ===');

    // Read custom session cookie (the one that actually works in this system)
    const sessionCookie = req.cookies.get('session');
    console.log('Session cookie found:', !!sessionCookie);

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
      console.log('Session data parsed:', { userId: sessionData.userId, companyId: sessionData.companyId });
    } catch {
      return NextResponse.json({ error: 'Unauthorized - invalid session' }, { status: 401 });
    }

    const { userId, companyId, email } = sessionData;

    if (!userId || !companyId) {
      return NextResponse.json({ error: 'Unauthorized - incomplete session' }, { status: 401 });
    }

    // Use SECURITY DEFINER function (no role context needed)
    // TEST: Use SECURITY DEFINER function like quotes API does
    const quotesTest = await sql('SELECT get_company_quotes($1::uuid) as quote', [companyId]);
    console.log('🧪 SECURITY DEFINER test:', quotesTest.length, 'quotes found');

    const searchParams = req.nextUrl.searchParams;
    const period = (searchParams.get('period') as 'month' | 'year' | 'custom' | 'all') || 'month';

    console.log('📊 Dashboard API called for company:', companyId, 'period:', period);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate date range
    let dateStart: string;
    let dateEnd: string;

    if (period === 'month') {
      const now = getUTCNow();
      const firstDay = createUTCDate(now.getUTCFullYear(), now.getUTCMonth(), 1);
      dateStart = firstDay.toISOString().split('T')[0];
      dateEnd = now.toISOString().split('T')[0];
    } else if (period === 'year') {
      const now = getUTCNow();
      const firstDay = createUTCDate(now.getUTCFullYear(), 0, 1);
      dateStart = firstDay.toISOString().split('T')[0];
      dateEnd = now.toISOString().split('T')[0];
    } else if (period === 'all') {
      // All time: include every quote (past and future-dated). Wide range avoids
      // refactoring every helper's (startDate, endDate) signature.
      dateStart = '1970-01-01';
      dateEnd = '9999-12-31';
    } else {
      // Custom range
      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'startDate and endDate required for custom period' },
          { status: 400 }
        );
      }
      dateStart = startDate;
      dateEnd = endDate;
    }

    // Query all metrics in parallel for performance
    const [
      monthlySales,
      yearlySales,
      profitAndCost,
      conversionRate,
      averageOrderValue,
      revenueTrends,
      popularCollections,
      topCustomers,
      quoteStats,
    ] = await Promise.all([
      // Monthly sales
      getMonthlySales(companyId, dateStart, dateEnd),
      // Yearly sales
      getYearlySales(companyId),
      // Profit vs capital
      getProfitAndCost(companyId, dateStart, dateEnd),
      // Conversion rate
      getConversionRate(companyId, dateStart, dateEnd),
      // Average order value
      getAverageOrderValue(companyId, dateStart, dateEnd),
      // Revenue trends (period-aware: monthly or yearly buckets)
      getRevenueTrends(companyId, period, dateStart, dateEnd),
      // Popular collections
      getPopularCollections(companyId, dateStart, dateEnd),
      // Top customers
      getTopCustomers(companyId, dateStart, dateEnd),
      // Quote stats (total, delivered, pending)
      getQuoteStats(companyId, dateStart, dateEnd),
    ]);

    const metrics = {
      monthlySales,
      yearlySales,
      profit: profitAndCost.profit,
      profitMargin: profitAndCost.profitMargin,
      conversionRate,
      totalQuotes: quoteStats.total,
      deliveredQuotes: quoteStats.delivered,
      pendingQuotes: quoteStats.pending,
      averageOrderValue,
      revenueTrends,
      popularCollections,
      topCustomers,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard metrics' },
      { status: 500 }
    );
  }
}

// Helper functions with SQL queries

async function getMonthlySales(companyId: string, startDate: string, endDate: string): Promise<number> {
  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT COALESCE(SUM((data->>'total')::numeric), 0) as sales, COUNT(*) as count
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'status') = 'delivered'
      AND (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
  `, [companyId, startDate, endDate]);
  console.log('📈 Monthly Sales query:', { companyId, startDate, endDate, result: result[0] });
  return Number(result[0]?.sales || 0);
}

async function getYearlySales(companyId: string): Promise<number> {
  const now = getUTCNow();
  const firstDay = createUTCDate(now.getUTCFullYear(), 0, 1);
  const dateStart = firstDay.toISOString().split('T')[0];
  const dateEnd = now.toISOString().split('T')[0];

  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT COALESCE(SUM((data->>'total')::numeric), 0) as sales
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'status') = 'delivered'
      AND (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
  `, [companyId, dateStart, dateEnd]);
  console.log('📊 Yearly Sales query:', { companyId, dateStart, dateEnd, result: result[0] });
  return Number(result[0]?.sales || 0);
}

async function getProfitAndCost(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{ profit: number; profitMargin: number }> {
  // Use SECURITY DEFINER function to bypass RLS for quote_items
  const result = await sql(`
    SELECT
      COALESCE(SUM((data->>'retail_amount')::numeric), 0) as revenue,
      COALESCE(SUM((data->>'supplier_amount')::numeric), 0) as cost
    FROM get_company_quote_items($1::uuid) as data
    WHERE data->>'quote_id' IN (
      SELECT (quote_data->>'id')::text
      FROM get_company_quotes($2::uuid) as quote_data
      WHERE (quote_data->>'quote_date') >= $3
        AND (quote_data->>'quote_date') <= $4
    )
  `, [companyId, companyId, startDate, endDate]);

  const revenue = Number(result[0]?.revenue || 0);
  const cost = Number(result[0]?.cost || 0);
  const profit = revenue - cost;
  const profitMargin = revenue > 0 ? profit / revenue : 0;

  console.log('💰 Profit and Cost:', { companyId, revenue, cost, profit, profitMargin });
  return { profit, profitMargin };
}

async function getConversionRate(companyId: string, startDate: string, endDate: string): Promise<number> {
  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT
      COUNT(*) FILTER (WHERE (data->>'status') = 'delivered')::FLOAT / NULLIF(COUNT(*), 0) as rate
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
  `, [companyId, startDate, endDate]);
  return Number(result[0]?.rate || 0);
}

async function getAverageOrderValue(companyId: string, startDate: string, endDate: string): Promise<number> {
  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT AVG((data->>'total')::numeric) as avg_order
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
  `, [companyId, startDate, endDate]);
  console.log('📊 Average Order Value:', { companyId, result: result[0] });
  return Number(result[0]?.avg_order || 0);
}

async function getRevenueTrends(
  companyId: string,
  period: 'month' | 'year' | 'custom' | 'all',
  dateStart: string,
  dateEnd: string
) {
  if (period === 'all') {
    // One bucket per year, all time - Use SECURITY DEFINER function
    const result = await sql(`
      SELECT
        EXTRACT(YEAR FROM (data->>'quote_date')::date)::TEXT as label,
        EXTRACT(YEAR FROM (data->>'quote_date')::date) as sort_key,
        SUM((data->>'total')::numeric) as revenue
      FROM get_company_quotes($1::uuid) as data
      GROUP BY label, sort_key
      ORDER BY sort_key
    `, [companyId]);
    console.log('📈 Revenue Trends (all time):', result.length, 'years');
    return result.map((row: Record<string, any>) => {
      const typedRow = row as RevenueTrendRow;
      return { label: typedRow.label, revenue: Number(typedRow.revenue) };
    });
  }

  // Monthly buckets. For 'month', use a trailing 6-month UTC window
  // (a single current-month window yields only one bar); for 'year'/'custom',
  // use the selected year's range passed in.
  let start = dateStart;
  let end = dateEnd;
  if (period === 'month') {
    const now = getUTCNow();
    const startMonth = createUTCDate(now.getUTCFullYear(), now.getUTCMonth() - 5, 1);
    start = startMonth.toISOString().split('T')[0];
    end = now.toISOString().split('T')[0];
  }

  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT
      TO_CHAR((data->>'quote_date')::date, 'Mon') as label,
      date_trunc('month', (data->>'quote_date')::date) as sort_key,
      SUM((data->>'total')::numeric) as revenue
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
    GROUP BY label, sort_key
    ORDER BY sort_key
  `, [companyId, start, end]);
  console.log('📈 Revenue Trends (monthly):', result.length, 'months');
  return result.map((row: Record<string, any>) => {
    const typedRow = row as RevenueTrendRow;
    return { label: typedRow.label, revenue: Number(typedRow.revenue) };
  });
}

async function getPopularCollections(
  companyId: string,
  startDate: string,
  endDate: string
) {
  // Use SECURITY DEFINER function to bypass RLS for quote_items
  const result = await sql(`
    SELECT
      (data->>'product_collection') as product_collection,
      COUNT(*) as count,
      SUM((data->>'retail_amount')::numeric) as revenue
    FROM get_company_quote_items($1::uuid) as data
    WHERE data->>'quote_id' IN (
      SELECT (quote_data->>'id')::text
      FROM get_company_quotes($2::uuid) as quote_data
      WHERE (quote_data->>'quote_date') >= $3
        AND (quote_data->>'quote_date') <= $4
    )
    GROUP BY (data->>'product_collection')
    ORDER BY count DESC
    LIMIT 10
  `, [companyId, companyId, startDate, endDate]);

  console.log('🏆 Popular Collections:', result.length, 'collections');
  return result.map((row: Record<string, any>) => {
    const typedRow = row as PopularCollectionRow;
    return {
      collection: typedRow.product_collection,
      count: Number(typedRow.count),
      revenue: Number(typedRow.revenue),
    };
  });
}

async function getTopCustomers(companyId: string, startDate: string, endDate: string) {
  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT
      (data->>'customer_name_encrypted') as customer_name_encrypted,
      SUM((data->>'total')::numeric) as total_revenue,
      COUNT(*) as quote_count
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
    GROUP BY (data->>'customer_name_encrypted')
    ORDER BY total_revenue DESC
    LIMIT 10
  `, [companyId, startDate, endDate]);

  console.log('👥 Top Customers:', result.length, 'customers');
  return result.map((row: Record<string, any>) => {
    const typedRow = row as TopCustomerRow;
    let customerName = 'Unknown';
    if (typedRow.customer_name_encrypted) {
      try {
        let encryptedData = typedRow.customer_name_encrypted;

        // Fix PostgreSQL hex format - remove '\x' prefix if present
        if (encryptedData.startsWith('\\x')) {
          encryptedData = encryptedData.substring(2);
        }

        // Direct hex decryption (confirmed working method)
        customerName = decryptPII(encryptedData);
      } catch (error) {
        console.warn('Failed to decrypt customer name:', error);
        customerName = '[Decryption Failed]';
      }
    } else if (typedRow.customer_name_encrypted === null || typedRow.customer_name_encrypted === undefined) {
      customerName = 'Unknown';
    }
    return {
      customerName,
      totalRevenue: Number(typedRow.total_revenue),
      quoteCount: Number(typedRow.quote_count),
    };
  });
}

async function getQuoteStats(companyId: string, startDate: string, endDate: string) {
  // Use SECURITY DEFINER function to bypass RLS
  const result = await sql(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE (data->>'status') = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE (data->>'status') NOT IN ('delivered', 'cancelled')) as pending
    FROM get_company_quotes($1::uuid) as data
    WHERE (data->>'quote_date') >= $2
      AND (data->>'quote_date') <= $3
  `, [companyId, startDate, endDate]);

  return {
    total: Number(result[0]?.total || 0),
    delivered: Number(result[0]?.delivered || 0),
    pending: Number(result[0]?.pending || 0),
  };
}
