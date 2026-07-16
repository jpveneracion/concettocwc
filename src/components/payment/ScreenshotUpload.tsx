'use client';

import { useState, useRef } from 'react';

interface ScreenshotUploadProps {
  onScreenshotSelect: (base64: string) => void;
  initialScreenshot?: string;
}

export default function ScreenshotUpload({
  onScreenshotSelect,
  initialScreenshot
}: ScreenshotUploadProps) {
  const [screenshot, setScreenshot] = useState<string | null>(initialScreenshot || null);
  const [preview, setPreview] = useState<string | null>(initialScreenshot || null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG and JPEG images are allowed');
      return false;
    }

    // Check file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setScreenshot(base64);
        setPreview(base64);
        onScreenshotSelect(base64);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setScreenshot(null);
    setPreview(null);
    setError(null);
    onScreenshotSelect('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Payment Screenshot *
      </label>

      {!preview ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-4 sm:p-6 text-center
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
            ${error ? 'border-red-300 bg-red-50' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="space-y-2">
            <div className="text-3xl">📸</div>
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG or JPEG, max 5MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={preview}
              alt="Payment Screenshot"
              className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-3 hover:bg-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Remove screenshot"
              aria-label="Remove screenshot"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handleRemove}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Remove and choose different image
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {!preview && !error && (
        <div className="mt-2 text-xs text-gray-500">
          <strong>Tips:</strong> Ensure screenshot shows payment amount, date, and transaction reference
        </div>
      )}
    </div>
  );
}