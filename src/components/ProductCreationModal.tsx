'use client';
import { useState, useCallback } from 'react';
import type { ProductUnit } from '@/types/product';
import type { CreateCompanyProductRequest } from '@/types/company-product';

// Input sanitization utility
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/[<>\"'`]/g, '') // Remove potentially dangerous characters
    .slice(0, 500); // Limit length
}

interface ProductCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
  onSuccess: (productData: {
    product_id: string;
    product_code: string;
    product_collection: string;
    product_description: string;
    retail_price_sqft: number;
    supplier_cost_sqft: number;
  }) => void;
}

export default function ProductCreationModal({
  isOpen,
  onClose,
  productCode,
  onSuccess,
}: ProductCreationModalProps) {
  const [formData, setFormData] = useState({
    collection: '',
    description: '',
    unit: 'sqft' as ProductUnit,
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const validateForm = useCallback(() => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (formData.collection.length > 100) {
      newErrors.collection = 'Collection must be 100 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Sanitize inputs before API call
      const sanitizedCollection = formData.collection ? sanitizeInput(formData.collection) : '';
      const sanitizedDescription = sanitizeInput(formData.description);
      const sanitizedCode = sanitizeInput(productCode).toUpperCase();

      // Validate sanitized inputs
      if (!sanitizedDescription || sanitizedDescription.length === 0) {
        setApiError('Description is required and cannot be empty after sanitization.');
        setSubmitting(false);
        return;
      }

      if (sanitizedCode.length === 0) {
        setApiError('Product code is required and cannot be empty after sanitization.');
        setSubmitting(false);
        return;
      }

      const requestBody: CreateCompanyProductRequest = {
        code: sanitizedCode,
        collection: sanitizedCollection || undefined,
        description: sanitizedDescription,
        unit: formData.unit,
      };

      const response = await fetch('/api/company-products/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess({
          product_id: data.id,
          product_code: data.code,
          product_collection: data.collection || '',
          product_description: data.description,
          retail_price_sqft: 0,
          supplier_cost_sqft: 0,
        });
        handleClose();
      } else if (response.status === 409) {
        setApiError('A product with this code already exists');
      } else if (response.status === 400) {
        setApiError(data.error || 'Invalid data provided');
      } else {
        setApiError('Failed to create product. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create product:', error);
      setApiError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    setFormData({ collection: '', description: '', unit: 'sqft' });
    setErrors({});
    setApiError('');
    onClose();
  }, [onClose]);

  const handleInputChange = (
    field: 'collection' | 'description' | 'unit',
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Create New Product
              </h3>
              <button
                onClick={handleClose}
                aria-label="Close modal"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Add "{productCode.toUpperCase()}" to your product catalog
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Product Code (Read-only) */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Product Code
              </label>
              <input
                type="text"
                value={productCode.toUpperCase()}
                readOnly
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-600 font-medium min-h-[44px]"
              />
            </div>

            {/* Collection (Optional) */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Collection <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.collection}
                onChange={(e) => handleInputChange('collection', e.target.value)}
                placeholder="e.g. Premium Collection"
                maxLength={100}
                className={`w-full border rounded-lg px-4 py-3 text-sm min-h-[44px] ${
                  errors.collection
                    ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200'
                    : 'border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200'
                }`}
              />
              {errors.collection && (
                <p className="text-xs text-red-500 mt-1">{errors.collection}</p>
              )}
            </div>

            {/* Description (Required) */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="e.g. Blackout roller blind with aluminum chain"
                rows={3}
                maxLength={500}
                required
                className={`w-full border rounded-lg px-4 py-3 text-sm min-h-[88px] resize-none ${
                  errors.description
                    ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200'
                    : 'border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200'
                }`}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.description ? (
                  <p className="text-xs text-red-500">{errors.description}</p>
                ) : (
                  <p className="text-xs text-gray-400">
                    {formData.description.length}/500 characters
                  </p>
                )}
              </div>
            </div>

            {/* Unit Selection */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Unit <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="sqft">Square Feet (sq.ft.)</option>
                <option value="sqm">Square Meters (sq.m.)</option>
              </select>
            </div>

            {/* API Error Message */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-600">{apiError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                aria-label="Cancel product creation"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                aria-label={submitting ? 'Creating product' : 'Create product'}
                aria-live="polite"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 min-h-[44px] disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}