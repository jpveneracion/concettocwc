'use client';

import { useState, useEffect } from 'react';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  discount_percent: number;
  features: string[];
  is_active: boolean;
}

interface PlanComparisonProps {
  onPlanSelect?: (planId: string) => void;
  selectedPlan?: string;
}

/**
 * PlanComparison Component
 *
 * Fetches and displays actual subscription plans from the database
 * with feature comparison and selection interaction
 */
export default function PlanComparison({ onPlanSelect, selectedPlan }: PlanComparisonProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // Fetch actual subscription plans from database
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/plans?include_inactive=true');

        if (!response.ok) {
          throw new Error('Failed to fetch subscription plans');
        }

        const data = await response.json();
        const activePlans = data.plans.filter((plan: Plan) => plan.is_active);
        setPlans(activePlans);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError('Failed to load subscription plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handlePlanClick = (planId: string) => {
    if (onPlanSelect) {
      onPlanSelect(planId);
    }
  };

  const isSelected = (planId: string) => selectedPlan === planId;
  const isHovered = (planId: string) => hoveredPlan === planId;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-red-700 hover:text-red-900 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">No active subscription plans available. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-6 max-w-5xl mx-auto ${plans.length === 2 ? 'md:grid-cols-2' : ''}`}>
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`
            relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 cursor-pointer
            ${isSelected(plan.id) ? 'ring-4 ring-blue-500 shadow-xl transform scale-105' : 'hover:shadow-xl hover:transform hover:scale-103'}
            ${isHovered(plan.id) ? 'shadow-xl' : ''}
          `}
          onMouseEnter={() => setHoveredPlan(plan.id)}
          onMouseLeave={() => setHoveredPlan(null)}
          onClick={() => handlePlanClick(plan.id)}
        >
          {/* Popular Badge - Highlight middle plan if 3 plans, or second if 2 plans */}
          {(plans.length === 3 && plan === plans[1]) || (plans.length === 2 && plan === plans[1]) ? (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 text-sm font-semibold rounded-bl-xl">
              Most Popular
            </div>
          ) : null}

          {/* Plan Header */}
          <div className="p-8 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
              {isSelected(plan.id) && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-sm font-medium text-blue-600">Selected</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-gray-900">
                {plan.currency === 'PHP' ? '₱' : plan.currency === 'USD' ? '$' : '€'}
                {plan.price.toLocaleString()}
              </span>
              <span className="text-gray-600">/{plan.interval}</span>
              {plan.discount_percent > 0 && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                  Save {plan.discount_percent}%
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

            {/* CTA Button */}
            <button
              className={`
                w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200
                ${isSelected(plan.id)
                  ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }
              `}
            >
              {isSelected(plan.id) ? 'Selected' : 'Select Plan'}
            </button>
          </div>

          {/* Features List */}
          <div className="px-8 pb-8">
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                What's included:
              </h4>
              <ul className="space-y-3">
                {plan.features && plan.features.length > 0 ? (
                  plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-green-600 text-xs">✓</span>
                      </div>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 text-sm">No features listed</li>
                )}
              </ul>
            </div>
          </div>

          {/* Selected Indicator Border */}
          {isSelected(plan.id) && (
            <div className="absolute inset-0 border-4 border-blue-500 rounded-2xl pointer-events-none" />
          )}
        </div>
      ))}
    </div>
  );
}