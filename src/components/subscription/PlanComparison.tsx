'use client';

import { useState, useEffect } from 'react';

/**
 * Response from the pricing service API
 */
interface PricingServiceResponse {
  success: boolean;
  pricing: {
    base_price: number;
    period_months: number;
    base_total: number;
    period_discount_percent: number;
    period_discount_amount: number;
    price_after_period_discount: number;
    promo_discount_percent?: number;
    promo_discount_amount?: number;
    final_price: number;
    billing_period: 'monthly' | 'quarterly' | 'annual';
    calculated_at: string;
  };
  fallback?: boolean;
}

interface BillingPeriod {
  id: 'monthly' | 'quarterly' | 'annual';
  name: string;
  months: number;
  basePrice: number;
  periodDiscount: number;
  finalPrice: number;
  features: string[];
  popular?: boolean;
}

interface PlanComparisonProps {
  onPlanSelect?: (planId: string) => void;
  selectedPlan?: string;
}

/**
 * PlanComparison Component
 *
 * Displays billing periods using the new dynamic pricing system
 */
export default function PlanComparison({ onPlanSelect, selectedPlan }: PlanComparisonProps) {
  const [plans, setPlans] = useState<BillingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [touchedPlan, setTouchedPlan] = useState<string | null>(null);

  // Fetch pricing data from the new pricing service
  useEffect(() => {
    const fetchPricingData = async () => {
      try {
        setLoading(true);

        // Fetch pricing for all plan types in parallel
        const planTypes: ('monthly' | 'quarterly' | 'annual')[] = ['monthly', 'quarterly', 'annual'];
        const pricingPromises = planTypes.map(planType =>
          fetch(`/api/pricing?plan=${planType}`)
        );

        const responses = await Promise.all(pricingPromises);

        // Check if all responses are successful
        const allSuccessful = responses.every(response => response.ok);
        if (!allSuccessful) {
          throw new Error('Failed to fetch pricing data');
        }

        const pricingData = await Promise.all(
          responses.map(response => response.json() as Promise<PricingServiceResponse>)
        );

        // Define standard features for each billing period
        const standardFeatures: Record<string, string[]> = {
          monthly: [
            'Flexible monthly billing',
            'Full access to all features',
            'Cancel anytime',
            '24/7 customer support',
            'Regular updates & improvements'
          ],
          quarterly: [
            'Save with quarterly billing',
            'Full access to all features',
            'Priority customer support',
            'Regular updates & improvements',
            'Best value for regular users'
          ],
          annual: [
            'Maximum savings with annual billing',
            'Full access to all features',
            'Premium customer support',
            'Early access to new features',
            'Best long-term value'
          ]
        };

        // Transform pricing data to billing periods format
        const billingPeriods: BillingPeriod[] = pricingData.map((data, index) => {
          const planType = planTypes[index];
          const pricing = data.pricing;

          return {
            id: pricing.billing_period,
            name: planType === 'monthly' ? 'Monthly' : planType === 'quarterly' ? 'Quarterly' : 'Annual',
            months: pricing.period_months,
            basePrice: pricing.base_price,
            periodDiscount: pricing.period_discount_percent,
            finalPrice: pricing.final_price,
            features: standardFeatures[planType] || [],
            popular: planType === 'quarterly' // Quarterly is marked as most popular
          };
        });

        setPlans(billingPeriods);
      } catch (err) {
        console.error('Error fetching pricing data:', err);
        setError('Failed to load pricing options');
      } finally {
        setLoading(false);
      }
    };

    fetchPricingData();
  }, []);

  const handlePlanClick = (planId: string) => {
    if (onPlanSelect) {
      onPlanSelect(planId);
    }
  };

  const isSelected = (planId: string) => selectedPlan === planId;
  const isHovered = (planId: string) => hoveredPlan === planId;
  const isTouched = (planId: string) => touchedPlan === planId;

  const handleTouchStart = (planId: string) => {
    setTouchedPlan(planId);
  };

  const handleTouchEnd = () => {
    setTouchedPlan(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading pricing options...</p>
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
        <p className="text-yellow-800">No pricing options available. Please contact support.</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className={`grid grid-cols-1 gap-4 sm:gap-6 max-w-5xl mx-auto ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`
            relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 cursor-pointer
            ${isSelected(plan.id) ? 'ring-4 ring-blue-500 shadow-xl transform scale-105' : 'hover:shadow-xl hover:transform hover:scale-103'}
            ${isTouched(plan.id) ? 'shadow-xl transform scale-102' : ''}
          `}
          onMouseEnter={() => setHoveredPlan(plan.id)}
          onMouseLeave={() => setHoveredPlan(null)}
          onTouchStart={() => handleTouchStart(plan.id)}
          onTouchEnd={handleTouchEnd}
          onClick={() => handlePlanClick(plan.id)}
        >
          {/* Popular Badge */}
          {plan.popular && (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 text-sm font-semibold rounded-bl-xl">
              Most Popular
            </div>
          )}

          {/* Plan Header */}
          <div className="p-4 sm:p-6 pb-3 sm:pb-6">
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
                {formatCurrency(plan.finalPrice)}
              </span>
              <span className="text-gray-600">/{plan.months === 1 ? 'month' : plan.months + ' months'}</span>
              {plan.periodDiscount > 0 && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                  Save {plan.periodDiscount}%
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-6">
              {plan.months === 1 ? 'Flexible monthly billing' : `Billed every ${plan.months} months`}
            </p>

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
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
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