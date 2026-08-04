import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Check if company has pricing for products
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id');

    if (productId) {
      // Check pricing for specific product using SECURITY DEFINER function
      const pricingResult = await sql(
        'SELECT get_company_product_pricing($1::uuid, $2::uuid) as pricing',
        [session.companyId, productId]
      );

      if (pricingResult.length > 0) {
        const pricing = JSON.parse(pricingResult[0].pricing);
        return NextResponse.json(pricing || { supplier_cost: 0, retail_price: 0 });
      }

      return NextResponse.json({ supplier_cost: 0, retail_price: 0 });
    }

    // Check if company has any pricing at all using SECURITY DEFINER function
    const countResult = await sql(
      'SELECT count_company_products($1::uuid) as count_data',
      [session.companyId]
    );

    if (countResult.length > 0) {
      const countData = JSON.parse(countResult[0].count_data);
      const hasPricing = Number(countData.count) > 0;
      return NextResponse.json({ hasPricing, count: Number(countData.count) });
    }

    return NextResponse.json({ hasPricing: false, count: 0 });
  } catch (err) {
    console.error('GET /api/company-products', err);
    return NextResponse.json({ error: 'Failed to check pricing' }, { status: 500 });
  }
}

// POST - Set pricing for a product
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, supplier_cost, retail_price } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    if (supplier_cost === undefined || retail_price === undefined) {
      return NextResponse.json({ error: 'supplier_cost and retail_price are required' }, { status: 400 });
    }

    // Use SECURITY DEFINER function for upsert
    const result = await sql(
      'SELECT upsert_company_product($1::uuid, $2::uuid, $3::numeric, $4::numeric) as result',
      [session.companyId, product_id, supplier_cost, retail_price]
    );

    if (result.length > 0) {
      const pricingResult = JSON.parse(result[0].result);

      if (!pricingResult.success) {
        return NextResponse.json({ error: pricingResult.error || 'Failed to save pricing' }, { status: 500 });
      }

      return NextResponse.json({
        id: pricingResult.id,
        supplier_cost: pricingResult.supplier_cost,
        retail_price: pricingResult.retail_price
      });
    }

    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  } catch (err) {
    console.error('POST /api/company-products', err);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
