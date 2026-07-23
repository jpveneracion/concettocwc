'use client';

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  'aria-label'?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text = 'Loading...',
  className = '',
  'aria-label': ariaLabel
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  const spinnerId = React.useId();
  const descriptionId = `spinner-desc-${spinnerId}`;

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={ariaLabel || 'Loading content'}
      >
        <svg
          className={`animate-spin rounded-full border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {text && (
        <span id={descriptionId} className="text-gray-600">
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;