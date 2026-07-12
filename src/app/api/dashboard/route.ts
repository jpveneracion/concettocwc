import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { decryptPII } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    // Read custom session cookie (the one that actually works in this system)
    const sessionCookie = req.cookies.get('session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ error: 'Unauthorized - invalid session' }, { status: 401 });
    }

    const { userId, companyId, email } = sessionData;

    if (!userId || !companyId) {
      return NextResponse.json({ error: 'Unauthorized - incomplete session' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const period = (searchParams.get('period') as 'month' | 'year' | 'custom') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate date range
    let dateStart: string;
    let dateEnd: string;

    if (period === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      dateStart = firstDay.toISOString().split('T')[0];
      dateEnd = now.toISOString().split('T')[0];
    } else if (period === 'year') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), 0, 1);
      dateStart = firstDay.toISOString().split('T')[0];
      dateEnd = now.toISOString().split('T')[0];
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
      // Revenue trends (last 6 months)
      getRevenueTrends(companyId),
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
  const result = await sql`
    SELECT COALESCE(SUM(total), 0) as sales
    FROM quotes
    WHERE company_id = ${companyId}
      AND status IN ('delivered', 'sent')
      AND quote_date >= ${startDate}
      AND quote_date <= ${endDate}
  `;
  return Number(result[0]?.sales || 0);
}

async function getYearlySales(companyId: string): Promise<number> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const dateStart = firstDay.toISOString().split('T')[0];
  const dateEnd = now.toISOString().split('T')[0];

  const result = await sql`
    SELECT COALESCE(SUM(total), 0) as sales
    FROM quotes
    WHERE company_id = ${companyId}
      AND status IN ('delivered', 'sent')
      AND quote_date >= ${dateStart}
      AND quote_date <= ${dateEnd}
  `;
  return Number(result[0]?.sales || 0);
}

async function getProfitAndCost(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{ profit: number; profitMargin: number }> {
  const result = await sql`
    SELECT
      COALESCE(SUM(retail_amount), 0) as revenue,
      COALESCE(SUM(supplier_amount), 0) as cost
    FROM quote_items qi
    JOIN quotes q ON qi.quote_id = q.id
    WHERE q.company_id = ${companyId}
      AND q.status IN ('delivered', 'sent')
      AND q.quote_date >= ${startDate}
      AND q.quote_date <= ${endDate}
  `;

  const revenue = Number(result[0]?.revenue || 0);
  const cost = Number(result[0]?.cost || 0);
  const profit = revenue - cost;
  const profitMargin = revenue > 0 ? profit / revenue : 0;

  return { profit, profitMargin };
}

async function getConversionRate(companyId: string, startDate: string, endDate: string): Promise<number> {
  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'delivered')::FLOAT / NULLIF(COUNT(*), 0) as rate
    FROM quotes
    WHERE company_id = ${companyId}
      AND quote_date >= ${startDate}
      AND quote_date <= ${endDate}
  `;
  return Number(result[0]?.rate || 0);
}

async function getAverageOrderValue(companyId: string, startDate: string, endDate: string): Promise<number> {
  const result = await sql`
    SELECT AVG(total) as avg_order
    FROM quotes
    WHERE company_id = ${companyId}
      AND status IN ('delivered', 'sent')
      AND quote_date >= ${startDate}
      AND quote_date <= ${endDate}
  `;
  return Number(result[0]?.avg_order || 0);
}

async function getRevenueTrends(companyId: string) {
  const result = await sql`
    SELECT
      TO_CHAR(quote_date, 'Mon') as month,
      EXTRACT(MONTH FROM quote_date) as month_num,
      SUM(total) as revenue
    FROM quotes
    WHERE company_id = ${companyId}
      AND status IN ('delivered', 'sent')
      AND quote_date >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
    GROUP BY month, month_num
    ORDER BY month_num
  `;

  return result.map((row: any) => ({
    month: row.month,
    revenue: Number(row.revenue),
  }));
}

async function getPopularCollections(
  companyId: string,
  startDate: string,
  endDate: string
) {
  const result = await sql`
    SELECT
      product_collection,
      COUNT(*) as count,
      SUM(qi.retail_amount) as revenue
    FROM quote_items qi
    JOIN quotes q ON qi.quote_id = q.id
    WHERE q.company_id = ${companyId}
      AND q.status IN ('delivered', 'sent')
      AND q.quote_date >= ${startDate}
      AND q.quote_date <= ${endDate}
    GROUP BY product_collection
    ORDER BY count DESC
    LIMIT 10
  `;

  return result.map((row: any) => ({
    collection: row.product_collection,
    count: Number(row.count),
    revenue: Number(row.revenue),
  }));
}

async function getTopCustomers(companyId: string, startDate: string, endDate: string) {
  const result = await sql`
    SELECT
      customer_name_encrypted,
      SUM(total) as total_revenue,
      COUNT(*) as quote_count
    FROM quotes
    WHERE company_id = ${companyId}
      AND status IN ('delivered', 'sent')
      AND quote_date >= ${startDate}
      AND quote_date <= ${endDate}
    GROUP BY customer_name_encrypted
    ORDER BY total_revenue DESC
    LIMIT 10
  `;

  return result.map((row: any) => ({
    customerName: row.customer_name_encrypted
      ? decryptPII(Buffer.from(row.customer_name_encrypted))
      : 'Unknown',
    totalRevenue: Number(row.total_revenue),
    quoteCount: Number(row.quote_count),
  }));
}

async function getQuoteStats(companyId: string, startDate: string, endDate: string) {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status NOT IN ('delivered', 'cancelled')) as pending
    FROM quotes
    WHERE company_id = ${companyId}
      AND quote_date >= ${startDate}
      AND quote_date <= ${endDate}
  `;

  return {
    total: Number(result[0]?.total || 0),
    delivered: Number(result[0]?.delivered || 0),
    pending: Number(result[0]?.pending || 0),
  };
}
