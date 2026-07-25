'use client';

import { useState, useEffect } from 'react';
import { PublicSubscriptionPlan } from '@/types/subscription';
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
>>>>>>> bfbe891720c58db002470c5f39aae1d2b64589fc

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
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleKeyDown = (event: React.KeyboardEvent, planId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePlanClick(planId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-800 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p className="text-yellow-800">No active subscription plans available. Please contact support.</p>
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
    <div className={`grid grid-cols-1 gap-4 sm:gap-6 max-w-6xl mx-auto ${
      plans.length === 1 ? '' :
      plans.length === 2 ? 'md:grid-cols-2' :
      plans.length === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
      'md:grid-cols-2 lg:grid-cols-' + Math.min(plans.length, 4)
    }`}>
      {plans.map((plan) => (
        <div
          key={plan.id}
          role="button"
          tabIndex={0}
          aria-pressed={isSelected(plan.id)}
          aria-label={`Select ${plan.name} plan`}
          className={`
            relative bg-white border rounded-xl overflow-hidden cursor-pointer
            ${isSelected(plan.id) ? 'border-blue-500 shadow-md' : 'border-gray-200'}
          `}
          onClick={() => handlePlanClick(plan.id)}
          onKeyDown={(e) => handleKeyDown(e, plan.id)}
        >
          {/* Popular Badge - Highlight middle plan if 3 plans, or second if 2 plans */}
          {(plans.length === 3 && plan === plans[1]) || (plans.length === 2 && plan === plans[1]) ? (
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
              Most Popular
            </div>
          ) : null}

          {/* Plan Header */}
          <div className="p-4 sm:p-6 pb-3 sm:pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              {isSelected(plan.id) && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-blue-600">Selected</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-gray-900">
                {plan.currency === 'PHP' ? '₱' : plan.currency === 'USD' ? '$' : '€'}
                {plan.price.toLocaleString()}
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
                w-full py-2 px-4 rounded-lg font-medium
                ${isSelected(plan.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
                }
              `}
            >
              {isSelected(plan.id) ? 'Selected' : 'Select Plan'}
            </button>
          </div>

          {/* Features List */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                What's included:
              </h4>
              <ul className="space-y-2">
                {plan.features && plan.features.length > 0 ? (
                  plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 text-sm">No features listed</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
