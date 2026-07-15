import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Get all collections with pricing
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');

    if (collection) {
      // Get pricing for specific collection
      const [pricing] = await sql`
        SELECT supplier_cost::float, retail_price::float
        FROM company_collections
        WHERE company_id = ${session.companyId} AND collection = ${collection}
      `;
      return NextResponse.json(pricing || { supplier_cost: 0, retail_price: 0 });
    }

    // Get all collections with pricing
    const collections = await sql`
      SELECT collection, supplier_cost::float, retail_price::float
      FROM company_collections
      WHERE company_id = ${session.companyId}
      ORDER BY collection ASC
    `;

    // Get all unique collections from both products (global) and company_product_definitions (company-specific)
    let allCollections;

    if (session.isAdmin) {
      // Admins see all collections from both tables
      allCollections = await sql`
        SELECT DISTINCT collection
        FROM products
        WHERE collection IS NOT NULL AND collection != ''
        UNION
        SELECT DISTINCT collection
        FROM company_product_definitions
        WHERE collection IS NOT NULL AND collection != ''
        ORDER BY collection ASC
      `;
    } else {
      // Non-admins see global collections + their own company's collections
      allCollections = await sql`
        SELECT DISTINCT collection
        FROM products
        WHERE collection IS NOT NULL AND collection != ''
        UNION
        SELECT DISTINCT collection
        FROM company_product_definitions
        WHERE collection IS NOT NULL AND collection != '' AND company_id = ${session.companyId}
        ORDER BY collection ASC
      `;
    }

    // Merge to show which collections have pricing and which don't
    const merged = allCollections.map((c) => {
      const pricing = collections.find((p) => p.collection === c.collection);
      return {
        collection: c.collection,
        supplier_cost: pricing?.supplier_cost || 0,
        retail_price: pricing?.retail_price || 0,
        has_pricing: !!pricing,
      };
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error('GET /api/company-collections', err);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}

// POST - Set pricing for a collection
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { collection, supplier_cost, retail_price } = body;

    if (!collection) {
      return NextResponse.json({ error: 'collection is required' }, { status: 400 });
    }

    if (supplier_cost === undefined || retail_price === undefined) {
      return NextResponse.json({ error: 'supplier_cost and retail_price are required' }, { status: 400 });
    }

    const [pricing] = await sql`
      INSERT INTO company_collections (company_id, collection, supplier_cost, retail_price)
      VALUES (${session.companyId}, ${collection}, ${supplier_cost}, ${retail_price})
      ON CONFLICT (company_id, collection) DO UPDATE SET
        supplier_cost = EXCLUDED.supplier_cost,
        retail_price = EXCLUDED.retail_price
      RETURNING collection, supplier_cost::float, retail_price::float
    `;

    return NextResponse.json(pricing);
  } catch (err) {
    console.error('POST /api/company-collections', err);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
