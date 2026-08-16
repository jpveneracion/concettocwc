'use client';
import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWizard } from '@/components/QuoteWizard';
import type { QuoteItem } from '@/types';
import { phpFormat } from '@/lib/calc';

interface CustomerData {
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  status: string;
}

interface ReviewData {
  customer: CustomerData;
  items: QuoteItem[];
  installation_fee: number;
  delivery_fee: number;
}

interface MeasurementData {
  items: QuoteItem[];
}

interface ReviewStepProps {
  existingData?: {
    installation_fee?: number;
    delivery_fee?: number;
    // Legacy draft shape stored before the fee keys were normalized
    installation?: number;
    delivery?: number;
  };
}

export default function ReviewStep({ existingData }: ReviewStepProps) {
  const { getStepData, setStepData } = useWizard();

  const [installation, setInstallation] = useState(
    existingData?.installation_fee ?? existingData?.installation ?? 0
  );
  const [delivery, setDelivery] = useState(
    existingData?.delivery_fee ?? existingData?.delivery ?? 0
  );

  const customerData = getStepData('customer') as CustomerData | undefined;
  const measurementsData = getStepData('measurements') as MeasurementData | undefined;

  // Track previous data to avoid infinite loop with setStepData
  const prevReviewRef = useRef<{ installation_fee: number; delivery_fee: number } | null>(null);

  const [items, setItems] = useState<QuoteItem[]>(
    measurementsData?.items?.map((item, index) => ({
      ...item,
      id: '',
      quote_id: '',
      sort_order: index,
    })) || []
  );

  const validItems = items.filter((item) => item.area_sqft > 0);
  const totalArea = validItems.reduce((sum, item) => sum + item.area_sqft, 0);
  const subtotal = validItems.reduce((sum, item) => sum + item.retail_amount, 0);
  const total = subtotal + installation + delivery;

  function validate(): boolean {
    return true; // Review step is always valid
  }

  // Expose validation function to parent wizard
  useEffect(() => {
    (window as any).__reviewStepValidation = validate;
    return () => {
      delete (window as any).__reviewStepValidation;
    };
  }, []);

  // Prepare final data for submission
  useEffect(() => {
    const reviewData: ReviewData = {
      customer: customerData!,
      items: items.map((item) => ({
        ...item,
        id: '',
        quote_id: '',
      })),
      installation_fee: installation,
      delivery_fee: delivery,
    };
    // This data will be available for the onComplete callback
    (window as any).__reviewStepData = reviewData;

    // Only call setStepData if data actually changed to avoid infinite loop
    const newData = { installation_fee: installation, delivery_fee: delivery };
    if (
      prevReviewRef.current === null ||
      prevReviewRef.current.installation_fee !== newData.installation_fee ||
      prevReviewRef.current.delivery_fee !== newData.delivery_fee
    ) {
      prevReviewRef.current = newData;
      // Store data in wizard step data for proper submission
      setStepData('review', newData);
    }
  }, [items, installation, delivery, customerData, setStepData]);

  if (!customerData || !measurementsData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-700">
          Please complete the previous steps before reviewing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-stone-700 mb-4">Review Quote Details</h3>

      {/* Customer Information */}
      <div className="border border-stone-200 rounded-xl p-4 bg-white">
        <h4 className="text-sm font-medium text-stone-700 mb-3">Customer Information</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-stone-600">Customer Name:</span>
            <span className="text-sm font-medium">{customerData.customer_name || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-stone-600">Address:</span>
            <span className="text-sm font-medium">{customerData.customer_address || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-stone-600">Quote Date:</span>
            <span className="text-sm font-medium">{customerData.quote_date || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-stone-600">Reference:</span>
            <span className="text-sm font-medium">{customerData.our_ref || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-stone-600">Status:</span>
            <span className="text-sm font-medium capitalize">{customerData.status}</span>
          </div>
        </div>
      </div>

      {/* Window Items */}
      <div className="border border-stone-200 rounded-xl p-4 bg-white">
        <h4 className="text-sm font-medium text-stone-700 mb-3">Window Items ({validItems.length})</h4>
        {validItems.length === 0 ? (
          <p className="text-sm text-stone-500">No windows with measurements and products.</p>
        ) : (
          <div className="space-y-3">
            {validItems.map((item, idx) => (
              <div key={idx} className="border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-stone-800">
                    {item.location || `Window #${idx + 1}`}
                  </span>
                  <span className="text-xs text-stone-500">{item.area_sqft.toFixed(2)} sq.ft.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-stone-600">Product:</span>
                    <span className="ml-2 font-medium">{item.product_code || '-'}</span>
                  </div>
                  <div>
                    <span className="text-stone-600">Collection:</span>
                    <span className="ml-2 font-medium">{item.product_collection || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-stone-600">Description:</span>
                    <span className="ml-2">{item.product_description || '-'}</span>
                  </div>
                  <div>
                    <span className="text-stone-600">Final Size:</span>
                    <span className="ml-2 font-medium">{item.final_width.toFixed(1)} × {item.final_drop.toFixed(1)} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-stone-600">Retail Amount:</span>
                    <span className="ml-2 font-medium text-indigo-700">{phpFormat(item.retail_amount)}</span>
                  </div>
                  {item.minimum_applied && (
                    <div className="col-span-2">
                      <span className="text-xs text-amber-600">Minimum charge applied</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Charges */}
      {validItems.length > 0 && (
        <div className="border border-stone-200 rounded-xl p-4 bg-white">
          <h4 className="text-sm font-medium text-stone-700 mb-3">Service Charges</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-stone-600 mb-1">Installation Fee (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                value={installation || ''}
                onChange={(e) => setInstallation(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm text-stone-600 mb-1">Delivery Fee (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                value={delivery || ''}
                onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {validItems.length > 0 && (
        <div className="border border-stone-200 rounded-xl p-4 bg-white">
          <h4 className="text-sm font-medium text-stone-700 mb-3">Financial Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Total Area:</span>
              <span className="text-sm font-medium">{totalArea.toFixed(2)} sq.ft.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Subtotal:</span>
              <span className="text-sm font-medium">₱{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Installation Fee:</span>
              <span className="text-sm font-medium">₱{installation.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Delivery Fee:</span>
              <span className="text-sm font-medium">₱{delivery.toFixed(2)}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-stone-800">Total:</span>
                <span className="text-lg font-bold text-indigo-700">₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ready to Submit */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">Ready to Submit</h4>
            <p className="text-xs text-indigo-700">
              Please review all the information above. Click "Submit" to create this quote.
              You'll be able to edit it later if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Warning if no items */}
      {validItems.length === 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-rose-900 mb-1">Cannot Submit</h4>
              <p className="text-xs text-red-700">
                Please complete the previous steps and add at least one window with measurements and products.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}