'use client';

import { useState, useEffect } from 'react';

interface PlanFeature {
  id: string;
  text: string;
}

interface SubscriptionPlanFormProps {
  onSubmit: (planData: SubscriptionPlanData) => Promise<void>;
  onCancel: () => void;
  initialData?: SubscriptionPlanData;
  isLoading?: boolean;
}

interface SubscriptionPlanData {
  id?: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'quarter' | 'year';
  discount_percent: number;
  features: string[];
  is_active: boolean;
}

export default function SubscriptionPlanForm({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false
}: SubscriptionPlanFormProps) {
  const [formData, setFormData] = useState<SubscriptionPlanData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    currency: initialData?.currency || 'PHP',
    interval: initialData?.interval || 'month',
    discount_percent: initialData?.discount_percent || 0,
    features: initialData?.features || [],
    is_active: initialData?.is_active !== undefined ? initialData.is_active : true
  });

  const [features, setFeatures] = useState<PlanFeature[]>(
    initialData?.features?.map((feature, index) => ({
      id: `feature-${index}`,
      text: feature
    })) || [{ id: 'feature-0', text: '' }]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setFeatures(
        initialData.features.map((feature, index) => ({
          id: `feature-${index}`,
          text: feature
        }))
      );
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Plan name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.price < 0) {
      newErrors.price = 'Price must be non-negative';
    }

    if (formData.discount_percent < 0 || formData.discount_percent > 100) {
      newErrors.discount_percent = 'Discount must be between 0 and 100';
    }

    const validFeatures = features.filter(f => f.text.trim());
    if (validFeatures.length === 0) {
      newErrors.features = 'At least one feature is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const validFeatures = features
      .filter(f => f.text.trim())
      .map(f => f.text.trim());

    try {
      await onSubmit({
        ...formData,
        features: validFeatures
      });
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: 'Failed to save plan. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFeature = () => {
    const newId = `feature-${features.length}`;
    setFeatures([...features, { id: newId, text: '' }]);
  };

  const removeFeature = (id: string) => {
    if (features.length > 1) {
      setFeatures(features.filter(f => f.id !== id));
    }
  };

  const updateFeature = (id: string, text: string) => {
    setFeatures(features.map(f =>
      f.id === id ? { ...f, text } : f
    ));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {initialData?.id ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {initialData?.id
            ? 'Update the subscription plan details below'
            : 'Fill in the details to create a new subscription plan'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Monthly Premium"
              disabled={isSubmitting || isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price *
            </label>
            <div className="flex">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  {formData.currency === 'PHP' ? '₱' : formData.currency === 'USD' ? '$' : '€'}
                </span>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.price ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={isSubmitting || isLoading}
                />
              </div>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="ml-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting || isLoading}
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            {errors.price && (
              <p className="text-sm text-red-600 mt-1">{errors.price}</p>
            )}
          </div>

          {/* Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Interval *
            </label>
            <select
              value={formData.interval}
              onChange={(e) => setFormData({
                ...formData,
                interval: e.target.value as 'month' | 'quarter' | 'year'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting || isLoading}
            >
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Annually</option>
            </select>
          </div>

          {/* Discount Percent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Percent *
            </label>
            <div className="flex items-center">
              <input
                type="number"
                value={formData.discount_percent}
                onChange={(e) => setFormData({
                  ...formData,
                  discount_percent: parseFloat(e.target.value) || 0
                })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.discount_percent ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                min="0"
                max="100"
                disabled={isSubmitting || isLoading}
              />
              <span className="ml-2 text-gray-600">%</span>
            </div>
            {errors.discount_percent && (
              <p className="text-sm text-red-600 mt-1">{errors.discount_percent}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Percentage discount compared to monthly rate
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Describe this subscription plan..."
            disabled={isSubmitting || isLoading}
          />
          {errors.description && (
            <p className="text-sm text-red-600 mt-1">{errors.description}</p>
          )}
        </div>

        {/* Features */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Features *
            </label>
            <button
              type="button"
              onClick={addFeature}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              disabled={isSubmitting || isLoading}
            >
              + Add Feature
            </button>
          </div>

          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={feature.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={feature.text}
                    onChange={(e) => updateFeature(feature.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Feature ${index + 1}`}
                    disabled={isSubmitting || isLoading}
                  />
                </div>
                {features.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFeature(feature.id)}
                    className="mt-1 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    disabled={isSubmitting || isLoading}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {errors.features && (
            <p className="text-sm text-red-600 mt-1">{errors.features}</p>
          )}
        </div>

        {/* Active Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={isSubmitting || isLoading}
          />
          <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
            Plan is active and available for new subscriptions
          </label>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? 'Saving...' : initialData?.id ? 'Update Plan' : 'Create Plan'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
            className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}