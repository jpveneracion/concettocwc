'use client';

interface EncryptionModalProps {
  show: boolean;
  message?: string;
}

export default function EncryptionModal({ show, message = 'Encrypting sensitive data...' }: EncryptionModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Processing</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Encrypting and verifying your data...
        </p>
      </div>
    </div>
  );
}
