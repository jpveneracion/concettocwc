// src/__tests__/lib/utc-utils.test.ts

import { isPastDatedQuote } from '@/lib/utc-utils';

/**
 * Build a date-only ISO string (YYYY-MM-DD) offset from today using UTC
 * components. Using UTC (not local) keeps the test stable regardless of the
 * host's timezone, matching the project's UTC-standardized convention.
 */
function utcDateStr(daysOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

describe('isPastDatedQuote', () => {
  test('returns true for a date strictly in the past', () => {
    expect(isPastDatedQuote(utcDateStr(-1))).toBe(true);
    expect(isPastDatedQuote('2020-01-01')).toBe(true);
  });

  test('returns false for today (spec: today is treated as current, read-only)', () => {
    expect(isPastDatedQuote(utcDateStr(0))).toBe(false);
  });

  test('returns false for a future date', () => {
    expect(isPastDatedQuote(utcDateStr(1))).toBe(false);
    expect(isPastDatedQuote('2099-01-01')).toBe(false);
  });

  test('returns false for an empty string', () => {
    expect(isPastDatedQuote('')).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isPastDatedQuote(undefined)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isPastDatedQuote(null)).toBe(false);
  });

  test('returns false for an invalid date string (no try/catch, NaN guard)', () => {
    expect(isPastDatedQuote('not-a-date')).toBe(false);
    expect(isPastDatedQuote('2026-13-45')).toBe(false);
  });

  test('accepts full ISO strings and normalizes to UTC midnight', () => {
    // Same UTC day as today → not past-dated even with a non-midnight time.
    const todayMidday = `${utcDateStr(0)}T12:00:00Z`;
    expect(isPastDatedQuote(todayMidday)).toBe(false);
    // Yesterday with a late time still past-dated.
    const yesterdayLate = `${utcDateStr(-1)}T23:59:59Z`;
    expect(isPastDatedQuote(yesterdayLate)).toBe(true);
  });
});
