import { NextResponse } from 'next/server';
import { validateOperation } from '@/lib/trial-restrictions';
import { OperationType } from '@/types/trial-restrictions';
import type { ValidationResult } from '@/types/trial-restrictions';
import type { Session } from '@/lib/auth';

/**
 * Restriction error response interface
 */
export interface RestrictionErrorResponse {
  error: string;
  restrictionType: string;
  canCreatePastOrders: boolean;
  canViewDashboard: boolean;
  restrictionReason?: string;
  suggestion?: string;
  checkoutUrl: string;
}

/**
 * Validate quote creation operation
 */
export async function validateQuoteCreation(
  session: Session,
  quoteDate: Date
): Promise<ValidationResult> {
  return validateOperation(
    OperationType.CREATE_ORDER,
    session.userId,
    { targetDate: quoteDate }
  );
}

/**
 * Convert validation result to HTTP error response
 */
export function restrictionErrorResponse(result: ValidationResult): NextResponse {
  const responseBody: RestrictionErrorResponse = {
    error: 'Trial period expired',
    restrictionType: 'future_orders_blocked',
    canCreatePastOrders: true,
    canViewDashboard: true,
    restrictionReason: result.reason,
    suggestion: result.suggestion,
    checkoutUrl: '/account/subscription'
  };

  return NextResponse.json(responseBody, { status: 403 });
}

/**
 * Check if response is a restriction error
 */
export function isRestrictionError(data: unknown): data is RestrictionErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'restrictionType' in data &&
    data.restrictionType === 'future_orders_blocked'
  );
}