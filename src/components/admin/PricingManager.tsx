'use client';

import { useState, useEffect } from 'react';
import { PricingConfig } from '@/lib/pricing-service';

interface PricingData {
  current_pricing: PricingConfig | null;
  scheduled_changes: PricingConfig[];
}

export default function PricingManager() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pricing');
      if (response.ok) {
        const data = await response.json();
        setPricing(data);
      } else {
        const errorData = await response.json();
        showMessage('error', errorData.error || 'Failed to load pricing');
      }
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
      showMessage('error', 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-4xl mr-3">⏳</div>
        <p className="text-gray-600">Loading pricing...</p>
      </div>
    );
  }

  if (!pricing || !pricing.current_pricing) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load pricing configuration</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Current Pricing Display */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Current Pricing</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Rate */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Base Monthly Rate</h3>
            <p className="text-2xl font-bold text-blue-600">
              PHP {pricing.current_pricing.monthly_base_rate.toFixed(2)}
            </p>
          </div>

          {/* Period Discounts */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Period Discounts</h3>
            <div className="space-y-1">
              <p>Quarterly: <span className="font-semibold text-green-600">{pricing.current_pricing.quarterly_discount_percent}%</span></p>
              <p>Annual: <span className="font-semibold text-green-600">{pricing.current_pricing.annual_discount_percent}%</span></p>
            </div>
          </div>

          {/* QR Thresholds */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Billing Period Thresholds</h3>
            <div className="space-y-1">
              <p>Monthly: &lt; PHP {pricing.current_pricing.monthly_threshold.toFixed(2)}</p>
              <p>Quarterly: &lt; PHP {pricing.current_pricing.quarterly_threshold.toFixed(2)}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Last Updated</h3>
            <p className="text-sm text-gray-600">
              {new Date(pricing.current_pricing.updated_at).toLocaleDateString()}
            </p>
            {pricing.current_pricing.change_reason && (
              <p className="text-sm text-gray-500 italic">
                "{pricing.current_pricing.change_reason}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Touch-friendly for mobile */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowEditForm(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 min-h-[44px]"
        >
          Update Pricing
        </button>
        <button
          className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 min-h-[44px]"
          disabled
        >
          View History
        </button>
      </div>

      {/* Scheduled Changes */}
      {pricing.scheduled_changes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Scheduled Changes</h3>
          <ul className="space-y-2">
            {pricing.scheduled_changes.map((change, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium">
                  {new Date(change.valid_from).toLocaleDateString()}:
                </span> {' '}
                PHP {change.monthly_base_rate.toFixed(2)}/month
                {change.change_reason && (
                  <span className="italic text-gray-600"> - "{change.change_reason}"</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Price Preview Table */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Price Preview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Plan</th>
                <th className="text-right p-2">Base Total</th>
                <th className="text-right p-2">Period Discount</th>
                <th className="text-right p-2">Final Price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Monthly</td>
                <td className="text-right p-2">PHP {pricing.current_pricing.monthly_base_rate.toFixed(2)}</td>
                <td className="text-right p-2">-</td>
                <td className="text-right p-2 font-semibold">PHP {pricing.current_pricing.monthly_base_rate.toFixed(2)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Quarterly (3 months)</td>
                <td className="text-right p-2">PHP {(pricing.current_pricing.monthly_base_rate * 3).toFixed(2)}</td>
                <td className="text-right p-2">{pricing.current_pricing.quarterly_discount_percent}%</td>
                <td className="text-right p-2 font-semibold">
                  PHP {(pricing.current_pricing.monthly_base_rate * 3 * (1 - pricing.current_pricing.quarterly_discount_percent / 100)).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="p-2">Annual (12 months)</td>
                <td className="text-right p-2">PHP {(pricing.current_pricing.monthly_base_rate * 12).toFixed(2)}</td>
                <td className="text-right p-2">{pricing.current_pricing.annual_discount_percent}%</td>
                <td className="text-right p-2 font-semibold">
                  PHP {(pricing.current_pricing.monthly_base_rate * 12 * (1 - pricing.current_pricing.annual_discount_percent / 100)).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white rounded-t-xl md:rounded-lg p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Update Pricing Configuration</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Pricing form is ready for implementation. Connect to API endpoint when backend is available.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditForm(false)}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-medium min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}