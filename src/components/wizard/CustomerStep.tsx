'use client';
import { useEffect, useState } from 'react';
import { useWizard } from '@/components/QuoteWizard';
import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';
import { getUTCMidnight, toUTCMidnight, isFutureUTCDate } from '@/lib/utc-utils';

interface CustomerData {
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  status: 'draft' | 'sent' | 'delivered' | 'cancelled';
}

interface CustomerStepProps {
  quoteNumber: string;
  existingData?: CustomerData;
}

export default function CustomerStep({ quoteNumber, existingData }: CustomerStepProps) {
  const { setStepData } = useWizard();
  const { canCreateFutureOrders, isLoading: restrictionsLoading } = useTrialRestrictions();

  const [customer, setCustomer] = useState(existingData?.customer_name ?? '');
  const [address, setAddress] = useState(existingData?.customer_address ?? '');
  const [date, setDate] = useState(existingData?.quote_date ?? new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState(existingData?.our_ref ?? '');
  const [status, setStatus] = useState<'draft' | 'sent' | 'delivered' | 'cancelled'>(existingData?.status ?? 'draft');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  useEffect(() => {
    const data: CustomerData = {
      customer_name: customer,
      customer_address: address,
      quote_date: date,
      our_ref: ref,
      status,
    };
    setStepData('customer', data);

    // Check for future date restrictions
    if (!restrictionsLoading && date) {
      const selectedDate = new Date(date);
      const todayUTC = getUTCMidnight();
      const selectedDateUTC = toUTCMidnight(selectedDate);

      if (selectedDateUTC > todayUTC && !canCreateFutureOrders) {
        setDateWarning('Future dates are not allowed after trial expiration. Please select today or a past date, or activate your subscription.');
      } else {
        setDateWarning(null);
      }
    }
  }, [customer, address, date, ref, status, setStepData, canCreateFutureOrders, restrictionsLoading]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!customer.trim()) {
      newErrors.customer = 'Customer name is required';
    }

    // Check if future date is allowed
    if (date) {
      const selectedDate = new Date(date);
      const todayUTC = getUTCMidnight();
      const selectedDateUTC = toUTCMidnight(selectedDate);

      if (selectedDateUTC > todayUTC && !canCreateFutureOrders) {
        newErrors.date = 'Future dates require an active subscription. Please select today or a past date.';
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
  }, [customer, address, date, ref, status]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Customer Information</h3>

      <div className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Customer Name *</label>
          <input
            className={`w-full border ${errors.customer ? 'border-red-300' : 'border-gray-300'} rounded-lg px-4 py-2 text-sm`}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="e.g. Ms. Ana Santos"
          />
          {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Address</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Baliwag, Bulacan"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Quote Date</label>
          <input
            type="date"
            className={`w-full border ${errors.date ? 'border-red-300' : 'border-gray-300'} rounded-lg px-4 py-2 text-sm`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={canCreateFutureOrders ? undefined : new Date().toISOString().slice(0, 10)}
          />
          {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          {dateWarning && !errors.date && (
            <p className="text-xs text-amber-600 mt-1">{dateWarning}</p>
          )}
          {!canCreateFutureOrders && !errors.date && !dateWarning && (
            <p className="text-xs text-gray-500 mt-1">Only today and past dates are available</p>
          )}
        </div>

        {/* Quote Number (Read-only) */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Quote Number</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-400 bg-gray-50"
            value={quoteNumber}
            readOnly
          />
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Our Reference</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Status</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
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

      <p className="text-xs text-gray-500 mt-4">* Required fields</p>
    </div>
  );
}