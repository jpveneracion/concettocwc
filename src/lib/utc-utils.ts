/**
 * UTC Date Utilities
 *
 * Provides standardized UTC date handling for international timezone support.
 * All date comparisons should use these utilities to ensure consistency
 * across Philippines, US, and other international markets.
 */

/**
 * Get current UTC date normalized to midnight (00:00:00.000 UTC)
 *
 * @returns Date object set to UTC midnight of current day
 *
 * @example
 * ```ts
 * const utcMidnight = getUTCMidnight();
 * // If current UTC time is 2026-07-14T15:30:00Z
 * // Returns: 2026-07-14T00:00:00Z
 * ```
 */
export function getUTCMidnight(): Date {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  return utcMidnight;
}

/**
 * Convert any Date to UTC midnight (00:00:00.000 UTC)
 *
 * @param date - Date to convert
 * @returns Date object set to UTC midnight of the input date
 *
 * @example
 * ```ts
 * const date = new Date('2026-07-14T15:30:00Z');
 * const utcMidnight = toUTCMidnight(date);
 * // Returns: 2026-07-14T00:00:00Z
 * ```
 */
export function toUTCMidnight(date: Date): Date {
  const utcMidnight = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
  return utcMidnight;
}

/**
 * Get current UTC timestamp
 *
 * @returns Current UTC time as Date object
 */
export function getUTCNow(): Date {
  return new Date(); // JavaScript Date uses UTC internally
}

/**
 * Check if a date is in the past (before today UTC midnight)
 *
 * @param date - Date to check
 * @returns true if date is before today UTC midnight
 */
export function isPastUTCDate(date: Date): boolean {
  const todayUTCMidnight = getUTCMidnight();
  const dateUTCMidnight = toUTCMidnight(date);
  return dateUTCMidnight < todayUTCMidnight;
}

/**
 * Check if a quote date string represents a strictly past calendar day.
 *
 * Gates manual per-sq.ft. price editing in `QuoteForm` and the wizard's
 * `MeasurementsStep`: when the quote date is strictly before today (UTC),
 * price fields become editable; today and future dates remain read-only
 * (spec: "Quote date exactly today → treated as current (no edit, read-only)").
 *
 * UTC-standardized to match the project convention in `timezone-config.ts`.
 * Only UTC methods are used — never local-time methods like `setHours`.
 *
 * @param dateString - ISO date string (YYYY-MM-DD or full ISO). Null/undefined/empty returns false.
 * @returns true iff the date's UTC calendar day is strictly before today's UTC calendar day.
 *          Returns false for invalid date strings (Invalid Date → NaN getTime).
 *
 * @example
 * ```ts
 * isPastDatedQuote('2020-01-01'); // true (strictly past)
 * isPastDatedQuote('2099-01-01'); // false (future)
 * isPastDatedQuote(undefined);    // false
 * isPastDatedQuote('not-a-date'); // false (Invalid Date)
 * ```
 */
export function isPastDatedQuote(dateString: string | undefined | null): boolean {
  if (!dateString) return false;
  const quoteDate = new Date(dateString);
  if (Number.isNaN(quoteDate.getTime())) return false;
  return isPastUTCDate(quoteDate);
}

/**
 * Check if a date is in the future (after today UTC midnight)
 *
 * @param date - Date to check
 * @returns true if date is after today UTC midnight
 */
export function isFutureUTCDate(date: Date): boolean {
  const todayUTCMidnight = getUTCMidnight();
  const dateUTCMidnight = toUTCMidnight(date);
  return dateUTCMidnight > todayUTCMidnight;
}

/**
 * Check if a date is today (equals today UTC midnight)
 *
 * @param date - Date to check
 * @returns true if date equals today UTC midnight
 */
export function isTodayUTCDate(date: Date): boolean {
  const todayUTCMidnight = getUTCMidnight();
  const dateUTCMidnight = toUTCMidnight(date);
  return dateUTCMidnight.getTime() === todayUTCMidnight.getTime();
}

/**
 * Format a date as UTC ISO string
 *
 * @param date - Date to format
 * @returns ISO string in UTC
 */
export function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Create a UTC date from individual components
 *
 * @param year - Full year (e.g., 2026)
 * @param month - Month (0-11, where 0 = January)
 * @param day - Day of month (1-31)
 * @param hours - Hours (0-23, default 0)
 * @param minutes - Minutes (0-59, default 0)
 * @param seconds - Seconds (0-59, default 0)
 * @returns Date object in UTC
 */
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Add days to a date in UTC
 *
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added in UTC
 */
export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getUTCDate() + days);
  return result;
}

/**
 * Get the difference in days between two dates in UTC
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates (can be negative)
 */
export function getUTCDaysDiff(date1: Date, date2: Date): number {
  const utcMidnight1 = toUTCMidnight(date1);
  const utcMidnight2 = toUTCMidnight(date2);
  const diffMs = utcMidnight1.getTime() - utcMidnight2.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}