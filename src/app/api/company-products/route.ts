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
      // Check pricing for specific product
      const [pricing] = await sql`
        SELECT supplier_cost::float, retail_price::float
        FROM company_products
        WHERE company_id = ${session.companyId} AND product_id = ${productId}::uuid
      `;
      return NextResponse.json(pricing || { supplier_cost: 0, retail_price: 0 });
    }

    // Check if company has any pricing at all
    const [count] = await sql`
      SELECT COUNT(*) as count
      FROM company_products
      WHERE company_id = ${session.companyId}
    `;

    const hasPricing = Number(count.count) > 0;
    return NextResponse.json({ hasPricing, count: Number(count.count) });
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

    const [pricing] = await sql`
      INSERT INTO company_products (company_id, product_id, supplier_cost, retail_price)
      VALUES (${session.companyId}, ${product_id}::uuid, ${supplier_cost}, ${retail_price})
      ON CONFLICT (company_id, product_id) DO UPDATE SET
        supplier_cost = EXCLUDED.supplier_cost,
        retail_price = EXCLUDED.retail_price
      RETURNING id, supplier_cost::float, retail_price::float
    `;

    return NextResponse.json(pricing);
  } catch (err) {
    console.error('POST /api/company-products', err);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
