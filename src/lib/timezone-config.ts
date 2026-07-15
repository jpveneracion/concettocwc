/**
 * Timezone Configuration Utilities
 *
 * Timezone configuration and conversion utilities for international business operations.
 * Integrates with existing UTC utilities for consistent timezone handling.
 */

import type {
  TimezoneIdentifier,
  LocaleCode,
  CompanySettings,
  BusinessHours,
  UserTimezonePreference,
  TimezoneConversion,
  UserBusinessHours
} from '@/types/international';

import {
  getUTCNow,
  toUTCISOString,
  createUTCDate
} from './utc-utils';

/**
 * Get company's configured timezone
 *
 * In a real implementation, this would query the database for company settings.
 * For now, it provides a mock implementation that can be replaced with actual data access.
 *
 * @param companyId - Company unique identifier
 * @returns Company timezone identifier
 *
 * @example
 * ```ts
 * const companyTimezone = getCompanyTimezone('company-123');
 * // Returns: "Asia/Manila" (for Philippine companies)
 * ```
 */
export async function getCompanyTimezone(companyId: string): Promise<TimezoneIdentifier> {
  // Mock implementation - replace with actual database query
  const defaultTimezones: Record<string, TimezoneIdentifier> = {
    'philippines-company': 'Asia/Manila',
    'us-company-east': 'America/New_York',
    'us-company-central': 'America/Chicago',
    'us-company-mountain': 'America/Denver',
    'us-company-pacific': 'America/Los_Angeles',
  };

  // In production, this would query your database
  // const company = await db.companies.findUnique({ where: { id: companyId } });
  // return company?.timezone || 'UTC';

  return defaultTimezones[companyId] || 'UTC';
}

/**
 * Get user's timezone preference
 *
 * In a real implementation, this would query the database for user preferences.
 * Falls back to auto-detection if no preference is stored.
 *
 * @param userId - User unique identifier
 * @returns User timezone preference
 *
 * @example
 * ```ts
 * const userPreference = await getUserTimezonePreference('user-456');
 * // Returns: { user_id: "user-456", timezone: "Asia/Manila", ... }
 * ```
 */
export async function getUserTimezonePreference(userId: string): Promise<UserTimezonePreference> {
  // Mock implementation - replace with actual database query
  const defaultPreferences: Record<string, UserTimezonePreference> = {
    'user-philippines': {
      user_id: 'user-philippines',
      timezone: 'Asia/Manila',
      locale: 'en-PH',
      auto_detected: false,
      updated_at: new Date()
    },
    'user-us-east': {
      user_id: 'user-us-east',
      timezone: 'America/New_York',
      locale: 'en-US',
      auto_detected: false,
      updated_at: new Date()
    }
  };

  // In production, this would query your database
  // const userPreference = await db.userTimezonePreferences.findUnique({
  //   where: { user_id: userId }
  // });

  const storedPreference = defaultPreferences[userId];

  if (storedPreference) {
    return storedPreference;
  }

  // Fallback to auto-detected preferences
  const { getUserLocale, getUserTimezone } = await import('./locale-utils');
  return {
    user_id: userId,
    timezone: getUserTimezone(),
    locale: getUserLocale(),
    auto_detected: true,
    updated_at: new Date()
  };
}

/**
 * Convert UTC date to user's timezone
 *
 * @param utcDate - UTC date (Date object or ISO string)
 * @param userTimezone - User's preferred timezone
 * @returns Date object converted to user's timezone (local time)
 *
 * @example
 * ```ts
 * const utcDate = new Date('2026-07-14T15:30:00Z');
 * const userDate = convertUTCToUserTimezone(utcDate, 'Asia/Manila');
 * // Returns: Date object representing 2026-07-14T23:30:00 (local time)
 * ```
 */
export function convertUTCToUserTimezone(
  utcDate: Date | string,
  userTimezone: TimezoneIdentifier
): Date {
  try {
    const utcDateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    // Create a date object in the user's timezone
    const userDate = new Date(utcDateObj.toLocaleString('en-US', { timeZone: userTimezone }));

    return userDate;
  } catch (error) {
    console.warn('Timezone conversion failed, returning UTC:', error);
    return typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  }
}

/**
 * Convert user's local time to UTC
 *
 * @param localDate - Date in user's local timezone
 * @param userTimezone - User's timezone
 * @returns Date object in UTC
 *
 * @example
 * ```ts
 * const localDate = new Date('2026-07-14T23:30:00'); // Local time in Manila
 * const utcDate = convertUserTimezoneToUTC(localDate, 'Asia/Manila');
 * // Returns: Date object representing 2026-07-14T15:30:00Z
 * ```
 */
export function convertUserTimezoneToUTC(
  localDate: Date,
  userTimezone: TimezoneIdentifier
): Date {
  try {
    // Get the timezone offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(localDate);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

    return createUTCDate(year, month, day, hour, minute, second);
  } catch (error) {
    console.warn('UTC conversion failed, returning original date:', error);
    return localDate;
  }
}

/**
 * Get timezone offset between two timezones
 *
 * @param sourceTimezone - Source timezone identifier
 * @param targetTimezone - Target timezone identifier
 * @param utcDate - UTC date to calculate offset for
 * @returns Timezone difference in hours
 *
 * @example
 * ```ts
 * const offset = getTimezoneOffset(
 *   'Asia/Manila',
 *   'America/New_York',
 *   new Date('2026-07-14T00:00:00Z')
 * );
 * // Returns: 12 (Manila is 12 hours ahead of New York in July)
 * ```
 */
export function getTimezoneOffset(
  sourceTimezone: TimezoneIdentifier,
  targetTimezone: TimezoneIdentifier,
  utcDate: Date = new Date()
): number {
  try {
    const sourceDate = new Date(utcDate.toLocaleString('en-US', { timeZone: sourceTimezone }));
    const targetDate = new Date(utcDate.toLocaleString('en-US', { timeZone: targetTimezone }));

    const sourceOffset = sourceDate.getTime() - utcDate.getTime();
    const targetOffset = targetDate.getTime() - utcDate.getTime();

    return (targetOffset - sourceOffset) / (1000 * 60 * 60);
  } catch (error) {
    console.warn('Timezone offset calculation failed:', error);
    return 0;
  }
}

/**
 * Create detailed timezone conversion result
 *
 * @param utcDate - UTC date to convert
 * @param sourceTimezone - Source timezone
 * @param targetTimezone - Target timezone
 * @returns Detailed timezone conversion information
 *
 * @example
 * ```ts
 * const conversion = createTimezoneConversion(
 *   '2026-07-14T15:30:00Z',
 *   'UTC',
 *   'Asia/Manila'
 * );
 * // Returns: {
 * //   utc_timestamp: "2026-07-14T15:30:00Z",
 * //   source_timezone: "UTC",
 * //   target_timezone: "Asia/Manila",
 * //   converted_timestamp: "2026-07-14T23:30:00",
 * //   offset_hours: 8,
 * //   is_dst: false
 * // }
 * ```
 */
export function createTimezoneConversion(
  utcDate: Date | string,
  sourceTimezone: TimezoneIdentifier,
  targetTimezone: TimezoneIdentifier
): TimezoneConversion {
  const utcString = typeof utcDate === 'string' ? utcDate : toUTCISOString(utcDate);
  const utcDateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  try {
    const convertedDate = new Date(
      utcDateObj.toLocaleString('en-US', { timeZone: targetTimezone })
    );
    const convertedTimestamp = convertedDate.toISOString().slice(0, 19).replace('T', ' ');

    // Check if DST is active in target timezone
    const dstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      timeZoneName: 'short'
    });
    const dstName = dstFormatter.formatToParts(utcDateObj)
      .find(part => part.type === 'timeZoneName')?.value || '';

    const isDST = dstName.includes('DT') || dstName.includes('DST');

    return {
      utc_timestamp: utcString,
      source_timezone: sourceTimezone,
      target_timezone: targetTimezone,
      converted_timestamp: convertedTimestamp,
      offset_hours: getTimezoneOffset(sourceTimezone, targetTimezone, utcDateObj),
      is_dst: isDST
    };
  } catch (error) {
    console.warn('Timezone conversion details failed, using fallback:', error);
    return {
      utc_timestamp: utcString,
      source_timezone: sourceTimezone,
      target_timezone: targetTimezone,
      converted_timestamp: utcString,
      offset_hours: 0,
      is_dst: false
    };
  }
}

/**
 * Get business hours in user's timezone
 *
 * @param companyId - Company identifier
 * @param userTimezone - User's timezone
 * @returns Business hours converted to user's timezone
 *
 * @example
 * ```ts
 * const userHours = await getUserBusinessHours(
 *   'company-123',
 *   'Asia/Manila'
 * );
 * // Returns: business hours in Manila time
 * ```
 */
export async function getUserBusinessHours(
  companyId: string,
  userTimezone: TimezoneIdentifier
): Promise<UserBusinessHours> {
  // Mock company business hours
  const companyTimezone = await getCompanyTimezone(companyId);

  const companyHours: BusinessHours = {
    start_time: '09:00',
    end_time: '17:00',
    operating_days: [1, 2, 3, 4, 5], // Monday to Friday
    timezone: companyTimezone
  };

  // Convert business hours to user's timezone
  const userHours = convertBusinessHoursToTimezone(companyHours, userTimezone);

  const offsetHours = getTimezoneOffset(companyTimezone, userTimezone);
  const offsetDirection = offsetHours >= 0 ? '+' : '';
  const timezoneDifference = `${offsetDirection}${offsetHours} hours`;

  return {
    company_hours: companyHours,
    user_timezone: userTimezone,
    user_hours: userHours,
    timezone_difference: timezoneDifference
  };
}

/**
 * Convert business hours from one timezone to another
 *
 * @param companyHours - Business hours in company timezone
 * @param targetTimezone - Target timezone to convert to
 * @returns Business hours in target timezone
 *
 * @example
 * ```ts
 * const hours = convertBusinessHoursToTimezone(
 *   { start_time: '09:00', end_time: '17:00', timezone: 'America/New_York' },
 *   'Asia/Manila'
 * );
 * // Returns: { start_time: '21:00', end_time: '05:00', ... }
 * ```
 */
export function convertBusinessHoursToTimezone(
  companyHours: BusinessHours,
  targetTimezone: TimezoneIdentifier
): BusinessHours {
  try {
    const today = getUTCNow();

    // Parse start time
    const [startHour, startMinute] = companyHours.start_time.split(':').map(Number);
    const startDate = createUTCDate(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      startHour,
      startMinute
    );

    // Parse end time
    const [endHour, endMinute] = companyHours.end_time.split(':').map(Number);
    const endDate = createUTCDate(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      endHour,
      endMinute
    );

    // Convert to target timezone
    const startDateInTarget = new Date(
      startDate.toLocaleString('en-US', { timeZone: targetTimezone })
    );
    const endDateInTarget = new Date(
      endDate.toLocaleString('en-US', { timeZone: targetTimezone })
    );

    const formatTime = (date: Date) => {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    return {
      start_time: formatTime(startDateInTarget),
      end_time: formatTime(endDateInTarget),
      operating_days: companyHours.operating_days,
      timezone: targetTimezone
    };
  } catch (error) {
    console.warn('Business hours conversion failed, returning original:', error);
    return companyHours;
  }
}

/**
 * Check if current time is within business hours for a company
 *
 * @param companyId - Company identifier
 * @param userTimezone - User's timezone (if checking for user's local time)
 * @returns true if current time is within business hours
 *
 * @example
 * ```ts
 * const isOpen = await isWithinBusinessHours('company-123', 'Asia/Manila');
 * // Returns: true/false depending on current time
 * ```
 */
export async function isWithinBusinessHours(
  companyId: string,
  userTimezone?: TimezoneIdentifier
): Promise<boolean> {
  try {
    const businessHours = await getUserBusinessHours(companyId, userTimezone || 'UTC');
    const now = getUTCNow();
    const userNow = userTimezone ? convertUTCToUserTimezone(now, userTimezone) : now;

    const [startHour, startMinute] = businessHours.user_hours.start_time.split(':').map(Number);
    const [endHour, endMinute] = businessHours.user_hours.end_time.split(':').map(Number);

    const currentHour = userNow.getHours();
    const currentMinute = userNow.getMinutes();
    const currentDay = userNow.getDay();

    // Check if current day is within operating days
    if (!businessHours.user_hours.operating_days.includes(currentDay)) {
      return false;
    }

    // Check if current time is within operating hours
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
  } catch (error) {
    console.warn('Business hours check failed:', error);
    return false;
  }
}

/**
 * Get current time in company's timezone
 *
 * @param companyId - Company identifier
 * @returns Current time in company's timezone
 *
 * @example
 * ```ts
 * const companyTime = await getCompanyCurrentTime('company-123');
 * // Returns: Current time in company's timezone
 * ```
 */
export async function getCompanyCurrentTime(companyId: string): Promise<Date> {
  const companyTimezone = await getCompanyTimezone(companyId);
  const utcNow = getUTCNow();
  return convertUTCToUserTimezone(utcNow, companyTimezone);
}