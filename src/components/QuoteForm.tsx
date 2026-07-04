'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote, QuoteItem, MeasureUnit } from '@/types';
import { calcFinalSize, calcAreaSqft, calcAmounts, phpFormat } from '@/lib/calc';

type ItemRow = Omit<QuoteItem, 'id' | 'quote_id'> & { _key: string };

function newRow(order: number): ItemRow {
  return {
    _key: crypto.randomUUID(),
    sort_order: order,
    location: '',
    product_id: null,
    product_code: '',
    product_collection: '',
    product_description: '',
    unit: 'in',
    is_fixed: true,
    measured_width: 0,
    measured_drop: 0,
    final_width: 0,
    final_drop: 0,
    area_sqft: 0,
    retail_price_sqft: 0,
    supplier_cost_sqft: 0,
    retail_amount: 0,
    supplier_amount: 0,
  };
}

function recompute(row: ItemRow): ItemRow {
  const { final_width, final_drop } = calcFinalSize(
    row.measured_width, row.measured_drop, row.is_fixed, row.unit as MeasureUnit
  );
  const area_sqft = calcAreaSqft(final_width, final_drop, row.unit as MeasureUnit);
  const { retail_amount, supplier_amount } = calcAmounts(
    area_sqft, row.retail_price_sqft, row.supplier_cost_sqft
  );
  return { ...row, final_width, final_drop, area_sqft, retail_amount, supplier_amount };
}

interface Props {
  existing?: Quote;
  quoteNumber: string;
}

export default function QuoteForm({ existing, quoteNumber }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState(existing?.customer_name ?? '');
  const [address, setAddress] = useState(existing?.customer_address ?? '');
  const [date, setDate] = useState(existing?.quote_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState(existing?.our_ref ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'draft');
  const [installation, setInstallation] = useState(existing?.installation_fee ?? 0);
  const [delivery, setDelivery] = useState(existing?.delivery_fee ?? 0);
  const [rows, setRows] = useState<ItemRow[]>(
    existing?.items?.length
      ? existing.items.map((i) => ({ ...i, _key: crypto.randomUUID() }))
      : [newRow(0)]
  );
  const [lookupStatus, setLookupStatus] = useState<Record<string, string>>({});

  const updateRow = useCallback((key: string, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? recompute({ ...r, ...patch }) : r))
    );
  }, []);

  async function lookupCode(key: string, code: string) {
    if (!code.trim()) return;
    setLookupStatus((s) => ({ ...s, [key]: 'loading' }));
    const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const p = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r._key === key
            ? recompute({
                ...r,
                product_id: p.id,
                product_code: p.code,
                product_collection: p.collection,
                product_description: p.description,
                retail_price_sqft: p.retail_price,
                supplier_cost_sqft: p.supplier_cost,
              })
            : r
        )
      );
      setLookupStatus((s) => ({ ...s, [key]: 'found' }));
    } else {
      setLookupStatus((s) => ({ ...s, [key]: 'notfound' }));
    }
  }

  const totals = {
    area: rows.reduce((s, r) => s + r.area_sqft, 0),
    subtotal: rows.reduce((s, r) => s + r.retail_amount, 0),
    total: rows.reduce((s, r) => s + r.retail_amount, 0) + installation + delivery,
    panels: rows.filter((r) => r.area_sqft > 0).length,
  };

  async function handleSubmit() {
    if (!customer.trim()) { alert('Customer name is required.'); return; }
    if (!rows.some((r) => r.area_sqft > 0)) { alert('Add at least one window with measurements.'); return; }

    // Confirmation for status changes to approved or cancelled
    if (existing && existing.status !== status) {
      if ((status === 'approved' || status === 'cancelled') && !confirm(`Change status from "${existing.status}" to "${status}"?`)) {
        return;
      }
    }

    setSaving(true);
    const payload = {
      quote_number: quoteNumber,
      customer_name: customer,
      customer_address: address,
      quote_date: date,
      our_ref: ref,
      status,
      installation_fee: installation,
      delivery_fee: delivery,
      items: rows.map(({ _key, ...rest }) => rest),
    };
    const res = existing
      ? await fetch(`/api/quotes/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) router.push('/quotes');
    else alert('Failed to save quote. Please try again.');
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Customer info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-sm text-gray-700 mb-4">Customer info</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Customer name</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Ms. Ana Santos" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Baliwag, Bulacan" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quote number</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50" value={quoteNumber} readOnly />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Our ref</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'sent' | 'approved' | 'cancelled')}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-sm text-gray-700">Window items</h3>
          <button
            onClick={() => setRows((p) => [...p, newRow(p.length)])}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ➕ Add window
          </button>
        </div>

        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div key={row._key} className="border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-500">Window #{idx + 1}</span>
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows((p) => p.filter((r) => r._key !== row._key))}
                    className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Location</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={row.location} onChange={(e) => updateRow(row._key, { location: e.target.value })} placeholder="e.g. Living Room" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product code</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                    value={row.product_code}
                    onChange={(e) => {
                      updateRow(row._key, { product_code: e.target.value.toUpperCase() });
                      setLookupStatus((s) => ({ ...s, [row._key]: '' }));
                    }}
                    onBlur={(e) => lookupCode(row._key, e.target.value)}
                    placeholder="e.g. P5012"
                  />
                  {lookupStatus[row._key] === 'found' && <p className="text-xs text-green-600 mt-0.5">✓ {row.product_description}</p>}
                  {lookupStatus[row._key] === 'notfound' && <p className="text-xs text-red-500 mt-0.5">Code not found</p>}
                  {lookupStatus[row._key] === 'loading' && <p className="text-xs text-gray-400 mt-0.5">Looking up...</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Collection</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" value={row.product_collection} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" value={row.product_description} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Measure unit</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={row.unit} onChange={(e) => updateRow(row._key, { unit: e.target.value as MeasureUnit })}>
                    <option value="in">Inches</option>
                    <option value="cm">Centimeters</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fixed measure?</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={row.is_fixed ? 'yes' : 'no'} onChange={(e) => updateRow(row._key, { is_fixed: e.target.value === 'yes' })}>
                    <option value="yes">Yes (as-is)</option>
                    <option value="no">No (+{row.unit === 'cm' ? '15cm' : '6in'} overlap)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width ({row.unit})</label>
                  <input type="number" min="0" step="0.1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={row.measured_width || ''} onChange={(e) => updateRow(row._key, { measured_width: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Drop ({row.unit})</label>
                  <input type="number" min="0" step="0.1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={row.measured_drop || ''} onChange={(e) => updateRow(row._key, { measured_drop: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Final width ({row.unit})</p>
                  <p className="text-sm font-medium text-blue-700">{row.final_width.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Final drop ({row.unit})</p>
                  <p className="text-sm font-medium text-blue-700">{row.final_drop.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Area (sq.ft.)</p>
                  <p className="text-sm font-medium">{row.area_sqft.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Retail amount</p>
                  <p className="text-sm font-semibold text-blue-600">{phpFormat(row.retail_amount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service charges */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-sm text-gray-700 mb-4">Service charges</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Installation (₱)</label>
            <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={installation} onChange={(e) => setInstallation(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Delivery (₱)</label>
            <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={delivery} onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      {/* Summary */}
      {totals.panels > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-end gap-8 mb-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">Total area</p>
              <p className="text-sm font-medium">{totals.area.toFixed(2)} sq.ft.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Panels</p>
              <p className="text-sm font-medium">{totals.panels}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Sub-total</p>
              <p className="text-sm font-medium">{phpFormat(totals.subtotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-lg font-semibold text-blue-700">{phpFormat(totals.total)}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save quote'}
            </button>
          </div>
        </div>
      )}

      {totals.panels === 0 && (
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : '💾 Save quote'}
          </button>
        </div>
      )}
    </div>
  );
}
