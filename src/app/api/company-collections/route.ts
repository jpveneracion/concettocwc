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
      // Get pricing for specific collection using SECURITY DEFINER function
      const [pricing] = await sql('SELECT get_company_collection_pricing($1::uuid, $2) as pricing', [session.companyId, collection]);
      const pricingData = pricing?.pricing ? JSON.parse(pricing.pricing) : { supplier_cost: 0, retail_price: 0 };
      return NextResponse.json(pricingData);
    }

    // Get all collections with pricing using SECURITY DEFINER function
    const collectionsResult = await sql('SELECT get_company_collections($1::uuid) as collection', [session.companyId]);
    const collections = collectionsResult.map(row => {
      const collectionData = row.collection;
      return {
        collection: collectionData.collection,
        supplier_cost: parseFloat(collectionData.supplier_cost),
        retail_price: parseFloat(collectionData.retail_price)
      };
    });

    // Get all unique collections using SECURITY DEFINER function
    let allCollections;

    if (session.isAdmin) {
      // Admins see all collections from both tables
      allCollections = await sql('SELECT get_all_collections_for_admin()');
    } else {
      // Non-admins see global collections + their own company's collections
      allCollections = await sql('SELECT get_company_collections_with_products($1::uuid)', [session.companyId]);
    }

    // Merge to show which collections have pricing and which don't
    const merged = allCollections.map((c) => {
      const raw = Object.values(c)[0];
      const collectionData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const pricing = collections.find((p) => p.collection === collectionData.collection);
      return {
        collection: collectionData.collection,
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

    const [pricing] = await sql('SELECT upsert_company_collection($1::uuid, $2, $3, $4) as collection', [session.companyId, collection, supplier_cost, retail_price]);
    const pricingData = pricing?.collection || {
      collection: collection,
      supplier_cost: parseFloat(supplier_cost),
      retail_price: parseFloat(retail_price)
    };

    return NextResponse.json(pricingData);
  } catch (err) {
    console.error('POST /api/company-collections', err);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
