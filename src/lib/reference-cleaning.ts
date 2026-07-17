// src/lib/reference-cleaning.ts

/**
 * Clean GCash reference number for consistent matching
 * Handles common user mistakes: spaces, prefixes, mixed case
 */
export function cleanReferenceNumber(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // First extract reference from any prefixes
  const extracted = extractReferenceFromPrefix(input);

  // Remove all non-alphanumeric characters and convert to uppercase
  const cleaned = extracted
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim()
    .toUpperCase();

  return cleaned;
}

/**
 * Validate GCash reference number format
 * Standard format: 13-digit numeric (^\d{13}$)
 * Flexible fallback: 10-15 digits (^\\d{10,15}$)
 */
export function validateReferenceNumberFormat(input: string): {
  valid: boolean;
  format: 'standard' | 'flexible' | 'invalid';
  message?: string;
} {
  const cleaned = cleanReferenceNumber(input);

  if (!cleaned) {
    return { valid: false, format: 'invalid', message: 'Reference number is empty after cleaning' };
  }

  // Standard GCash format: 13 digits
  const standardFormat = /^\d{13}$/;
  if (standardFormat.test(cleaned)) {
    return { valid: true, format: 'standard' };
  }

  // Flexible format: 10-15 digits (handles future format changes)
  const flexibleFormat = /^\d{10,15}$/;
  if (flexibleFormat.test(cleaned)) {
    return {
      valid: true,
      format: 'flexible',
      message: 'Non-standard format detected - will route to manual verification'
    };
  }

  return {
    valid: false,
    format: 'invalid',
    message: 'Invalid format - must be 10-15 digits'
  };
}

/**
 * Extract reference number from common user prefixes
 * Handles: "Ref:", "REFERENCE:", "#", etc.
 */
export function extractReferenceFromPrefix(input: string): string {
  if (!input) return '';

  // Remove common prefixes (handle # with or without colon)
  const withoutPrefix = input
    .replace(/^(ref|reference|transaction|txn)\s*:\s*/i, '')
    .replace(/^#\s*/, '')
    .trim();

  return withoutPrefix;
}