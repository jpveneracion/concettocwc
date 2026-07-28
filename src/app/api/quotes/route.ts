import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { encryptPII, decryptPII } from '@/lib/crypto';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { validateQuoteCreation, restrictionErrorResponse } from '@/lib/api-restrictions';
import { calcAmounts } from '@/lib/calc';
import { setTenantContext, resetTenantContext } from '@/lib/rls';
import type { QuotePayload } from '@/types';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set RLS context for tenant isolation
    await setTenantContext(session.companyId, session.role || 'user');

    try {
      // Check subscription access
      const access = await checkSubscriptionAccess(session);

      // Allow read access even in readonly mode
      // RLS policies now handle company_id filtering automatically
      const quotes = await sql`
        SELECT id, quote_number, customer_name, customer_address,
               customer_name_encrypted, customer_address_encrypted,
               quote_date, our_ref, status,
               installation_fee::float, delivery_fee::float,
               subtotal::float, total::float,
               total_area::float, panel_count,
               created_at, updated_at
        FROM quotes
        ORDER BY created_at DESC
      `;

      // Decrypt PII for response
      const decryptedQuotes = quotes.map((q) => {
        let customerName = q.customer_name as string | null;
        let customerAddress = q.customer_address as string | null;

        try {
          if (q.customer_name_encrypted) {
            customerName = decryptPII(q.customer_name_encrypted as string);
          }
        } catch (err) {
          console.error(`Failed to decrypt customer_name for quote ${q.id}:`, err);
        }

        try {
          if (q.customer_address_encrypted) {
            customerAddress = decryptPII(q.customer_address_encrypted as string);
          }
        } catch (err) {
          console.error(`Failed to decrypt customer_address for quote ${q.id}:`, err);
        }

        return {
          ...q,
          customer_name: customerName,
          customer_address: customerAddress,
        };
      });

      return NextResponse.json({
        companyCode: session.companyCode,
        quotes: decryptedQuotes,
        accessMode: access.mode,
        subscriptionRequired: !access.allowed && access.mode !== 'readonly'
      });
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
  } catch (err) {
    console.error('GET /api/quotes', err);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set RLS context for tenant isolation
    await setTenantContext(session.companyId, session.role || 'user');

    try {
      // Parse request body early for trial restriction validation
      const body: QuotePayload = await req.json();
      const { quote_date } = body;

      // Validate trial restrictions for quote creation
      if (quote_date) {
        const validationResult = await validateQuoteCreation(
          session,
          new Date(quote_date)
        );

        if (!validationResult.allowed) {
          return restrictionErrorResponse(validationResult);
        }
      }

      // Check subscription access - require full access for quote creation
      const access = await checkSubscriptionAccess(session);
      if (access.mode !== 'full') {
        return NextResponse.json({
          error: 'Subscription required for quote creation',
          checkoutUrl: '/subscription/checkout',
          mode: access.mode,
          reason: access.reason
        }, { status: 402 });
      }

    const {
      quote_number, customer_name, customer_address,
      our_ref, installation_fee, delivery_fee, items,
    } = body;

    if (!customer_name || !items?.length) {
      return NextResponse.json(
        { error: 'customer_name and at least one item are required' },
        { status: 400 }
      );
    }

    // Fetch company minimum billable area once (server-authoritative).
    // We NEVER trust client-supplied retail_amount/supplier_amount/minimum_applied —
    // they are recomputed here from the real area + price + company minimum.
    const [company] = await sql`
      SELECT minimum_area_sqft::float AS minimum_area_sqft
      FROM companies WHERE id = ${session.companyId}
    `;
    const minimumArea = company?.minimum_area_sqft ?? 0;

    const processedItems = items.map((item) => {
      const { retail_amount, supplier_amount, minimum_applied } = calcAmounts(
        item.area_sqft, item.retail_price_sqft, item.supplier_cost_sqft, minimumArea
      );
      return { ...item, retail_amount, supplier_amount, minimum_applied };
    });

    const subtotal = processedItems.reduce((s, i) => s + i.retail_amount, 0);
    const total = subtotal + installation_fee + delivery_fee;
    // total_area uses the REAL measured area, not the floored billed area.
    const total_area = processedItems.reduce((s, i) => s + i.area_sqft, 0);
    const panel_count = processedItems.length;

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
        ${session.companyId}, ${quote_number}, ${customer_name}, ${customer_address ?? ''},
        decode(${customerNameEncrypted}, 'hex')::bytea, decode(${customerAddressEncrypted}, 'hex')::bytea,
        ${quote_date}, ${our_ref ?? ''},
        ${installation_fee}, ${delivery_fee},
        ${subtotal}, ${total}, ${total_area}, ${panel_count}
      )
      RETURNING id, quote_number, customer_name, customer_address, created_at
    `;

    // Insert items (iterate processedItems so we persist server-computed amounts)
    for (let i = 0; i < processedItems.length; i++) {
      const item = processedItems[i];
      await sql`
        INSERT INTO quote_items (
          quote_id, sort_order, location,
          product_id, product_code, product_collection, product_description,
          unit, is_fixed,
          measured_width, measured_drop, final_width, final_drop,
          area_sqft, retail_price_sqft, supplier_cost_sqft,
          retail_amount, supplier_amount, minimum_applied
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
          ${item.retail_amount}, ${item.supplier_amount}, ${item.minimum_applied}
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
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
  } catch (err) {
    console.error('POST /api/quotes', err);
    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 });
  }
}
