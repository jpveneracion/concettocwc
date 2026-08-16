'use client';

import { useEffect } from 'react';
import { Siren } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Application Error:', error);
    console.error('Error Stack:', error.stack);
    console.error('Error Digest:', error.digest);

    // You can also log to an error reporting service here
    // logErrorToService(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {/* Error Icon */}
          <Siren className="w-16 h-16 mx-auto mb-4 text-rose-600" />

          <h1 className="text-2xl font-bold text-stone-900 mb-4">
            Something went wrong!
          </h1>

          {/* Error Details Section */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <h2 className="font-semibold text-red-900 mb-2">Error Details:</h2>
            <p className="text-red-800 font-mono text-sm break-words">
              {error.message}
            </p>

            {error.digest && (
              <p className="text-red-700 text-xs mt-2">
                Error ID: {error.digest}
              </p>
            )}

            {error.stack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-red-700 text-sm hover:text-red-900">
                  View Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40 text-red-900">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          {/* Additional Debugging Info */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-indigo-900 mb-2">Debug Information:</h3>
            <ul className="text-indigo-800 text-sm space-y-1">
              <li>• URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</li>
              <li>• User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</li>
              <li>• Timestamp: {new Date().toISOString()}</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-stone-600 text-white rounded-lg font-medium hover:bg-stone-700 transition-colors"
            >
              Go to Homepage
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {/* Help Text */}
          <p className="text-stone-600 text-sm mt-6">
            If this error persists, please contact support with the Error ID shown above.
          </p>
        </div>
      </div>
    </div>
  );
}