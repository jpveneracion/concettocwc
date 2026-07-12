'use client';

import { useState } from 'react';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  popular?: boolean;
  highlighted?: boolean;
}

interface PlanComparisonProps {
  onPlanSelect?: (planId: string) => void;
  selectedPlan?: string;
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 499,
    interval: 'month',
    description: 'Perfect for small businesses starting out',
    features: [
      '50 quotes per month',
      'Standard quote templates',
      'Email support (48-hour response)',
      'Basic customization options',
      'Mobile app access',
      'Cloud storage (1GB)'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    interval: 'month',
    description: 'For growing businesses that need more power',
    features: [
      'Unlimited quotes',
      'Premium templates library',
      'Priority support (24-hour response)',
      'Custom branding & logos',
      'Advanced analytics dashboard',
      'Cloud storage (10GB)',
      'API access',
      'Team collaboration tools',
      'Custom workflows'
    ],
    popular: true
  }
];

/**
 * PlanComparison Component
 *
 * Displays subscription plans side-by-side with feature comparison
 * and selection interaction
 */
export default function PlanComparison({ onPlanSelect, selectedPlan }: PlanComparisonProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  const handlePlanClick = (planId: string) => {
    if (onPlanSelect) {
      onPlanSelect(planId);
    }
  };

  const isSelected = (planId: string) => selectedPlan === planId;
  const isHovered = (planId: string) => hoveredPlan === planId;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
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
          {/* Popular Badge */}
          {plan.popular && (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 text-sm font-semibold rounded-bl-xl">
              Most Popular
            </div>
          )}

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
                ₱{plan.price.toLocaleString()}
              </span>
              <span className="text-gray-600">/{plan.interval}</span>
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
                ${plan.popular && !isSelected(plan.id) ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
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
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-green-600 text-xs">✓</span>
                    </div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
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