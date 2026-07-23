'use client';

import { useMemo } from 'react';
import { PricingConfig } from '@/lib/pricing-service';

interface PriceCalculations {
  monthly: {
    baseTotal: number;
    finalPrice: number;
    discountPercent: number;
  };
  quarterly: {
    baseTotal: number;
    finalPrice: number;
    discountPercent: number;
  };
  annual: {
    baseTotal: number;
    finalPrice: number;
    discountPercent: number;
  };
}

/**
 * Custom hook for calculating pricing with memoization to prevent unnecessary recalculations
 * @param pricing - The pricing configuration to calculate from
 * @returns Object containing calculated prices for all billing periods
 */
export function usePriceCalculations(pricing: PricingConfig | null): PriceCalculations | null {
  return useMemo(() => {
    if (!pricing) return null;

    const monthlyBaseTotal = pricing.monthly_base_rate;
    const quarterlyBaseTotal = pricing.monthly_base_rate * 3;
    const annualBaseTotal = pricing.monthly_base_rate * 12;

    return {
      monthly: {
        baseTotal: monthlyBaseTotal,
        finalPrice: monthlyBaseTotal,
        discountPercent: 0,
      },
      quarterly: {
        baseTotal: quarterlyBaseTotal,
        finalPrice: quarterlyBaseTotal * (1 - pricing.quarterly_discount_percent / 100),
        discountPercent: pricing.quarterly_discount_percent,
      },
      annual: {
        baseTotal: annualBaseTotal,
        finalPrice: annualBaseTotal * (1 - pricing.annual_discount_percent / 100),
        discountPercent: pricing.annual_discount_percent,
      },
    };
  }, [pricing]);
}