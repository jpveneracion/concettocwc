'use client';

import { CheckCircle2 } from 'lucide-react';

interface EncryptionModalProps {
  show: boolean;
  message?: string;
  phase?: 'encrypting' | 'verifying' | 'deleting' | 'complete';
}

export default function EncryptionModal({
  show,
  message = 'Encrypting sensitive data...',
  phase = 'encrypting'
}: EncryptionModalProps) {
  if (!show) return null;

  const phaseMessages = {
    encrypting: 'Encrypting sensitive data...',
    verifying: 'Verifying encryption integrity...',
    deleting: 'Deleting plaintext data...',
    complete: 'Encryption complete',
  };

  const displayMessage = message || phaseMessages[phase];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3">
          {phase === 'complete' ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          ) : (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-stone-900">
              {phase === 'complete' ? 'Complete' : 'Processing'}
            </h3>
            <p className="text-sm text-stone-600 mt-1">{displayMessage}</p>
          </div>
        </div>
        {phase !== 'complete' && (
          <p className="text-xs text-stone-500 mt-4">
            {phase === 'encrypting' && 'Encrypting and verifying your data...'}
            {phase === 'verifying' && 'Confirming all data encrypted correctly...'}
            {phase === 'deleting' && 'Removing unencrypted copies...'}
          </p>
        )}
      </div>
    </div>
  );
}
