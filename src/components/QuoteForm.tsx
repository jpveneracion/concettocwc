'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote, QuoteItem, MeasureUnit } from '@/types';
import { calcFinalSize, calcAreaSqft, calcAmounts, phpFormat } from '@/lib/calc';
import { isPastDatedQuote as computeIsPastDated, toUTCMidnight } from '@/lib/utc-utils';
import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';
import ProductCreationModal from './ProductCreationModal';

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
    minimum_applied: false,
  };
}

function recompute(row: ItemRow, minimumArea = 0): ItemRow {
  const { final_width, final_drop } = calcFinalSize(
    row.measured_width, row.measured_drop, row.is_fixed, row.unit as MeasureUnit
  );
  const area_sqft = calcAreaSqft(final_width, final_drop, row.unit as MeasureUnit);
  const { retail_amount, supplier_amount, minimum_applied } = calcAmounts(
    area_sqft, row.retail_price_sqft, row.supplier_cost_sqft, minimumArea
  );
  return { ...row, final_width, final_drop, area_sqft, retail_amount, supplier_amount, minimum_applied };
}

interface Props {
  existing?: Quote;
  quoteNumber: string;
  existingQuoteNumbers?: string[];
}

export default function QuoteForm({ existing, quoteNumber, existingQuoteNumbers }: Props) {
  const router = useRouter();
  const { maxOrderDate } = useTrialRestrictions();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [dateError, setDateError] = useState('');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);

  const [customer, setCustomer] = useState(existing?.customer_name ?? '');
  const [address, setAddress] = useState(existing?.customer_address ?? '');
  const [date, setDate] = useState(existing?.quote_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const isPastDatedQuote = useMemo(() => computeIsPastDated(date), [date]);
  const [quoteNumberValue, setQuoteNumberValue] = useState(quoteNumber);
  const canEditQuoteNumber = isPastDatedQuote && !existing;
  const isDuplicateQuoteNumber = quoteNumberValue.trim().length > 0 && (existingQuoteNumbers ?? []).includes(quoteNumberValue.trim());
  const [ref, setRef] = useState(existing?.our_ref ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'draft');
  const isDeliveredLocked = existing?.status === 'delivered';
  const lockedInputClass = isDeliveredLocked ? 'bg-gray-50 text-gray-500' : '';
  const [installation, setInstallation] = useState(existing?.installation_fee ?? 0);
  const [delivery, setDelivery] = useState(existing?.delivery_fee ?? 0);
  const [rows, setRows] = useState<ItemRow[]>(
    existing?.items?.length
      ? existing.items.map((i) => ({ ...i, _key: crypto.randomUUID() }))
      : [newRow(0)]
  );
  const [lookupStatus, setLookupStatus] = useState<Record<string, string>>({});
  const [minimumArea, setMinimumArea] = useState(0);
  const [productModalState, setProductModalState] = useState<{[key: string]: {isOpen: boolean, code: string}}>({});

  // Fetch company settings once on mount to apply the minimum-billable-area floor.
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((settings) => {
        setMinimumArea(Number(settings.minimum_area_sqft) || 0);
      })
      .catch((error) => {
        console.error('Failed to fetch company settings:', error);
      });
  }, []);

  // When the company minimum first becomes known, recompute all rows so the
  // floor is applied to items entered (or loaded) before settings resolved.
  useEffect(() => {
    if (minimumArea > 0) {
      setRows((prev) => prev.map((r) => recompute(r, minimumArea)));
    }
  }, [minimumArea]);

  const updateRow = useCallback((key: string, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? recompute({ ...r, ...patch }, minimumArea) : r))
    );
  }, [minimumArea]);

  const openProductModal = useCallback((key: string, code: string) => {
    setProductModalState(prev => ({ ...prev, [key]: { isOpen: true, code } }));
  }, []);

  const closeProductModal = useCallback((key: string) => {
    setProductModalState(prev => ({ ...prev, [key]: { isOpen: false, code: '' } }));
  }, []);

  const handleProductCreated = useCallback((key: string, productData: {
    product_id: string;
    product_code: string;
    product_collection: string;
    product_description: string;
    retail_price_sqft: number;
    supplier_cost_sqft: number;
  }) => {
    updateRow(key, {
      product_id: productData.product_id,
      product_code: productData.product_code,
      product_collection: productData.product_collection,
      product_description: productData.product_description,
      retail_price_sqft: productData.retail_price_sqft,
      supplier_cost_sqft: productData.supplier_cost_sqft,
    });
    setLookupStatus(prev => ({ ...prev, [key]: 'found' }));
  }, [updateRow]);

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
              }, minimumArea)
            : r
        )
      );
      setLookupStatus((s) => ({ ...s, [key]: 'found' }));
    } else {
      setLookupStatus((s) => ({ ...s, [key]: 'notfound' }));
    }
  }

  const totals = useMemo(() => ({
    area: rows.reduce((s, r) => s + r.area_sqft, 0),
    subtotal: rows.reduce((s, r) => s + r.retail_amount, 0),
    total: rows.reduce((s, r) => s + r.retail_amount, 0) + installation + delivery,
    panels: rows.filter((r) => r.area_sqft > 0).length,
  }), [rows, installation, delivery]);

  async function handleSubmit() {
    // Clear previous errors
    setFormError('');
    setDateError('');

    // Trial restriction: block dates beyond the user's hard max (trial_expires_at)
    if (date && maxOrderDate) {
      const selectedDate = toUTCMidnight(new Date(date));
      const maxDate = toUTCMidnight(new Date(maxOrderDate));

      if (selectedDate > maxDate) {
        setDateError(`Orders are limited to dates on or before ${maxOrderDate}. This limit does not change.`);
        return;
      }
    }

    if (!customer.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!rows.some((r) => r.area_sqft > 0)) {
      setFormError('Add at least one window with measurements.');
      return;
    }

    if (canEditQuoteNumber) {
      if (!quoteNumberValue.trim()) {
        setFormError('Quote number is required.');
        return;
      }
      if (isDuplicateQuoteNumber) {
        setFormError('This quote number already exists.');
        return;
      }
    }

    // Delivered quotes are locked to customer information only
    if (isDeliveredLocked && status !== 'delivered') {
      setFormError('Cannot change status from delivered.');
      return;
    }

    // Confirmation for status changes to delivered or cancelled
    if (existing && existing.status !== status) {
      if (status === 'delivered' || status === 'cancelled') {
        setShowStatusConfirm(true);
        return;
      }
    }

    await saveQuote();
  }

  async function saveQuote() {
    setSaving(true);
    setShowStatusConfirm(false);
    const payload = {
      quote_number: quoteNumberValue.trim(),
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
    if (res.ok) {
      router.push('/quotes');
    } else {
      try {
        const data = await res.json();
        if (res.status === 403 && data.restrictionType === 'future_orders_blocked') {
          setDateError(data.error || 'Future dates are not allowed after trial expiration.');
        } else if (isDeliveredLocked && res.status === 403) {
          // The delivered-lock banner already explains this; don't duplicate it.
          setFormError('');
        } else {
          setFormError(data.error || 'Failed to save quote. Please try again.');
        }
      } catch {
        setFormError('Failed to save quote. Please try again.');
      }
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Form Error Messages */}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-600">{formError}</p>
        </div>
      )}

      {/* Delivered quote lock notice */}
      {isDeliveredLocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-700">
            This quote has been delivered and is locked. Only the customer name, address, and our ref can be edited.
          </p>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      {showStatusConfirm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800 mb-3">
            Change status from "{existing?.status}" to "{status}"?
          </p>
          <div className="flex gap-2">
            <button
              onClick={saveQuote}
              aria-label="Confirm status change"
              className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 min-h-[44px] min-w-[80px]"
            >
              Yes, change
            </button>
            <button
              onClick={() => {
                setShowStatusConfirm(false);
                setFormError('');
              }}
              aria-label="Cancel status change"
              className="px-3 py-2 border border-amber-300 rounded-lg text-sm font-medium text-amber-800 hover:bg-amber-100 min-h-[44px] min-w-[80px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Customer info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-sm text-gray-700 mb-4">Customer info</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Customer name</label>
            <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px]" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Ms. Ana Santos" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px]" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Baliwag, Bulacan" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              disabled={isDeliveredLocked}
              className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`}
              value={date}
              onChange={(e) => { setDate(e.target.value); setDateError(''); }}
              max={maxOrderDate ?? undefined}
            />
            {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
            {maxOrderDate && !dateError && (
              <p className="text-xs text-gray-500 mt-1">Orders are limited to dates on or before {maxOrderDate}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {canEditQuoteNumber ? 'Quote number (editable for past date)' : 'Quote number'}
            </label>
            {canEditQuoteNumber ? (
              <input
                className={`w-full border ${isDuplicateQuoteNumber ? 'border-red-300' : 'border-gray-200'} rounded-lg px-4 py-3 text-sm min-h-[44px]`}
                value={quoteNumberValue}
                onChange={(e) => setQuoteNumberValue(e.target.value)}
              />
            ) : (
              <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 bg-gray-50 min-h-[44px]" value={quoteNumberValue} readOnly />
            )}
            {isDuplicateQuoteNumber && (
              <p className="text-xs text-red-500 mt-1">This quote number already exists.</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Our ref</label>
            <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px]" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${isDeliveredLocked ? 'bg-gray-50 text-gray-500' : ''}`} value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'sent' | 'delivered' | 'cancelled')}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-sm text-gray-700">Window items</h3>
          {!isDeliveredLocked && (
            <button
              onClick={() => setRows((p) => [...p, newRow(p.length)])}
              aria-label="Add new window item"
              className="text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px]"
            >
              ➕ Add window
            </button>
          )}
        </div>

        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div key={row._key} className="border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-500">Window #{idx + 1}</span>
                {!isDeliveredLocked && rows.length > 1 && (
                  <button
                    onClick={() => setRows((p) => p.filter((r) => r._key !== row._key))}
                    aria-label={`Remove window ${idx + 1}`}
                    className="text-xs px-3 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50 min-h-[44px] min-w-[44px]"
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Location</label>
                  <input disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={row.location} onChange={(e) => updateRow(row._key, { location: e.target.value })} placeholder="e.g. Living Room" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product code</label>
                  <input
                    disabled={isDeliveredLocked}
                    className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm uppercase min-h-[44px] ${lockedInputClass}`}
                    value={row.product_code}
                    onChange={(e) => {
                      updateRow(row._key, { product_code: e.target.value.toUpperCase() });
                      setLookupStatus((s) => ({ ...s, [row._key]: '' }));
                    }}
                    onBlur={(e) => lookupCode(row._key, e.target.value)}
                    placeholder="e.g. P5012"
                  />
                  {lookupStatus[row._key] === 'found' && <p className="text-xs text-green-600 mt-0.5">✓ {row.product_description}</p>}
                  {lookupStatus[row._key] === 'notfound' && (
                    <div className="mt-0.5">
                      <button
                        onClick={() => openProductModal(row._key, row.product_code)}
                        aria-label={`Create product ${row.product_code.toUpperCase()}`}
                        className="text-xs text-blue-600 hover:text-blue-700 underline min-h-[44px] min-w-[44px] flex items-center"
                      >
                        Create "{row.product_code.toUpperCase()}"
                      </button>
                    </div>
                  )}
                  {lookupStatus[row._key] === 'loading' && <p className="text-xs text-gray-400 mt-0.5">Looking up...</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Collection</label>
                  <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-500 min-h-[44px]" value={row.product_collection} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-500 min-h-[44px]" value={row.product_description} readOnly />
                </div>
              </div>

              {isPastDatedQuote && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Retail price per sq.ft. (₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={isDeliveredLocked}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`}
                      value={row.retail_price_sqft || ''}
                      onChange={(e) => updateRow(row._key, { retail_price_sqft: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Supplier cost per sq.ft. (₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={isDeliveredLocked}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`}
                      value={row.supplier_cost_sqft || ''}
                      onChange={(e) => updateRow(row._key, { supplier_cost_sqft: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Measure unit</label>
                  <select disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={row.unit} onChange={(e) => updateRow(row._key, { unit: e.target.value as MeasureUnit })}>
                    <option value="in">Inches</option>
                    <option value="cm">Centimeters</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fixed measure?</label>
                  <select disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={row.is_fixed ? 'yes' : 'no'} onChange={(e) => updateRow(row._key, { is_fixed: e.target.value === 'yes' })}>
                    <option value="yes">Yes (as-is)</option>
                    <option value="no">No (+{row.unit === 'cm' ? '15cm' : '6in'} overlap)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width ({row.unit})</label>
                  <input type="number" min="0" step="0.1" disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={row.measured_width || ''} onChange={(e) => updateRow(row._key, { measured_width: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Drop ({row.unit})</label>
                  <input type="number" min="0" step="0.1" disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={row.measured_drop || ''} onChange={(e) => updateRow(row._key, { measured_drop: parseFloat(e.target.value) || 0 })} />
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
                {row.minimum_applied && (
                  <div className="col-span-4">
                    <p className="text-xs text-amber-600">Minimum charge applied ({minimumArea} sq.ft.)</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service charges */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-sm text-gray-700 mb-4">Service charges</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Installation (₱)</label>
            <input type="number" min="0" step="0.01" disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={installation} onChange={(e) => setInstallation(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Delivery (₱)</label>
            <input type="number" min="0" step="0.01" disabled={isDeliveredLocked} className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] ${lockedInputClass}`} value={delivery} onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)} />
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
          <div className="flex gap-3 justify-end flex-wrap">
            <button onClick={handleSubmit} disabled={saving} aria-label={saving ? 'Saving quote' : 'Save quote'} aria-live="polite" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px] min-w-[120px]">
              {saving ? 'Saving...' : '💾 Save quote'}
            </button>
          </div>
        </div>
      )}

      {totals.panels === 0 && (
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={saving} aria-label={saving ? 'Saving quote' : 'Save quote'} aria-live="polite" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px] min-w-[120px]">
            {saving ? 'Saving...' : '💾 Save quote'}
          </button>
        </div>
      )}

      {/* Product Creation Modals */}
      {rows.map((row) => (
        <ProductCreationModal
          key={`modal-${row._key}`}
          isOpen={productModalState[row._key]?.isOpen || false}
          onClose={() => closeProductModal(row._key)}
          productCode={productModalState[row._key]?.code || ''}
          onSuccess={(productData) => handleProductCreated(row._key, productData)}
        />
      ))}
    </div>
  );
}
