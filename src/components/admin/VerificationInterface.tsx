'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import type {
  PaymentVerification,
  VerificationStatus,
  EnhancedPaymentVerification,
  GCashWebhookData,
  ApproveVerificationRequest,
  RejectVerificationRequest
} from '@/types/payment';

interface VerificationInterfaceProps {
  verificationId: string;
  onVerificationComplete: (approved: boolean) => void;
  onBack?: () => void;
}

interface VerificationState {
  verification: EnhancedPaymentVerification | null;
  webhookData: GCashWebhookData | null;
  loading: boolean;
  error: string | null;
}

interface ActionState {
  processing: boolean;
  error: string | null;
  success: boolean;
}

interface ConfirmationState {
  showApproveConfirm: boolean;
  showRejectConfirm: boolean;
}

// Constants for timing and UI behavior
const SUCCESS_DISPLAY_DELAY_MS = 1500; // Allow user to see success message before closing modal

export default function VerificationInterface({
  verificationId,
  onVerificationComplete,
  onBack
}: VerificationInterfaceProps) {
  const [verificationState, setVerificationState] = useState<VerificationState>({
    verification: null,
    webhookData: null,
    loading: true,
    error: null
  });

  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmationState>({
    showApproveConfirm: false,
    showRejectConfirm: false
  });
  const [actionState, setActionState] = useState<ActionState>({
    processing: false,
    error: null,
    success: false
  });

  // Fetch verification details on mount
  useEffect(() => {
    fetchVerificationDetails();
  }, [verificationId]);

  // Reset state when verification changes
  useEffect(() => {
    setAdminNotes('');
    setRejectReason('');
    setConfirmState({ showApproveConfirm: false, showRejectConfirm: false });
    setActionState({ processing: false, error: null, success: false });
  }, [verificationId]);

  async function fetchVerificationDetails() {
    setVerificationState({
      verification: null,
      webhookData: null,
      loading: true,
      error: null
    });

    try {
      // Fetch verification details
      const response = await fetch(`/api/payment-verifications/${verificationId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch verification details');
      }

      const verification = await response.json();

      // Fetch webhook data if available
      let webhookData = null;
      if (verification.webhook_data_id) {
        try {
          const webhookResponse = await fetch(`/api/gcash-webhook/${verification.webhook_data_id}`);
          if (webhookResponse.ok) {
            webhookData = await webhookResponse.json();
          }
        } catch (error) {
          console.error('Error fetching webhook data:', error);
        }
      }

      setVerificationState({
        verification: { ...verification, id: verificationId },
        webhookData,
        loading: false,
        error: null
      });

    } catch (err) {
      setVerificationState({
        verification: null,
        webhookData: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch verification details'
      });
    }
  }

  async function handleApprove() {
    if (!verificationState.verification ||
        verificationState.verification.status !== 'pending' ||
        actionState.processing) return;

    setActionState({ processing: true, error: null, success: false });

    try {
      const request: ApproveVerificationRequest = {
        admin_notes: adminNotes.trim() || undefined
      };

      const response = await fetch(`/api/payment-verifications/${verificationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve verification');
      }

      setActionState({ processing: false, error: null, success: true });

      // Notify parent component
      setTimeout(() => {
        onVerificationComplete(true);
      }, SUCCESS_DISPLAY_DELAY_MS);

    } catch (err) {
      setActionState({
        processing: false,
        error: err instanceof Error ? err.message : 'Failed to approve verification',
        success: false
      });
    }
  }

  async function handleReject() {
    if (!verificationState.verification ||
        verificationState.verification.status !== 'pending' ||
        actionState.processing) return;

    if (!rejectReason.trim()) {
      setActionState({
        processing: false,
        error: 'Rejection reason is required',
        success: false
      });
      return;
    }

    setActionState({ processing: true, error: null, success: false });

    try {
      const request: RejectVerificationRequest = {
        reason: rejectReason.trim(),
        admin_notes: adminNotes.trim() || undefined
      };

      const response = await fetch(`/api/payment-verifications/${verificationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject verification');
      }

      setActionState({ processing: false, error: null, success: true });

      // Notify parent component
      setTimeout(() => {
        onVerificationComplete(false);
      }, SUCCESS_DISPLAY_DELAY_MS);

    } catch (err) {
      setActionState({
        processing: false,
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

  function getVerificationMethodBadge(method: 'automatic' | 'manual') {
    const config = method === 'automatic'
      ? { bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200' }
      : { bgColor: 'bg-purple-100', textColor: 'text-purple-800', borderColor: 'border-purple-200' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {method === 'automatic' ? '🤖 Automatic' : '👤 Manual'}
      </span>
    );
  }

  function getAutomaticVerificationStatus(status?: string) {
    if (!status) return null;

    const statusConfig = {
      matched: { bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200', label: '✅ Matched' },
      no_webhook_data: { bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200', label: '❓ No Webhook Data' },
      amount_mismatch: { bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200', label: '❌ Amount Mismatch' },
      time_mismatch: { bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200', label: '⏰ Time Mismatch' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {config.label}
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

  // Loading state
  if (verificationState.loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Verification Details</h2>
          <p className="text-gray-600 text-center">Please wait while we fetch the verification information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (verificationState.error || !verificationState.verification) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Verification</h2>
          <p className="text-red-600 text-center mb-4">{verificationState.error || 'Verification not found'}</p>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-purple-600 hover:text-purple-900 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Verifications
            </button>
          )}
        </div>
      </div>
    );
  }

  const verification = verificationState.verification;
  const webhookData = verificationState.webhookData;
  const isPending = verification.status === 'pending';

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="text-white hover:text-purple-200 transition-colors p-2 rounded-lg hover:bg-white/10"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 id="verification-title" className="text-2xl font-bold text-white">Payment Verification Review</h1>
              <p className="text-purple-100 text-sm">Manual review for verification: {verificationId.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(verification.status)}
            {getVerificationMethodBadge(verification.verification_method)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {actionState.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Action Completed Successfully</h3>
              <p className="text-green-700 text-sm">
                Verification has been {confirmState.showApproveConfirm ? 'approved' : 'rejected'} and the user will be notified.
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
              className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Verification Details (2x2 grid) */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">📋</span>
            Verification Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reference Number */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Reference Number</h3>
              <p className="text-lg font-mono font-bold text-gray-900">
                {verification.cleaned_reference_number || verification.reference_number || 'N/A'}
              </p>
            </div>

            {/* Submitted Time */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Submitted At</h3>
              <p className="text-lg text-gray-900">{formatDate(verification.submitted_at)}</p>
            </div>

            {/* Verification Method */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Verification Method</h3>
              <div className="flex items-center gap-2">
                {getVerificationMethodBadge(verification.verification_method)}
              </div>
            </div>

            {/* Automatic Verification Status */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Automatic Status</h3>
              <div className="flex items-center gap-2">
                {verification.automatic_verification_attempted ? (
                  getAutomaticVerificationStatus(verification.automatic_verification_status)
                ) : (
                  <span className="text-gray-400 text-sm">Not attempted</span>
                )}
              </div>
            </div>

            {/* User Information */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">User Information</h3>
              <div className="space-y-1">
                <p className="text-gray-900 font-medium">{verification.user_name || 'Unknown'}</p>
                <p className="text-gray-600 text-sm">{verification.user_email || 'No email'}</p>
              </div>
            </div>

            {/* Plan Information */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Plan Information</h3>
              <div className="space-y-1">
                <p className="text-gray-900 font-medium">{verification.plan_name || 'Unknown'}</p>
                <p className="text-gray-900 font-bold text-lg">{formatCurrency(verification.plan_amount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Data Comparison (if available) */}
        {webhookData && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">📡</span>
              Webhook Data Comparison
            </h2>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Number */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Transaction Number</h3>
                  <p className="text-lg font-mono font-bold text-gray-900">{webhookData.transaction_number}</p>
                  {webhookData.cleaned_transaction_number !== webhookData.transaction_number && (
                    <p className="text-sm text-gray-600">Cleaned: {webhookData.cleaned_transaction_number}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Amount</h3>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(webhookData.amount)}</p>
                  {verification.plan_amount && webhookData.amount !== verification.plan_amount && (
                    <p className="text-sm text-orange-600">Expected: {formatCurrency(verification.plan_amount)}</p>
                  )}
                </div>

                {/* Sender Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Sender Information</h3>
                  <p className="text-gray-900 font-medium">{webhookData.sender_name || 'N/A'}</p>
                  <p className="text-gray-600 text-sm font-mono">{webhookData.sender_account || 'N/A'}</p>
                </div>

                {/* Transaction Time */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Transaction Time</h3>
                  <p className="text-gray-900">{formatDate(webhookData.transaction_time)}</p>
                  <p className="text-gray-600 text-sm">Received: {formatDate(webhookData.received_at)}</p>
                </div>
              </div>

              {/* Raw notification text */}
              {webhookData.notification_text && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Notification Text</h3>
                  <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200 font-mono">
                    {webhookData.notification_text}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Screenshot */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">🖼️</span>
            Payment Screenshot
          </h2>
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
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden flex justify-center">
              <img
                src={verification.screenshot_url}
                alt="Payment screenshot"
                className="w-full h-auto max-h-96 object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23f3f4f6" width="400" height="200"/%3E%3Ctext fill="%236b7280" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage failed to load%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
          </div>
        </div>

        {/* User Notes (if present) */}
        {verification.notes && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">📝</span>
              User Notes
            </h2>
            <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
              <p className="text-gray-700 whitespace-pre-wrap">{verification.notes}</p>
            </div>
          </div>
        )}

        {/* Admin Actions Section */}
        {isPending && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">⚖️</span>
              Admin Actions
            </h2>

            {/* Admin Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this verification that may be helpful for future reference..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                disabled={actionState.processing}
              />
            </div>

            {/* Reject Reason (conditional) */}
            {confirmState.showRejectConfirm && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-red-900 mb-2">
                  Rejection Reason <span className="text-red-600 font-normal">(Required)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a clear and specific reason for rejection to help the user understand the issue..."
                  rows={4}
                  className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none bg-white"
                  disabled={actionState.processing}
                  required
                />
                <p className="text-xs text-red-600 mt-2">
                  This reason will be shared with the user to help them resolve the payment issue.
                </p>
              </div>
            )}

            {/* Confirmation Messages */}
            {confirmState.showApproveConfirm && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
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

            {confirmState.showRejectConfirm && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!confirmState.showApproveConfirm && !confirmState.showRejectConfirm ? (
                <>
                  <button
                    onClick={() => setConfirmState({ ...confirmState, showApproveConfirm: true })}
                    disabled={actionState.processing}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Payment
                  </button>
                  <button
                    onClick={() => setConfirmState({ ...confirmState, showRejectConfirm: true })}
                    disabled={actionState.processing}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Payment
                  </button>
                  {onBack && (
                    <button
                      onClick={onBack}
                      disabled={actionState.processing}
                      className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : confirmState.showApproveConfirm ? (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={actionState.processing}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {actionState.processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm Approval
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmState({ ...confirmState, showApproveConfirm: false })}
                    disabled={actionState.processing}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleReject}
                    disabled={actionState.processing || !rejectReason.trim()}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {actionState.processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        Confirm Rejection
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmState({ ...confirmState, showRejectConfirm: false });
                      setRejectReason('');
                    }}
                    disabled={actionState.processing}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Existing Admin Notes (for completed verifications) */}
        {!isPending && verification.admin_notes && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">📝</span>
              Admin Review Notes
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{verification.admin_notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}