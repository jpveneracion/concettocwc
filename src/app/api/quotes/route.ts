import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { QuotePayload } from '@/types';

export async function GET() {
  try {
    const quotes = await sql`
      SELECT id, quote_number, customer_name, customer_address,
             quote_date, our_ref, status,
             installation_fee::float, delivery_fee::float,
             subtotal::float, total::float,
             total_area::float, panel_count,
             created_at, updated_at
      FROM quotes
      ORDER BY created_at DESC
    `;
    return NextResponse.json(quotes);
  } catch (err) {
    console.error('GET /api/quotes', err);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: QuotePayload = await req.json();
    const {
      quote_number, customer_name, customer_address, quote_date,
      our_ref, installation_fee, delivery_fee, items,
    } = body;

    if (!customer_name || !items?.length) {
      return NextResponse.json(
        { error: 'customer_name and at least one item are required' },
        { status: 400 }
      );
    }

    const subtotal = items.reduce((s, i) => s + i.retail_amount, 0);
    const total = subtotal + installation_fee + delivery_fee;
    const total_area = items.reduce((s, i) => s + i.area_sqft, 0);
    const panel_count = items.length;

    const [quote] = await sql`
      INSERT INTO quotes (
        quote_number, customer_name, customer_address, quote_date,
        our_ref, installation_fee, delivery_fee,
        subtotal, total, total_area, panel_count
      ) VALUES (
        ${quote_number}, ${customer_name}, ${customer_address ?? ''},
        ${quote_date}, ${our_ref ?? ''},
        ${installation_fee}, ${delivery_fee},
        ${subtotal}, ${total}, ${total_area}, ${panel_count}
      )
      RETURNING id, quote_number, created_at
    `;

    // Insert items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await sql`
        INSERT INTO quote_items (
          quote_id, sort_order, location,
          product_id, product_code, product_collection, product_description,
          unit, is_fixed,
          measured_width, measured_drop, final_width, final_drop,
          area_sqft, retail_price_sqft, supplier_cost_sqft,
          retail_amount, supplier_amount
        ) VALUES (
          ${quote.id}, ${i},
          ${item.location ?? ''},
          ${item.product_id || null},
          ${item.product_code ?? ''},
          ${item.product_collection ?? ''},
          ${item.product_description ?? ''},
          ${item.unit}, ${item.is_fixed},
          ${item.measured_width}, ${item.measured_drop},
          ${item.final_width}, ${item.final_drop},
          ${item.area_sqft},
          ${item.retail_price_sqft}, ${item.supplier_cost_sqft},
          ${item.retail_amount}, ${item.supplier_amount}
        )
      `;
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    console.error('POST /api/quotes', err);
    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 });
  }
}
