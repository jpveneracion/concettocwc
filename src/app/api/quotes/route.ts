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

export async function GET() {
  try {
    const companyId = await getCompanyId();
    const quotes = await sql`
      SELECT id, quote_number, customer_name, customer_address,
             customer_name_encrypted, customer_address_encrypted,
             quote_date, our_ref, status,
             installation_fee::float, delivery_fee::float,
             subtotal::float, total::float,
             total_area::float, panel_count,
             created_at, updated_at
      FROM quotes
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
    `;

    // Decrypt PII for response
    const decryptedQuotes = quotes.map((q: any) => ({
      ...q,
      customer_name: q.customer_name_encrypted
        ? decryptPII(q.customer_name_encrypted)
        : q.customer_name,
      customer_address: q.customer_address_encrypted
        ? decryptPII(q.customer_address_encrypted)
        : q.customer_address,
    }));

    return NextResponse.json(decryptedQuotes);
  } catch (err) {
    console.error('GET /api/quotes', err);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const companyId = await getCompanyId();
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

    // Encrypt PII
    const customerNameEncrypted = encryptPII(customer_name);
    const customerAddressEncrypted = encryptPII(customer_address ?? '');

    // IMMEDIATE VERIFICATION: Decrypt and compare to ensure encryption worked
    const nameDecrypted = decryptPII(customerNameEncrypted);
    const addressDecrypted = decryptPII(customerAddressEncrypted);

    if (nameDecrypted !== customer_name || addressDecrypted !== (customer_address ?? '')) {
      console.error('Encryption verification failed - mismatch detected');
      return NextResponse.json(
        { error: 'Encryption verification failed. Please try again.' },
        { status: 500 }
      );
    }

    const [quote] = await sql`
      INSERT INTO quotes (
        company_id, quote_number, customer_name, customer_address,
        customer_name_encrypted, customer_address_encrypted,
        quote_date, our_ref, installation_fee, delivery_fee,
        subtotal, total, total_area, panel_count
      ) VALUES (
        ${companyId}, ${quote_number}, ${customer_name}, ${customer_address ?? ''},
        ${customerNameEncrypted}, ${customerAddressEncrypted},
        ${quote_date}, ${our_ref ?? ''},
        ${installation_fee}, ${delivery_fee},
        ${subtotal}, ${total}, ${total_area}, ${panel_count}
      )
      RETURNING id, quote_number, customer_name, customer_address, created_at
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

    // After successful insert, delete plaintext columns immediately
    await sql`
      UPDATE quotes
      SET customer_name = NULL, customer_address = NULL
      WHERE id = ${quote.id}
    `;

    return NextResponse.json({
      ...quote,
      customer_name,
      customer_address,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/quotes', err);
    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 });
  }
}
