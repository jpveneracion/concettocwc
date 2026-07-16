'use client';

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { PaymentVerification, VerificationStatus } from '@/types/payment';

interface VerificationTableProps {
  verifications: PaymentVerification[];
  onRowClick: (verification: PaymentVerification) => void;
  loading?: boolean;
}

export default function VerificationTable({
  verifications,
  onRowClick,
  loading = false
}: VerificationTableProps) {

  function getStatusBadgeConfig(status: VerificationStatus) {
    const configs = {
      pending: {
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: <AlertCircle className="w-3.5 h-3.5" />
      },
      approved: {
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: <CheckCircle className="w-3.5 h-3.5" />
      },
      rejected: {
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: <XCircle className="w-3.5 h-3.5" />
      },
      expired: {
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-800',
        borderColor: 'border-gray-200',
        icon: <AlertCircle className="w-3.5 h-3.5" />
      }
    };

    return configs[status] || configs.expired;
  }

  function getStatusBadge(status: VerificationStatus) {
    const config = getStatusBadgeConfig(status);

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function formatDate(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCurrency(amount: number | undefined): string {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse text-purple-600 text-lg mb-2">
              Loading verifications...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Mobile Card View */}
      <div className="md:hidden">
        {verifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p>No payment verifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {verifications.map((verification) => (
              <div
                key={verification.id}
                onClick={() => onRowClick(verification)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {verification.user_name || 'Unknown User'}
                      </h3>
                      {getStatusBadge(verification.status)}
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {verification.user_email || 'No email'}
                    </p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(verification);
                      }}
                      className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                    >
                      {verification.status === 'pending' ? 'Review' : 'View'}
                    </button>
                  </div>
                </div>

                {/* Plan and amount */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {verification.plan_name || 'Unknown Plan'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(verification.plan_amount)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Submitted</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(verification.submitted_at)}
                    </p>
                  </div>
                </div>

                {/* Reference number */}
                {verification.reference_number && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Reference</p>
                    <p className="text-sm font-mono text-gray-900">
                      {verification.reference_number}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {verifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>No payment verifications found</p>
                </td>
              </tr>
            ) : (
              verifications.map((verification) => (
                <tr
                  key={verification.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onRowClick(verification)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(verification.submitted_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 text-sm">
                      {verification.user_name || 'Unknown'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {verification.user_email || 'No email'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 text-sm">
                      {verification.plan_name || 'Unknown'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {formatCurrency(verification.plan_amount)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                    {verification.reference_number || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(verification.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(verification);
                      }}
                      className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                    >
                      {verification.status === 'pending' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}