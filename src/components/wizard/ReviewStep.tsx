'use client';
import { useEffect } from 'react';
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

interface ProductData {
  items: QuoteItem[];
  installation_fee: number;
  delivery_fee: number;
}

interface MeasurementData {
  items: QuoteItem[];
}

export default function ReviewStep() {
  const { getStepData } = useWizard();

  const customerData = getStepData('customer') as CustomerData | undefined;
  const measurementsData = getStepData('measurements') as MeasurementData | undefined;

  const validItems = measurementsData?.items?.filter((item) => item.area_sqft > 0) || [];
  const totalArea = validItems.reduce((sum, item) => sum + item.area_sqft, 0);
  const subtotal = validItems.reduce((sum, item) => sum + item.retail_amount, 0);
  const installation = 0; // Default installation fee
  const delivery = 0; // Default delivery fee
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
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Review Quote Details</h3>

      {/* Customer Information */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Customer Information</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-gray-600">Customer Name:</span>
            <span className="text-sm font-medium">{customerData.customer_name || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-gray-600">Address:</span>
            <span className="text-sm font-medium">{customerData.customer_address || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-gray-600">Quote Date:</span>
            <span className="text-sm font-medium">{customerData.quote_date || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-gray-600">Reference:</span>
            <span className="text-sm font-medium">{customerData.our_ref || '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <span className="text-sm font-medium capitalize">{customerData.status}</span>
          </div>
        </div>
      </div>

      {/* Window Items */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Window Items ({validItems.length})</h4>
        {validItems.length === 0 ? (
          <p className="text-sm text-gray-500">No windows with measurements and products.</p>
        ) : (
          <div className="space-y-3">
            {validItems.map((item, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-800">
                    {item.location || `Window #${idx + 1}`}
                  </span>
                  <span className="text-xs text-gray-500">{item.area_sqft.toFixed(2)} sq.ft.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Product:</span>
                    <span className="ml-2 font-medium">{item.product_code || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Collection:</span>
                    <span className="ml-2 font-medium">{item.product_collection || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Description:</span>
                    <span className="ml-2">{item.product_description || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Final Size:</span>
                    <span className="ml-2 font-medium">{item.final_width.toFixed(1)} × {item.final_drop.toFixed(1)} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Retail Amount:</span>
                    <span className="ml-2 font-medium text-blue-700">{phpFormat(item.retail_amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Financial Summary</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Area:</span>
            <span className="text-sm font-medium">{totalArea.toFixed(2)} sq.ft.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="text-sm font-medium">{phpFormat(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Installation Fee:</span>
            <span className="text-sm font-medium">{phpFormat(installation)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Delivery Fee:</span>
            <span className="text-sm font-medium">{phpFormat(delivery)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-base font-semibold text-gray-800">Total:</span>
              <span className="text-lg font-bold text-blue-700">{phpFormat(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ready to Submit */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 text-2xl">✓</div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Ready to Submit</h4>
            <p className="text-xs text-blue-700">
              Please review all the information above. Click "Submit" to create this quote.
              You'll be able to edit it later if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Warning if no items */}
      {validItems.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-red-600 text-2xl">⚠️</div>
            <div>
              <h4 className="text-sm font-semibold text-red-900 mb-1">Cannot Submit</h4>
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