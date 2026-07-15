/**
 * Locale Utilities
 *
 * Multi-currency and locale utilities for international business operations.
 * Supports Philippines, US, and other international markets.
 */

import type {
  CurrencyCode,
  LocaleCode,
  TimezoneIdentifier,
  CurrencyFormatOptions,
  MultiCurrencyAmount,
  UserDateTime
} from '@/types/international';

/**
 * Format currency for different locales and currencies
 *
 * @param amount - Amount to format
 * @param currency - Currency code (ISO 4217)
 * @param locale - Locale code for formatting
 * @param options - Additional formatting options
 * @returns Formatted currency string
 *
 * @example
 * ```ts
 * formatCurrencyForLocale(1000.50, 'USD', 'en-US');
 * // Returns: "$1,000.50"
 *
 * formatCurrencyForLocale(25000, 'PHP', 'en-PH');
 * // Returns: "₱25,000.00"
 *
 * formatCurrencyForLocale(1500.75, 'EUR', 'fr-FR');
 * // Returns: "1 500,75 €"
 * ```
 */
export function formatCurrencyForLocale(
  amount: number,
  currency: CurrencyCode,
  locale: LocaleCode,
  options: Partial<CurrencyFormatOptions> = {}
): string {
  const {
    decimals = 2,
    include_symbol = true,
    include_code = false
  } = options;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: include_symbol ? 'currency' : 'decimal',
      currency: include_symbol ? currency : undefined,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    let formatted = formatter.format(amount);

    // Add currency code if requested
    if (include_code && !include_symbol) {
      formatted = `${formatted} ${currency}`;
    }

    return formatted;
  } catch (error) {
    // Fallback to basic formatting if Intl fails
    console.warn('Currency formatting failed, using fallback:', error);
    return `${currency} ${amount.toFixed(decimals)}`;
  }
}

/**
 * Format date for user's timezone and locale
 *
 * @param utcDate - Date in UTC (Date object or ISO string)
 * @param userLocale - User's preferred locale
 * @param userTimezone - User's preferred timezone
 * @param format - Date format style
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * // UTC time: 2026-07-14T15:30:00Z
 * formatDateForUser(
 *   '2026-07-14T15:30:00Z',
 *   'en-PH',
 *   'Asia/Manila'
 * );
 * // Returns: "July 14, 2026" (11:30 PM in Manila)
 *
 * formatDateForUser(
 *   '2026-07-14T15:30:00Z',
 *   'en-US',
 *   'America/New_York'
 * );
 * // Returns: "July 14, 2026" (11:30 AM in New York)
 * ```
 */
export function formatDateForUser(
  utcDate: Date | string,
  userLocale: LocaleCode,
  userTimezone: TimezoneIdentifier,
  format: 'full' | 'long' | 'medium' | 'short' = 'long'
): string {
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    const formatter = new Intl.DateTimeFormat(userLocale, {
      timeZone: userTimezone,
      dateStyle: format,
    });

    return formatter.format(date);
  } catch (error) {
    console.warn('Date formatting failed, using fallback:', error);
    return utcDate.toString();
  }
}

/**
 * Format datetime for user's timezone and locale
 *
 * @param utcDate - Date in UTC (Date object or ISO string)
 * @param userLocale - User's preferred locale
 * @param userTimezone - User's preferred timezone
 * @param dateFormat - Date format style
 * @param timeFormat - Time format style ('full' | 'long' | 'medium' | 'short')
 * @returns Formatted datetime string
 *
 * @example
 * ```ts
 * formatDateTimeForUser(
 *   '2026-07-14T15:30:00Z',
 *   'en-PH',
 *   'Asia/Manila'
 * );
 * // Returns: "July 14, 2026, 11:30:00 PM"
 * ```
 */
export function formatDateTimeForUser(
  utcDate: Date | string,
  userLocale: LocaleCode,
  userTimezone: TimezoneIdentifier,
  dateFormat: 'full' | 'long' | 'medium' | 'short' = 'long',
  timeFormat: 'full' | 'long' | 'medium' | 'short' = 'medium'
): string {
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    const formatter = new Intl.DateTimeFormat(userLocale, {
      timeZone: userTimezone,
      dateStyle: dateFormat,
      timeStyle: timeFormat,
    });

    return formatter.format(date);
  } catch (error) {
    console.warn('DateTime formatting failed, using fallback:', error);
    return utcDate.toString();
  }
}

/**
 * Detect user's browser locale
 *
 * @returns Detected locale code or fallback to 'en-US'
 *
 * @example
 * ```ts
 * const userLocale = getUserLocale();
 * // Returns: "en-PH" (if browser is set to Philippine English)
 * ```
 */
export function getUserLocale(): LocaleCode {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en-US'; // Fallback for server-side or undefined
  }

  const browserLocale = navigator.language;

  // Validate if it's one of our supported locales
  const supportedLocales: LocaleCode[] = [
    'en-US', 'en-PH', 'fil-PH', 'es-US', 'ja-JP',
    'zh-CN', 'fr-FR', 'de-DE', 'ko-KR', 'pt-BR'
  ];

  if (supportedLocales.includes(browserLocale as LocaleCode)) {
    return browserLocale as LocaleCode;
  }

  // Try to match just the language part
  const language = browserLocale.split('-')[0];
  const matchedLocale = supportedLocales.find(locale => locale.startsWith(language));

  return matchedLocale || 'en-US';
}

/**
 * Detect user's timezone
 *
 * @returns Detected timezone identifier or fallback to 'UTC'
 *
 * @example
 * ```ts
 * const userTimezone = getUserTimezone();
 * // Returns: "Asia/Manila" (if user is in Philippines)
 * ```
 */
export function getUserTimezone(): TimezoneIdentifier {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
    return 'UTC'; // Fallback for server-side or undefined
  }

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Validate if it's one of our supported timezones
  const supportedTimezones: TimezoneIdentifier[] = [
    'Asia/Manila',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
    'UTC'
  ];

  if (supportedTimezones.includes(detectedTimezone as TimezoneIdentifier)) {
    return detectedTimezone as TimezoneIdentifier;
  }

  return 'UTC'; // Fallback for unsupported timezones
}

/**
 * Get user's date and time preferences
 *
 * @returns Object with user's locale and timezone preferences
 *
 * @example
 * ```ts
 * const preferences = getUserPreferences();
 * // Returns: { locale: "en-PH", timezone: "Asia/Manila" }
 * ```
 */
export function getUserPreferences(): {
  locale: LocaleCode;
  timezone: TimezoneIdentifier;
} {
  return {
    locale: getUserLocale(),
    timezone: getUserTimezone()
  };
}

/**
 * Create a UserDateTime object with full localization
 *
 * @param utcDate - Date in UTC
 * @param userTimezone - User's preferred timezone
 * @param userLocale - User's preferred locale
 * @returns UserDateTime object with all localized formats
 *
 * @example
 * ```ts
 * const userDateTime = createUserDateTime(
 *   '2026-07-14T15:30:00Z',
 *   'Asia/Manila',
 *   'en-PH'
 * );
 * // Returns: {
 * //   utc: "2026-07-14T15:30:00Z",
 * //   user_timezone: "Asia/Manila",
 * //   user_locale: "en-PH",
 * //   local_date: "July 14, 2026",
 * //   local_time: "11:30:00 PM",
 * //   local_datetime: "July 14, 2026, 11:30:00 PM"
 * // }
 * ```
 */
export function createUserDateTime(
  utcDate: Date | string,
  userTimezone: TimezoneIdentifier,
  userLocale: LocaleCode
): UserDateTime {
  const utcString = typeof utcDate === 'string' ? utcDate : utcDate.toISOString();

  return {
    utc: utcString,
    user_timezone: userTimezone,
    user_locale: userLocale,
    local_date: formatDateForUser(utcDate, userLocale, userTimezone),
    local_time: formatTimeForUser(utcDate, userLocale, userTimezone),
    local_datetime: formatDateTimeForUser(utcDate, userLocale, userTimezone)
  };
}

/**
 * Format time only for user's timezone and locale
 *
 * @param utcDate - Date in UTC (Date object or ISO string)
 * @param userLocale - User's preferred locale
 * @param userTimezone - User's preferred timezone
 * @returns Formatted time string
 *
 * @example
 * ```ts
 * formatTimeForUser(
 *   '2026-07-14T15:30:00Z',
 *   'en-PH',
 *   'Asia/Manila'
 * );
 * // Returns: "11:30:00 PM"
 * ```
 */
export function formatTimeForUser(
  utcDate: Date | string,
  userLocale: LocaleCode,
  userTimezone: TimezoneIdentifier
): string {
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    const formatter = new Intl.DateTimeFormat(userLocale, {
      timeZone: userTimezone,
      timeStyle: 'medium',
    });

    return formatter.format(date);
  } catch (error) {
    console.warn('Time formatting failed, using fallback:', error);
    return utcDate.toString();
  }
}

/**
 * Parse and validate currency code
 *
 * @param currencyCode - Currency code to validate
 * @returns Valid currency code or USD as fallback
 *
 * @example
 * ```ts
 * parseCurrencyCode('PHP');
 * // Returns: "PHP"
 *
 * parseCurrencyCode('INVALID');
 * // Returns: "USD" (fallback)
 * ```
 */
export function parseCurrencyCode(currencyCode: string): CurrencyCode {
  const validCurrencies: CurrencyCode[] = [
    'USD', 'PHP', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD', 'CNY'
  ];

  const upperCode = currencyCode.toUpperCase() as CurrencyCode;
  return validCurrencies.includes(upperCode) ? upperCode : 'USD';
}

/**
 * Parse and validate locale code
 *
 * @param localeCode - Locale code to validate
 * @returns Valid locale code or en-US as fallback
 *
 * @example
 * ```ts
 * parseLocaleCode('en-PH');
 * // Returns: "en-PH"
 *
 * parseLocaleCode('invalid-locale');
 * // Returns: "en-US" (fallback)
 * ```
 */
export function parseLocaleCode(localeCode: string): LocaleCode {
  const validLocales: LocaleCode[] = [
    'en-US', 'en-PH', 'fil-PH', 'es-US', 'ja-JP',
    'zh-CN', 'fr-FR', 'de-DE', 'ko-KR', 'pt-BR'
  ];

  return validLocales.includes(localeCode as LocaleCode) ? localeCode as LocaleCode : 'en-US';
}