'use client';

import { useState, useEffect } from 'react';
import { PricingHistoryEntry } from '@/lib/pricing-service';
import { getChangeTypeBadgeClass, getChangeTypeCardStyles, getTimelineDotClass, formatRelativeTime } from '@/lib/utils/pricing-utils';
import LoadingSpinner from './LoadingSpinner';

interface PricingHistoryProps {
  onClose: () => void;
  onRollback: (historyId: string, reason: string) => void;
}

export default function PricingHistory({ onClose, onRollback }: PricingHistoryProps) {
  const [history, setHistory] = useState<PricingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollbackMode, setRollbackMode] = useState<{ id: string; reason: string } | null>(null);
  const [processingRollback, setProcessingRollback] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/pricing/history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch pricing history');
      }
    } catch (error) {
      console.error('Failed to fetch pricing history:', error);
      setError('Failed to fetch pricing history');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackMode) return;

    try {
      setProcessingRollback(true);
      setError(null);

      const response = await fetch('/api/admin/pricing/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history_id: rollbackMode.id,
          reason: rollbackMode.reason
        })
      });

      if (response.ok) {
        onRollback(rollbackMode.id, rollbackMode.reason);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to rollback pricing');
        setProcessingRollback(false);
      }
    } catch (error) {
      console.error('Failed to rollback pricing:', error);
      setError('Failed to rollback pricing');
      setProcessingRollback(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white rounded-t-xl md:rounded-lg p-6 w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Pricing Change History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            aria-label="Close pricing history dialog"
          >
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
              aria-label="Dismiss error message"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" text="Loading history..." />
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              aria-label="Retry loading pricing history"
            >
              Try again
            </button>
          </div>
        ) : history.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="text-gray-300 text-6xl mb-4">📋</div>
            <p className="text-gray-600">No pricing history found</p>
            <p className="text-sm text-gray-500 mt-2">
              Pricing changes will appear here once they are made
            </p>
          </div>
        ) : (
          /* Timeline Display */
          <div className="space-y-4">
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`border rounded-lg p-4 ${getChangeTypeCardStyles(entry.change_type).bg} ${getChangeTypeCardStyles(entry.change_type).border}`}
                >
                  {/* Header with badge and timestamp */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getChangeTypeBadgeClass(entry.change_type)}`}>
                      {entry.change_type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      #{history.length - index}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatRelativeTime(entry.changed_at)}
                  </div>

                  {/* Change Reason */}
                  {entry.change_reason && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium text-gray-800">Reason:</span>{' '}
                      <span className="italic text-gray-600">"{entry.change_reason}"</span>
                    </div>
                  )}

                  {/* Changed Field Details */}
                  {entry.changed_field && (
                    <div className="text-xs text-gray-600 mb-3">
                      <span className="font-medium">Field:</span> {entry.changed_field}
                    </div>
                  )}

                  {/* Rollback Button */}
                  {entry.previous_config && (
                    <button
                      onClick={() => setRollbackMode({
                        id: entry.id,
                        reason: `Rollback to version from ${new Date(entry.changed_at).toLocaleDateString()}`
                      })}
                      className="w-full text-sm text-blue-600 hover:text-blue-800 underline font-medium py-2 border-t border-gray-200 pt-3"
                      disabled={processingRollback}
                      aria-label={`Rollback to version from ${new Date(entry.changed_at).toLocaleDateString()}`}
                      aria-haspopup="dialog"
                    >
                      Rollback to this version
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Timeline Layout */}
            <div className="hidden md:block space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="relative border-l-2 border-gray-200 pl-4 pb-4 last:pb-0 last:border-l-0"
                >
                  {/* Timeline Dot */}
                  <div className={`absolute -left-2 top-0 w-4 h-4 rounded-full border-2 ${getTimelineDotClass(entry.change_type)}`} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Change Type Badge and Timestamp */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getChangeTypeBadgeClass(entry.change_type)}`}>
                          {entry.change_type.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatRelativeTime(entry.changed_at)}
                        </span>
                        <span className="text-xs text-gray-400">
                          #{history.length - index}
                        </span>
                      </div>

                      {/* Change Reason */}
                      {entry.change_reason && (
                        <p className="text-sm text-gray-700 mb-2">
                          <span className="font-medium text-gray-800">Reason:</span>{' '}
                          <span className="italic text-gray-600">"{entry.change_reason}"</span>
                        </p>
                      )}

                      {/* Changed Field Details */}
                      {entry.changed_field && (
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">Field:</span> {entry.changed_field}
                        </div>
                      )}

                      {/* Rollback Button */}
                      {entry.previous_config && (
                        <div className="mt-3">
                          <button
                            onClick={() => setRollbackMode({
                              id: entry.id,
                              reason: `Rollback to version from ${new Date(entry.changed_at).toLocaleDateString()}`
                            })}
                            className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                            disabled={processingRollback}
                            aria-label={`Rollback to version from ${new Date(entry.changed_at).toLocaleDateString()}`}
                            aria-haspopup="dialog"
                          >
                            Rollback to this version
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackMode && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-xl md:rounded-lg p-6 w-full md:max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Confirm Rollback</h3>

            <p className="text-sm text-gray-600 mb-4">
              This will restore the pricing configuration from the selected history entry.
              All changes made since that point will be lost.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rollback Reason (Required)
              </label>
              <textarea
                value={rollbackMode.reason}
                onChange={(e) => setRollbackMode({ ...rollbackMode, reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                placeholder="Explain why you are rolling back this change..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRollbackMode(null)}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-medium min-h-[44px] hover:bg-gray-300 transition-colors"
                disabled={processingRollback}
                aria-label="Cancel rollback operation"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium min-h-[44px] hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed"
                disabled={processingRollback || !rollbackMode.reason.trim()}
                aria-label="Confirm rollback to previous pricing version"
              >
                {processingRollback ? 'Processing...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}