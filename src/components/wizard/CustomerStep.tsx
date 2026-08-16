'use client';
import { useEffect, useState, useRef } from 'react';
import { useWizard } from '@/components/QuoteWizard';
import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';
import { toUTCMidnight, isPastDatedQuote } from '@/lib/utc-utils';

interface CustomerData {
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  status: 'draft' | 'sent' | 'delivered' | 'cancelled';
  quote_number?: string;
}

interface CustomerStepProps {
  quoteNumber: string;
  existingQuoteNumbers?: string[];
  existingData?: CustomerData;
}

export default function CustomerStep({ quoteNumber, existingQuoteNumbers, existingData }: CustomerStepProps) {
  const { setStepData } = useWizard();
  const { maxOrderDate, isLoading: restrictionsLoading } = useTrialRestrictions();

  const [customer, setCustomer] = useState(existingData?.customer_name ?? '');
  const [address, setAddress] = useState(existingData?.customer_address ?? '');
  const [date, setDate] = useState(existingData?.quote_date ?? new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState(existingData?.our_ref ?? '');
  const [status, setStatus] = useState<'draft' | 'sent' | 'delivered' | 'cancelled'>(existingData?.status ?? 'draft');
  const [quoteNumberValue, setQuoteNumberValue] = useState(quoteNumber);
  const canEditQuoteNumber = isPastDatedQuote(date);
  const isDuplicateQuoteNumber = quoteNumberValue.trim().length > 0 && (existingQuoteNumbers ?? []).includes(quoteNumberValue.trim());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  // Track previous data to avoid infinite loop with setStepData
  const prevDataRef = useRef<CustomerData | null>(null);

  useEffect(() => {
    const data: CustomerData = {
      customer_name: customer,
      customer_address: address,
      quote_date: date,
      our_ref: ref,
      status,
      quote_number: quoteNumberValue,
    };

    // Only call setStepData if data actually changed to avoid infinite loop
    if (
      prevDataRef.current === null ||
      prevDataRef.current.customer_name !== data.customer_name ||
      prevDataRef.current.customer_address !== data.customer_address ||
      prevDataRef.current.quote_date !== data.quote_date ||
      prevDataRef.current.our_ref !== data.our_ref ||
      prevDataRef.current.status !== data.status ||
      prevDataRef.current.quote_number !== data.quote_number
    ) {
      prevDataRef.current = data;
      setStepData('customer', data);
    }

    // Check date against the user's max order date (trial_expires_at based)
    if (!restrictionsLoading && date && maxOrderDate) {
      const selectedDate = toUTCMidnight(new Date(date));
      const maxDate = toUTCMidnight(new Date(maxOrderDate));

      if (selectedDate > maxDate) {
        setDateWarning(`Orders are limited to dates on or before ${maxOrderDate}. Please choose an earlier date or activate your subscription.`);
      } else {
        setDateWarning(null);
      }
    }
  }, [customer, address, date, ref, status, quoteNumberValue, setStepData, maxOrderDate, restrictionsLoading]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!customer.trim()) {
      newErrors.customer = 'Customer name is required';
    }

    if (canEditQuoteNumber) {
      if (!quoteNumberValue.trim()) {
        newErrors.quote_number = 'Quote number is required';
      } else if (isDuplicateQuoteNumber) {
        newErrors.quote_number = 'This quote number already exists';
      }
    }

    // Check if date exceeds the user's max order date
    if (date && maxOrderDate) {
      const selectedDate = toUTCMidnight(new Date(date));
      const maxDate = toUTCMidnight(new Date(maxOrderDate));

      if (selectedDate > maxDate) {
        newErrors.date = `Orders are limited to dates on or before ${maxOrderDate}. Please choose an earlier date.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Expose validation function to parent wizard
  useEffect(() => {
    // Store validation function for wizard to use
    window.__customerStepValidation = validate;
    return () => {
      delete window.__customerStepValidation;
    };
  }, [customer, address, date, ref, status, quoteNumberValue, canEditQuoteNumber, existingQuoteNumbers]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-stone-700 mb-4">Customer Information</h3>

      <div className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">Customer Name *</label>
          <input
            className={`w-full border ${errors.customer ? 'border-red-300' : 'border-stone-300'} rounded-lg px-4 py-2 text-sm`}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="e.g. Ms. Ana Santos"
          />
          {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">Address</label>
          <input
            className="w-full border border-stone-300 rounded-lg px-4 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Baliwag, Bulacan"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">Quote Date</label>
          <input
            type="date"
            className={`w-full border ${errors.date ? 'border-red-300' : 'border-stone-300'} rounded-lg px-4 py-2 text-sm`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={maxOrderDate ?? undefined}
          />
          {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          {dateWarning && !errors.date && (
            <p className="text-xs text-amber-600 mt-1">{dateWarning}</p>
          )}
          {maxOrderDate && !errors.date && !dateWarning && (
            <p className="text-xs text-stone-500 mt-1">Orders are limited to dates on or before {maxOrderDate}</p>
          )}
        </div>

        {/* Quote Number */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">
            {canEditQuoteNumber ? 'Quote Number (editable for past date)' : 'Quote Number'}
          </label>
          {canEditQuoteNumber ? (
            <input
              className={`w-full border ${errors.quote_number ? 'border-red-300' : 'border-stone-300'} rounded-lg px-4 py-2 text-sm min-h-[44px]`}
              value={quoteNumberValue}
              onChange={(e) => setQuoteNumberValue(e.target.value)}
            />
          ) : (
            <input
              className="w-full border border-stone-200 rounded-lg px-4 py-2 text-sm text-stone-400 bg-stone-50"
              value={quoteNumberValue}
              readOnly
            />
          )}
          {errors.quote_number && <p className="text-xs text-red-500 mt-1">{errors.quote_number}</p>}
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">Our Reference</label>
          <input
            className="w-full border border-stone-300 rounded-lg px-4 py-2 text-sm"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm text-stone-600 mb-1">Status</label>
          <select
            className="w-full border border-stone-300 rounded-lg px-4 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'sent' | 'delivered' | 'cancelled')}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-stone-500 mt-4">* Required fields</p>
    </div>
  );
}