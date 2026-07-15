/**
 * International Business Types
 *
 * Types for multi-timezone, multi-currency, and multi-locale business operations.
 * Supports Philippines, US, and other international markets.
 */

/**
 * ISO 4217 currency codes
 */
export type CurrencyCode =
  | 'USD' // US Dollar
  | 'PHP' // Philippine Peso
  | 'EUR' // Euro
  | 'GBP' // British Pound
  | 'JPY' // Japanese Yen
  | 'CAD' // Canadian Dollar
  | 'AUD' // Australian Dollar
  | 'SGD' // Singapore Dollar
  | 'HKD' // Hong Kong Dollar
  | 'CNY'; // Chinese Yuan

/**
 * IANA timezone identifiers
 */
export type TimezoneIdentifier =
  | 'Asia/Manila'        // Philippines (UTC+8)
  | 'America/New_York'  // US Eastern (UTC-5/-4)
  | 'America/Chicago'   // US Central (UTC-6/-5)
  | 'America/Denver'    // US Mountain (UTC-7/-6)
  | 'America/Los_Angeles' // US Pacific (UTC-8/-7)
  | 'Europe/London'     // UK (UTC+0/+1)
  | 'Europe/Paris'      // Central Europe (UTC+1/+2)
  | 'Asia/Tokyo'        // Japan (UTC+9)
  | 'Australia/Sydney'  // Australia (UTC+10/+11)
  | 'UTC';               // UTC

/**
 * ISO 639-1 language codes with locale
 */
export type LocaleCode =
  | 'en-US' // English (United States)
  | 'en-PH' // English (Philippines)
  | 'fil-PH' // Filipino (Philippines)
  | 'es-US' // Spanish (United States)
  | 'ja-JP' // Japanese (Japan)
  | 'zh-CN' // Chinese (China)
  | 'fr-FR' // French (France)
  | 'de-DE' // German (Germany)
  | 'ko-KR' // Korean (South Korea)
  | 'pt-BR'; // Portuguese (Brazil)

/**
 * Company settings for international operations
 */
export interface CompanySettings {
  /** Company unique identifier */
  company_id: string;

  /** Primary currency for business operations */
  currency: CurrencyCode;

  /** Primary locale for formatting */
  locale: LocaleCode;

  /** Business timezone for date/time operations */
  timezone: TimezoneIdentifier;

  /** Business hours in company timezone */
  business_hours: BusinessHours;

  /** Date format preference */
  date_format: DateFormat;

  /** Time format preference */
  time_format: TimeFormat;

  /** Week start day (0 = Sunday, 1 = Monday, etc.) */
  week_start_day: number;

  /** Created timestamp */
  created_at: Date;

  /** Last updated timestamp */
  updated_at: Date;
}

/**
 * Business hours configuration
 */
export interface BusinessHours {
  /** Start time in HH:mm format (company timezone) */
  start_time: string;

  /** End time in HH:mm format (company timezone) */
  end_time: string;

  /** Days of week when business is open (0 = Sunday, 6 = Saturday) */
  operating_days: number[];

  /** Timezone for these hours */
  timezone: TimezoneIdentifier;
}

/**
 * Date format options
 */
export type DateFormat =
  | 'MM/DD/YYYY'  // US format
  | 'DD/MM/YYYY'  // European/Philippine format
  | 'YYYY-MM-DD'  // ISO format
  | 'DD-MM-YYYY'; // Alternative European format

/**
 * Time format options
 */
export type TimeFormat =
  | '12h' // 12-hour format (AM/PM)
  | '24h'; // 24-hour format

/**
 * UTC date with timezone information
 */
export interface UTCDate {
  /** UTC timestamp as ISO string */
  utc: string;

  /** Original timezone identifier */
  timezone: TimezoneIdentifier;

  /** Optional localized display string */
  localized?: string;
}

/**
 * Currency formatting options
 */
export interface CurrencyFormatOptions {
  /** Currency code */
  currency: CurrencyCode;

  /** Locale for formatting */
  locale: LocaleCode;

  /** Number of decimal places */
  decimals?: number;

  /** Include currency symbol */
  include_symbol?: boolean;

  /** Include currency code */
  include_code?: boolean;
}

/**
 * Multi-currency amount
 */
export interface MultiCurrencyAmount {
  /** Amount value */
  amount: number;

  /** Currency code */
  currency: CurrencyCode;

  /** Optional converted amounts */
  converted?: {
    [key in CurrencyCode]?: number;
  };
}

/**
 * Date/time in user's timezone
 */
export interface UserDateTime {
  /** UTC timestamp */
  utc: string;

  /** User's timezone */
  user_timezone: TimezoneIdentifier;

  /** User's locale */
  user_locale: LocaleCode;

  /** Localized date string */
  local_date: string;

  /** Localized time string */
  local_time: string;

  /** Full localized datetime string */
  local_datetime: string;
}

/**
 * Timezone conversion result
 */
export interface TimezoneConversion {
  /** Original UTC timestamp */
  utc_timestamp: string;

  /** Source timezone */
  source_timezone: TimezoneIdentifier;

  /** Target timezone */
  target_timezone: TimezoneIdentifier;

  /** Converted timestamp */
  converted_timestamp: string;

  /** Timezone offset in hours */
  offset_hours: number;

  /** Daylight saving time active */
  is_dst: boolean;
}

/**
 * User timezone preference
 */
export interface UserTimezonePreference {
  /** User unique identifier */
  user_id: string;

  /** User's preferred timezone */
  timezone: TimezoneIdentifier;

  /** User's preferred locale */
  locale: LocaleCode;

  /** Automatically detected from browser */
  auto_detected: boolean;

  /** Last updated timestamp */
  updated_at: Date;
}

/**
 * Business hours in user's timezone
 */
export interface UserBusinessHours {
  /** Original company business hours */
  company_hours: BusinessHours;

  /** User's timezone */
  user_timezone: TimezoneIdentifier;

  /** Converted business hours */
  user_hours: BusinessHours;

  /** Timezone difference from company */
  timezone_difference: string;
}