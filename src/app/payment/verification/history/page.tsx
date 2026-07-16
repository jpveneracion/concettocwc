'use client';

import VerificationHistory from '@/components/payment/VerificationHistory';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Verification History
          </h1>
          <p className="text-gray-600">
            Track the status of your payment verifications
          </p>
        </div>

        {/* History Component */}
        <VerificationHistory />

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• <strong>Pending:</strong> Your verification is being reviewed (usually within 24 hours)</p>
            <p>• <strong>Approved:</strong> Your payment was confirmed and subscription activated</p>
            <p>• <strong>Rejected:</strong> There was an issue with your verification. Check admin notes for details.</p>
          </div>
          <a
            href="mailto:support@concetto.com"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </div>
  );
}