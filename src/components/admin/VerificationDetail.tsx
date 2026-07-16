'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type {
  PaymentVerification,
  VerificationStatus,
  ApproveVerificationRequest,
  RejectVerificationRequest
} from '@/types/payment';

interface VerificationDetailProps {
  verification: PaymentVerification;
  onClose: () => void;
  onSuccess?: (action: 'approve' | 'reject') => void;
}

interface ActionState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface ConfirmationState {
  showApproveConfirm: boolean;
  showRejectConfirm: boolean;
}

export default function VerificationDetail({
  verification,
  onClose,
  onSuccess
}: VerificationDetailProps) {
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmationState>({
    showApproveConfirm: false,
    showRejectConfirm: false
  });
  const [actionState, setActionState] = useState<ActionState>({
    loading: false,
    error: null,
    success: false
  });

  // Reset state when verification changes
  useEffect(() => {
    setAdminNotes('');
    setRejectReason('');
    setConfirmState({ showApproveConfirm: false, showRejectConfirm: false });
    setActionState({ loading: false, error: null, success: false });
  }, [verification.id]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionState.loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [actionState.loading, onClose]);

  async function handleApprove() {
    if (verification.status !== 'pending' || actionState.loading) return;

    setActionState({ loading: true, error: null, success: false });

    try {
      const request: ApproveVerificationRequest = {
        admin_notes: adminNotes.trim() || undefined
      };

      const response = await fetch(`/api/payment-verifications/${verification.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve verification');
      }

      setActionState({ loading: false, error: null, success: true });
      onSuccess?.('approve');

      // Close modal after brief success display
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      setActionState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to approve verification',
        success: false
      });
    }
  }

  async function handleReject() {
    if (verification.status !== 'pending' || actionState.loading) return;
    if (!rejectReason.trim()) {
      setActionState({
        loading: false,
        error: 'Rejection reason is required',
        success: false
      });
      return;
    }

    setActionState({ loading: true, error: null, success: false });

    try {
      const request: RejectVerificationRequest = {
        reason: rejectReason.trim(),
        admin_notes: adminNotes.trim() || undefined
      };

      const response = await fetch(`/api/payment-verifications/${verification.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject verification');
      }

      setActionState({ loading: false, error: null, success: true });
      onSuccess?.('reject');

      // Close modal after brief success display
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      setActionState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to reject verification',
        success: false
      });
    }
  }

  function getStatusBadge(status: VerificationStatus) {
    const statusConfig = {
      pending: {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: <AlertCircle className="w-4 h-4" />
      },
      approved: {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: <CheckCircle className="w-4 h-4" />
      },
      rejected: {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: <XCircle className="w-4 h-4" />
      },
      expired: {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        borderColor: 'border-gray-200',
        icon: <AlertCircle className="w-4 h-4" />
      }
    };

    const config = statusConfig[status] || statusConfig.expired;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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

  function formatCurrency(amount: number | undefined): string {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  const isPending = verification.status === 'pending';
  const canShowApproveConfirm = isPending && !confirmState.showRejectConfirm;
  const canShowRejectConfirm = isPending && !confirmState.showApproveConfirm;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-detail-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2
              id="verification-detail-title"
              className="text-xl font-bold text-gray-900"
            >
              Payment Verification Details
            </h2>
            {getStatusBadge(verification.status)}
          </div>
          <button
            onClick={onClose}
            disabled={actionState.loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          {actionState.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Action Completed Successfully</h3>
                <p className="text-green-700 text-sm">
                  Verification has been {confirmState.showApproveConfirm ? 'approved' : 'rejected'} and user will be notified.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {actionState.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Action Failed</h3>
                <p className="text-red-700 text-sm">{actionState.error}</p>
              </div>
              <button
                onClick={() => setActionState({ ...actionState, error: null })}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Timestamp Information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Submitted:</span> {formatDate(verification.submitted_at)}
            </div>
            {verification.reviewed_at && (
              <div>
                <span className="font-medium">Reviewed:</span> {formatDate(verification.reviewed_at)}
              </div>
            )}
          </div>

          {/* User and Plan Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">👤</span>
                User Information
              </h3>
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200 space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">Name:</span>
                  <span className="text-sm text-gray-900 font-medium">{verification.user_name || 'Unknown'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">Email:</span>
                  <span className="text-sm text-gray-900 font-mono text-right">{verification.user_email || 'No email'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">User ID:</span>
                  <span className="text-xs text-gray-600 font-mono bg-white px-2 py-0.5 rounded">{verification.user_id}</span>
                </div>
              </div>
            </div>

            {/* Plan Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">📋</span>
                Plan Information
              </h3>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">Plan:</span>
                  <span className="text-sm text-gray-900 font-medium">{verification.plan_name || 'Unknown'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">Amount:</span>
                  <span className="text-sm text-gray-900 font-bold">{formatCurrency(verification.plan_amount)}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700">Plan ID:</span>
                  <span className="text-xs text-gray-600 font-mono bg-white px-2 py-0.5 rounded">{verification.plan_id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">💳</span>
              Payment Details
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-700">Reference Number:</span>
                <span className="text-sm text-gray-900 font-mono font-medium">{verification.reference_number || 'N/A'}</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-700">Submitted At:</span>
                <span className="text-sm text-gray-900">{formatDate(verification.submitted_at)}</span>
              </div>
              {verification.notes && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700 block mb-1">User Notes:</span>
                  <p className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                    {verification.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot Preview */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">🖼️</span>
              Payment Screenshot
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <a
                  href={verification.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-900 text-sm font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open screenshot in new tab
                </a>
              </div>
              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                <img
                  src={verification.screenshot_url}
                  alt="Payment screenshot"
                  className="w-full h-auto max-h-96 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23f3f4f6" width="400" height="200"/%3E%3Ctext fill="%236b7280" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage failed to load%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                IPFS/Pinata URL: {verification.screenshot_url}
              </p>
            </div>
          </div>

          {/* Existing Admin Notes */}
          {verification.admin_notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">📝</span>
                Previous Admin Notes
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{verification.admin_notes}</p>
              </div>
            </div>
          )}

          {/* Admin Notes Input */}
          {isPending && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">✏️</span>
                Admin Notes
                <span className="text-xs font-normal text-gray-500">(Optional)</span>
              </h3>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this verification that may be helpful for future reference..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                disabled={actionState.loading}
              />
            </div>
          )}

          {/* Reject Reason Input */}
          {isPending && confirmState.showRejectConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Rejection Reason
                <span className="text-xs font-normal text-red-600">(Required)</span>
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a clear and specific reason for rejection to help the user understand the issue..."
                rows={4}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none bg-white"
                disabled={actionState.loading}
                required
              />
              <p className="text-xs text-red-600 mt-2">
                This reason will be shared with the user to help them resolve the payment issue.
              </p>
            </div>
          )}

          {/* Action Confirmation Messages */}
          {isPending && confirmState.showApproveConfirm && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-900">Confirm Approval</h4>
                  <p className="text-sm text-green-800 mt-1">
                    Are you sure you want to approve this payment verification? This will activate the user's subscription and send them a confirmation notification.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPending && confirmState.showRejectConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900">Confirm Rejection</h4>
                  <p className="text-sm text-red-800 mt-1">
                    Are you sure you want to reject this payment verification? The user will be notified and will need to submit a new verification.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {isPending && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            {!confirmState.showApproveConfirm && !confirmState.showRejectConfirm ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setConfirmState({ ...confirmState, showApproveConfirm: true })}
                  disabled={actionState.loading}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {actionState.loading ? 'Processing...' : 'Approve Payment'}
                </button>
                <button
                  onClick={() => setConfirmState({ ...confirmState, showRejectConfirm: true })}
                  disabled={actionState.loading}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Reject Payment
                </button>
                <button
                  onClick={onClose}
                  disabled={actionState.loading}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : confirmState.showApproveConfirm ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApprove}
                  disabled={actionState.loading}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {actionState.loading ? 'Processing...' : '✅ Confirm Approval'}
                </button>
                <button
                  onClick={() => setConfirmState({ ...confirmState, showApproveConfirm: false })}
                  disabled={actionState.loading}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleReject}
                  disabled={actionState.loading || !rejectReason.trim()}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  {actionState.loading ? 'Processing...' : '❌ Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setConfirmState({ ...confirmState, showRejectConfirm: false });
                    setRejectReason('');
                  }}
                  disabled={actionState.loading}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
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