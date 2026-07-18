'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import VerificationTable from '@/components/admin/VerificationTable';
import VerificationStatsCards from '@/components/admin/VerificationStats';
import VerificationDetail from '@/components/admin/VerificationDetail';
import VerificationInterface from '@/components/admin/VerificationInterface';
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
  const [showVerificationInterface, setShowVerificationInterface] = useState(false);
  const [selectedVerificationId, setSelectedVerificationId] = useState<string | null>(null);
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

  const handleVerificationComplete = (approved: boolean) => {
    // Refresh the verification list after action completes
    fetchVerifications();
    setShowVerificationInterface(false);
    setSelectedVerificationId(null);
  };

  const openVerificationInterface = (verificationId: string) => {
    setSelectedVerificationId(verificationId);
    setShowVerificationInterface(true);
  };

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
        <VerificationStatsCards
          stats={stats}
          loading={loading}
        />

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
        <VerificationTable
          verifications={verifications}
          onRowClick={(verification) => openVerificationInterface(verification.id)}
          loading={loading}
        />

        {/* Detail Modal */}
        {showDetailModal && selectedVerification && (
          <VerificationDetail
            verification={selectedVerification}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedVerification(null);
              setActionError(null);
            }}
            onSuccess={() => {
              // Refresh data after action
              Promise.all([
                fetchStats(),
                fetchVerifications(),
                fetchPendingCount()
              ]);
              setShowDetailModal(false);
              setSelectedVerification(null);
            }}
          />
        )}

        {/* Verification Interface Modal */}
        {showVerificationInterface && selectedVerificationId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <VerificationInterface
                verificationId={selectedVerificationId}
                onVerificationComplete={handleVerificationComplete}
                onBack={() => setShowVerificationInterface(false)}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

