'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import type {
  PaymentVerification,
  VerificationStatus,
  VerificationStats,
  VerificationListFilters
} from '@/types/payment';

export default function AdminVerificationsPage() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [verifications, setVerifications] = useState<PaymentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<PaymentVerification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetchStats(),
      fetchVerifications(),
      fetchPendingCount()
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Refresh data when filters change
  useEffect(() => {
    if (!loading) {
      fetchVerifications();
    }
  }, [statusFilter, searchQuery]);

  async function fetchStats() {
    try {
      const res = await fetch('/api/payment-verifications/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics');
    }
  }

  async function fetchVerifications() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      params.set('limit', '50');

      const res = await fetch(`/api/payment-verifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch verifications');

      const data = await res.json();
      setVerifications(data.verifications || []);
    } catch (err) {
      console.error('Error fetching verifications:', err);
      setError('Failed to load verifications');
    }
  }

  async function fetchPendingCount() {
    try {
      const res = await fetch('/api/payment-verifications/pending/count');
      if (!res.ok) throw new Error('Failed to fetch pending count');
      const data = await res.json();
      setPendingCount(data.count || 0);
    } catch (err) {
      console.error('Error fetching pending count:', err);
    }
  }

  async function handleApprove(verificationId: string, adminNotes?: string) {
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/payment-verifications/${verificationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: adminNotes }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve verification');
      }

      // Refresh data
      await Promise.all([
        fetchStats(),
        fetchVerifications(),
        fetchPendingCount()
      ]);

      setShowDetailModal(false);
      setSelectedVerification(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve verification');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(verificationId: string, reason: string, adminNotes?: string) {
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/payment-verifications/${verificationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          admin_notes: adminNotes
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject verification');
      }

      // Refresh data
      await Promise.all([
        fetchStats(),
        fetchVerifications(),
        fetchPendingCount()
      ]);

      setShowDetailModal(false);
      setSelectedVerification(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject verification');
    } finally {
      setActionLoading(false);
    }
  }

  function openDetailModal(verification: PaymentVerification) {
    setSelectedVerification(verification);
    setShowDetailModal(true);
    setActionError(null);
  }

  function getStatusBadgeColor(status: VerificationStatus): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function formatDate(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-pulse text-purple-600 text-lg mb-2">
              Loading verification dashboard...
            </div>
            <div className="text-sm text-gray-500">Please wait</div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Payment Verifications
            </h1>
            <p className="text-gray-600 mt-1">
              Review and manage payment proof submissions
            </p>
          </div>

          {pendingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-yellow-600 text-lg">⏰</span>
              <span className="text-yellow-800 font-medium">
                {pendingCount} pending {pendingCount === 1 ? 'verification' : 'verifications'}
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Pending"
            value={stats?.total_pending || 0}
            subtitle="Awaiting review"
            color="yellow"
            icon="⏳"
          />
          <StatsCard
            title="Approved Today"
            value={stats?.approved_today || 0}
            subtitle="Completed reviews"
            color="green"
            icon="✅"
          />
          <StatsCard
            title="Rejected Today"
            value={stats?.rejected_today || 0}
            subtitle="Declined payments"
            color="red"
            icon="❌"
          />
          <StatsCard
            title="Total Approved"
            value={stats?.total_approved || 0}
            subtitle="All time approvals"
            color="blue"
            icon="📊"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search by Reference or Email
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Verification Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
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
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDetailModal(verification)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(verification.submitted_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">
                          {verification.user_name || 'Unknown'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {verification.user_email || 'No email'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">
                          {verification.plan_name || 'Unknown'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          ${verification.plan_amount?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {verification.reference_number || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(verification.status)}`}>
                          {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetailModal(verification);
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

        {/* Detail Modal */}
        {showDetailModal && selectedVerification && (
          <DetailModal
            verification={selectedVerification}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedVerification(null);
              setActionError(null);
            }}
            onApprove={handleApprove}
            onReject={handleReject}
            actionLoading={actionLoading}
            actionError={actionError}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  color,
  icon
}: {
  title: string;
  value: number;
  subtitle: string;
  color: string;
  icon: string;
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

// Detail Modal Component
function DetailModal({
  verification,
  onClose,
  onApprove,
  onReject,
  actionLoading,
  actionError
}: {
  verification: PaymentVerification;
  onClose: () => void;
  onApprove: (id: string, adminNotes?: string) => void;
  onReject: (id: string, reason: string, adminNotes?: string) => void;
  actionLoading: boolean;
  actionError: string | null;
}) {
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  function handleApproveClick() {
    if (verification.status !== 'pending') return;
    onApprove(verification.id, adminNotes);
  }

  function handleRejectClick() {
    if (verification.status !== 'pending' || !rejectReason.trim()) return;
    onReject(verification.id, rejectReason, adminNotes);
  }

  function formatDate(dateString: string | Date | undefined): string {
    if (!dateString) return 'N/A';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Verification Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={actionLoading}
          >
            <span className="text-2xl">✕</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Error Display */}
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-red-600 text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-900">Action Failed</h3>
                <p className="text-red-700 text-sm">{actionError}</p>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
              verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
              verification.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
              verification.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
              'bg-gray-100 text-gray-800 border-gray-200'
            }`}>
              {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
            </span>
            {verification.reviewed_at && (
              <span className="text-sm text-gray-500">
                Reviewed: {formatDate(verification.reviewed_at)}
              </span>
            )}
          </div>

          {/* User Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">User Information</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">Name:</span>{' '}
                  <span className="text-gray-600">{verification.user_name || 'Unknown'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">Email:</span>{' '}
                  <span className="text-gray-600">{verification.user_email || 'No email'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">User ID:</span>{' '}
                  <span className="text-gray-600 font-mono text-xs">{verification.user_id}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Plan Information</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">Plan:</span>{' '}
                  <span className="text-gray-600">{verification.plan_name || 'Unknown'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">Amount:</span>{' '}
                  <span className="text-gray-600">${verification.plan_amount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">Plan ID:</span>{' '}
                  <span className="text-gray-600 font-mono text-xs">{verification.plan_id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Payment Details</h3>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="text-sm">
                <span className="font-medium text-gray-900">Reference Number:</span>{' '}
                <span className="text-gray-600">{verification.reference_number || 'N/A'}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-900">Submitted:</span>{' '}
                <span className="text-gray-600">{formatDate(verification.submitted_at)}</span>
              </div>
              {verification.notes && (
                <div className="text-sm">
                  <span className="font-medium text-gray-900">User Notes:</span>{' '}
                  <span className="text-gray-600">{verification.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Payment Screenshot</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <a
                href={verification.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-900 text-sm underline"
              >
                {verification.screenshot_url}
              </a>
            </div>
          </div>

          {/* Existing Admin Notes */}
          {verification.admin_notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Previous Admin Notes</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700">
                {verification.admin_notes}
              </div>
            </div>
          )}

          {/* Admin Notes Input */}
          {verification.status === 'pending' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Admin Notes</h3>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this verification..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={actionLoading}
              />
            </div>
          )}

          {/* Reject Form */}
          {verification.status === 'pending' && showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-900 mb-2">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a clear reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                disabled={actionLoading}
                required
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {verification.status === 'pending' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={handleApproveClick}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Processing...' : '✅ Approve Payment'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ❌ Reject Payment
                </button>
                <button
                  onClick={onClose}
                  disabled={actionLoading}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleRejectClick}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Processing...' : '❌ Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason('');
                  }}
                  disabled={actionLoading}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}