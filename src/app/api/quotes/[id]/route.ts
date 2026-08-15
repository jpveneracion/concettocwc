import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { encryptPII, decryptPII } from '@/lib/crypto';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { calcAmounts } from '@/lib/calc';
import { setTenantContext, resetTenantContext } from '@/lib/rls';
import type { QuotePayload } from '@/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      // Use SECURITY DEFINER function for quote lookup
      const [quoteResult] = await sql('SELECT get_company_quote_by_id($1, $2) as quote', [session.companyId, id]);
      const quote = quoteResult?.quote;
      if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Use SECURITY DEFINER function for quote items lookup
    const itemsResult = await sql('SELECT get_quote_items($1) as items', [id]);
    const items = itemsResult.map(row => row.items);

    // Decrypt PII with error handling
    let customerName = quote.customer_name || '';
    let customerAddress = quote.customer_address || '';

    try {
      if (quote.customer_name_encrypted) {
        if (typeof quote.customer_name_encrypted === 'string') {
          // Strip PostgreSQL bytea '\x' prefix; Buffer.from(hex) stops at '\x'
          const hex = quote.customer_name_encrypted.startsWith('\\x')
            ? quote.customer_name_encrypted.substring(2)
            : quote.customer_name_encrypted;
          customerName = decryptPII(Buffer.from(hex, 'hex'));
        } else {
          customerName = decryptPII(quote.customer_name_encrypted);
        }
      }
    } catch (err) {
      console.error(`Failed to decrypt customer_name for quote ${quote.id}:`, err);
    }

    try {
      if (quote.customer_address_encrypted) {
        if (typeof quote.customer_address_encrypted === 'string') {
          // Strip PostgreSQL bytea '\x' prefix; Buffer.from(hex) stops at '\x'
          const hex = quote.customer_address_encrypted.startsWith('\\x')
            ? quote.customer_address_encrypted.substring(2)
            : quote.customer_address_encrypted;
          customerAddress = decryptPII(Buffer.from(hex, 'hex'));
        } else {
          customerAddress = decryptPII(quote.customer_address_encrypted);
        }
      }
    } catch (err) {
      console.error(`Failed to decrypt customer_address for quote ${quote.id}:`, err);
    }

    return NextResponse.json({
      ...quote,
      customer_name: customerName,
      customer_address: customerAddress,
      items,
      accessMode: access.mode,
      subscriptionRequired: !access.allowed && access.mode !== 'readonly'
    });
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set RLS context for tenant isolation
    await setTenantContext(session.companyId, session.role || 'user');

    try {
      // Check subscription access - require full access for quote updates
      const access = await checkSubscriptionAccess(session);
      if (access.mode !== 'full') {
        return NextResponse.json({
          error: 'Active subscription required for quote modifications',
          checkoutUrl: '/subscription/checkout',
          mode: access.mode,
          reason: access.reason
        }, { status: 403 });
      }

    const body: QuotePayload = await req.json();
    const {
      customer_name, customer_address, quote_date,
      our_ref, installation_fee, delivery_fee, items,
      status,
    } = body;

    // Fetch company minimum billable area using SECURITY DEFINER function
    const [companyResult] = await sql('SELECT get_company_settings($1) as company', [session.companyId]);
    const company = companyResult?.company;
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

    // Validate status if provided
    if (status && !['draft', 'sent', 'delivered', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: draft, sent, delivered, cancelled' },
        { status: 400 }
      );
    }

    // Encrypt PII
    const customerNameEncrypted = encryptPII(customer_name);
    const customerAddressEncrypted = encryptPII(customer_address ?? '');

    // IMMEDIATE VERIFICATION
    const nameDecrypted = decryptPII(customerNameEncrypted);
    const addressDecrypted = decryptPII(customerAddressEncrypted);

    if (nameDecrypted !== customer_name || addressDecrypted !== (customer_address ?? '')) {
      console.error('Encryption verification failed - mismatch detected');
      return NextResponse.json(
        { error: 'Encryption verification failed. Please try again.' },
        { status: 500 }
      );
    }

    // Update quote using SECURITY DEFINER function
    // Fetch existing quote first to preserve quote_number
    const [existingQuoteResult] = await sql('SELECT get_company_quote_by_id($1, $2) as quote', [session.companyId, id]);
    const quote = existingQuoteResult?.quote;
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Delivered quotes are locked: only customer information can be updated.
    if (quote.status === 'delivered') {
      if (status && status !== 'delivered') {
        return NextResponse.json(
          { error: 'Cannot change status from delivered.' },
          { status: 403 }
        );
      }

      const [existingItemsResult] = await sql('SELECT get_quote_items($1) as items', [id]);
      const existingItems = existingItemsResult.map((row: { items: any }) => row.items);

      const itemFields = [
        'location', 'product_id', 'product_code', 'product_collection',
        'product_description', 'unit', 'is_fixed', 'measured_width',
        'measured_drop', 'final_width', 'final_drop', 'area_sqft',
        'retail_price_sqft', 'supplier_cost_sqft', 'retail_amount',
        'supplier_amount', 'minimum_applied',
      ];
      const itemSig = (item: any) => itemFields.map((f) => String(item[f] ?? '')).join('|');
      const itemsSignature = (list: any[]) => list.map((i) => itemSig(i)).sort().join('\n');

      const itemsUnchanged = itemsSignature(existingItems) === itemsSignature(processedItems);
      const chargesUnchanged =
        Number(quote.installation_fee) === installation_fee &&
        Number(quote.delivery_fee) === delivery_fee;

      if (!itemsUnchanged || !chargesUnchanged) {
        return NextResponse.json(
          { error: 'This quote has been delivered and is locked. Only customer information can be updated.' },
          { status: 403 }
        );
      }
    }

    await sql('SELECT update_quote($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)', [
      id,
      session.companyId,
      quote.quote_number || '',
      customer_name,
      customer_address ?? '',
      '\\x' + customerNameEncrypted, // bytea hex format required (raw hex text would be stored as-is)
      '\\x' + customerAddressEncrypted,
      quote_date,
      our_ref ?? '',
      status || 'draft',
      installation_fee,
      delivery_fee,
      subtotal,
      total,
      total_area,
      panel_count
    ]);

    // Clear plaintext columns using SECURITY DEFINER function
    await sql('SELECT clear_quote_plaintext($1)', [id]);

    // Update quote items using SECURITY DEFINER function
    await sql('SELECT update_quote_items($1, $2)', [
      id,
      JSON.stringify(processedItems.map((item, index) => ({
        sort_order: index,
        location: item.location ?? '',
        product_id: item.product_id ?? null,
        product_code: item.product_code ?? '',
        product_collection: item.product_collection ?? '',
        product_description: item.product_description ?? '',
        unit: item.unit,
        is_fixed: item.is_fixed,
        measured_width: item.measured_width,
        measured_drop: item.measured_drop,
        final_width: item.final_width,
        final_drop: item.final_drop,
        area_sqft: item.area_sqft,
        retail_price_sqft: item.retail_price_sqft,
        supplier_cost_sqft: item.supplier_cost_sqft,
        retail_amount: item.retail_amount,
        supplier_amount: item.supplier_amount,
        minimum_applied: item.minimum_applied
      })))
    ]);

    // Fetch updated quote using SECURITY DEFINER function
    const [updatedQuoteResult] = await sql('SELECT get_company_quote_by_id($1, $2) as quote', [session.companyId, id]);
    const updatedQuote = updatedQuoteResult?.quote;

    return NextResponse.json({
      ...updatedQuote,
      customer_name: updatedQuote.customer_name_encrypted
        ? decryptPII(updatedQuote.customer_name_encrypted)
        : updatedQuote.customer_name || '',
      customer_address: updatedQuote.customer_address_encrypted
        ? decryptPII(updatedQuote.customer_address_encrypted)
        : updatedQuote.customer_address || '',
    });
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set RLS context for tenant isolation
    await setTenantContext(session.companyId, session.role || 'user');

    try {
      // Superadmins can delete any quote without subscription restrictions
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        // Check subscription access - require full access for quote deletion
        const access = await checkSubscriptionAccess(session);
        if (access.mode !== 'full') {
          return NextResponse.json({
            error: 'Active subscription required for quote deletion',
            checkoutUrl: '/subscription/checkout',
            mode: access.mode,
            reason: access.reason
          }, { status: 403 });
        }
      }

      // Use SECURITY DEFINER function for quote deletion
      await sql('SELECT delete_quote($1, $2)', [session.companyId, id]);
      return NextResponse.json({ success: true });
    } finally {
      // Always reset RLS context
      await resetTenantContext();
    }
  } catch (err) {
    console.error('DELETE /api/quotes/[id]', err);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
