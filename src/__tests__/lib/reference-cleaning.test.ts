// src/__tests__/lib/reference-cleaning.test.ts

import { cleanReferenceNumber, validateReferenceNumberFormat, extractReferenceFromPrefix } from '@/lib/reference-cleaning';

describe('cleanReferenceNumber', () => {
  test('removes spaces and special characters', () => {
    expect(cleanReferenceNumber('1234 567 89012')).toBe('123456789012');
  });

  test('handles "Ref:" prefix', () => {
    expect(cleanReferenceNumber('Ref:1234567890123')).toBe('1234567890123');
  });

  test('handles trailing spaces', () => {
    expect(cleanReferenceNumber('1234567890123 ')).toBe('1234567890123');
  });

  test('converts to uppercase', () => {
    expect(cleanReferenceNumber('abc123')).toBe('ABC123');
  });

  test('handles empty string', () => {
    expect(cleanReferenceNumber('')).toBe('');
  });

  test('handles only special characters', () => {
    expect(cleanReferenceNumber('!@#$%')).toBe('');
  });
});

describe('validateReferenceNumberFormat', () => {
  test('accepts standard 13-digit format', () => {
    const result = validateReferenceNumberFormat('1234567890123');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('standard');
  });

  test('accepts flexible 10-15 digit format', () => {
    expect(validateReferenceNumberFormat('1234567890').valid).toBe(true);
    expect(validateReferenceNumberFormat('12345678901234').valid).toBe(true);
  });

  test('rejects formats with letters', () => {
    const result = validateReferenceNumberFormat('ABC1234567890');
    expect(result.valid).toBe(false);
    expect(result.format).toBe('invalid');
  });

  test('rejects too short formats', () => {
    const result = validateReferenceNumberFormat('123456789');
    expect(result.valid).toBe(false);
  });

  test('rejects too long formats', () => {
    const result = validateReferenceNumberFormat('1234567890123456');
    expect(result.valid).toBe(false);
  });
});

describe('extractReferenceFromPrefix', () => {
  test('removes "Ref:" prefix', () => {
    expect(extractReferenceFromPrefix('Ref:1234567890123')).toBe('1234567890123');
  });

  test('removes "REFERENCE:" prefix', () => {
    expect(extractReferenceFromPrefix('REFERENCE:1234567890123')).toBe('1234567890123');
  });

  test('removes "#" prefix', () => {
    expect(extractReferenceFromPrefix('#1234567890123')).toBe('1234567890123');
  });

  test('handles no prefix', () => {
    expect(extractReferenceFromPrefix('1234567890123')).toBe('1234567890123');
  });
});