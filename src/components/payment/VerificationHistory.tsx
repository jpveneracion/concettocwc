'use client';

import { useState, useEffect } from 'react';
import { getPinataUrl } from '@/lib/pinata';
import type { PaymentVerification } from '@/types/payment';
import { VerificationStatus } from '@/types/payment';

export default function VerificationHistory() {
  const [verifications, setVerifications] = useState<PaymentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerificationStatus | 'all'>('all');

  useEffect(() => {
    fetchVerifications();
  }, [filter]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? '/api/payment-verifications/my-verifications'
        : `/api/payment-verifications/my-verifications?status=${filter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setVerifications(data.verifications);
      } else {
        setError(data.error || 'Failed to load verification history');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: VerificationStatus): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl mr-3">⏳</div>
        <p className="text-gray-600">Loading verification history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchVerifications}
          className="mt-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  const filters: Array<{ value: VerificationStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {filters.map((filterOption) => (
          <button
            key={filterOption.value}
            onClick={() => setFilter(filterOption.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === filterOption.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {/* Verification List */}
      {verifications.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Verifications Found</h3>
          <p className="text-gray-600 mb-4">
            {filter === 'all'
              ? "You haven't submitted any payment verifications yet."
              : `No ${filter} verifications found.`}
          </p>
          <a
            href="/payment/verification"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Submit Verification
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((verification) => (
            <div
              key={verification.id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {verification.plan_name || 'Unknown Plan'}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(verification.status)}`}>
                      {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium text-gray-900">
                        {verification.plan_amount ? formatCurrency(verification.plan_amount) : 'N/A'}
                      </span>
                    </div>

                    {verification.reference_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Reference:</span>
                        <span className="font-medium text-gray-900">{verification.reference_number}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Submitted:</span>
                      <span className="text-gray-900">{formatDate(verification.submitted_at)}</span>
                    </div>

                    {verification.reviewed_at && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Reviewed:</span>
                        <span className="text-gray-900">{formatDate(verification.reviewed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Screenshot Preview */}
                <div className="ml-4">
                  <a
                    href={getPinataUrl(verification.screenshot_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-20 h-20 bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <img
                      src={getPinataUrl(verification.screenshot_url)}
                      alt="Payment screenshot"
                      className="w-full h-full object-cover"
                    />
                  </a>
                  <p className="text-xs text-gray-500 mt-1 text-center">Click to view</p>
                </div>
              </div>

              {/* Admin Notes */}
              {verification.admin_notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Admin Notes:</strong> {verification.admin_notes}
                  </p>
                </div>
              )}

              {/* User Notes */}
              {verification.notes && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Your Notes:</strong> {verification.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}