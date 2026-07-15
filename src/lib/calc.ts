import type { MeasureUnit } from '@/types';

const OVERLAP_IN = 6;    // inches added each side when not fixed
const OVERLAP_CM = 15;   // cm added each side when not fixed

export function calcFinalSize(
  measured_width: number,
  measured_drop: number,
  is_fixed: boolean,
  unit: MeasureUnit
): { final_width: number; final_drop: number } {
  if (is_fixed) {
    return { final_width: measured_width, final_drop: measured_drop };
  }
  const overlap = unit === 'cm' ? OVERLAP_CM : OVERLAP_IN;
  return {
    final_width: measured_width + overlap,
    final_drop: measured_drop + overlap,
  };
}

export function toInches(value: number, unit: MeasureUnit): number {
  return unit === 'cm' ? value / 2.54 : value;
}

export function calcAreaSqft(
  final_width: number,
  final_drop: number,
  unit: MeasureUnit
): number {
  const widthIn = toInches(final_width, unit);
  const dropIn = toInches(final_drop, unit);
  return (widthIn * dropIn) / 144;
}

export function calcAmounts(area: number, retail: number, cost: number) {
  return {
    retail_amount: area * retail,
    supplier_amount: area * cost,
  };
}

export function generateQuoteNumber(sequenceNum: number): string {
  const yr = new Date().getUTCFullYear().toString().slice(-2);
  const seq = sequenceNum.toString().padStart(5, '0');
  return `CWC-DF-QT-${yr}-${seq}`;
}

export function generatePoNumber(quoteNumber: string): string {
  return quoteNumber.replace('-QT-', '-PO-');
}

export function phpFormat(value: number): string {
  return '₱' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
