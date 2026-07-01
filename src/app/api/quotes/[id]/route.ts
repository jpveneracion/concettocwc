import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';
import { encryptPII, decryptPII } from '@/lib/crypto';
import type { QuotePayload } from '@/types';

async function getCompanyId() {
  const headerList = await headers();
  const companyId = headerList.get('x-company-id');
  if (!companyId) throw new Error('Unauthorized');
  return companyId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyId();
    const [quote] = await sql`
      SELECT id, quote_number, customer_name, customer_address,
             customer_name_encrypted, customer_address_encrypted,
             quote_date, our_ref, status,
             installation_fee::float, delivery_fee::float,
             subtotal::float, total::float,
             total_area::float, panel_count,
             created_at, updated_at
      FROM quotes
      WHERE id = ${id}::uuid AND company_id = ${companyId}
    `;
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const items = await sql`
      SELECT id, quote_id, sort_order, location,
             product_id, product_code, product_collection, product_description,
             unit, is_fixed,
             measured_width::float, measured_drop::float,
             final_width::float, final_drop::float,
             area_sqft::float,
             retail_price_sqft::float, supplier_cost_sqft::float,
             retail_amount::float, supplier_amount::float
      FROM quote_items
      WHERE quote_id = ${id}::uuid
      ORDER BY sort_order ASC
    `;

    return NextResponse.json({
      ...quote,
      customer_name: quote.customer_name_encrypted
        ? decryptPII(quote.customer_name_encrypted)
        : quote.customer_name,
      customer_address: quote.customer_address_encrypted
        ? decryptPII(quote.customer_address_encrypted)
        : quote.customer_address,
      items,
    });
  } catch (err) {
    console.error('GET /api/quotes/[id]', err);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyId();
    const body: QuotePayload = await req.json();
    const {
      customer_name, customer_address, quote_date,
      our_ref, installation_fee, delivery_fee, items,
    } = body;

    const subtotal = items.reduce((s, i) => s + i.retail_amount, 0);
    const total = subtotal + installation_fee + delivery_fee;
    const total_area = items.reduce((s, i) => s + i.area_sqft, 0);
    const panel_count = items.length;

    await sql`
      UPDATE quotes SET
        customer_name             = ${customer_name},
        customer_name_encrypted   = ${encryptPII(customer_name)},
        customer_address           = ${customer_address ?? ''},
        customer_address_encrypted = ${encryptPII(customer_address ?? '')},
        quote_date       = ${quote_date},
        our_ref          = ${our_ref ?? ''},
        installation_fee = ${installation_fee},
        delivery_fee     = ${delivery_fee},
        subtotal         = ${subtotal},
        total            = ${total},
        total_area       = ${total_area},
        panel_count      = ${panel_count},
        updated_at       = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}
    `;

    // Replace items
    await sql`DELETE FROM quote_items WHERE quote_id = ${id}::uuid`;

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
          ${id}::uuid, ${i},
          ${item.location ?? ''},
          ${item.product_id ?? null},
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT /api/quotes/[id]', err);
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyId();
    await sql`DELETE FROM quotes WHERE id = ${id}::uuid AND company_id = ${companyId}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/quotes/[id]', err);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
