/**
 * TypeScript interfaces for multi-step quote wizard state structure
 */

// Measurement unit types
export type MeasureUnit = 'inches' | 'centimeters' | 'millimeters';

// Window item types
export interface WindowItem {
  id: string;
  location: string;
  product_id: string | null;
  product_code: string;
  product_collection: string;
  product_description: string;
  unit: MeasureUnit;
  is_fixed: boolean;
  measured_width: number;
  measured_drop: number;
  final_width: number;
  final_drop: number;
  area_sqft: number;
  retail_price_sqft: number;
  supplier_cost_sqft: number;
  retail_amount: number;
  supplier_amount: number;
}

// Step 1: Customer Information
export interface CustomerInfo {
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string; // Matches existing CustomerStepData structure
  status: string;
}

// Step 2: Window Measurements Array
export interface WindowMeasurements {
  items: WindowItem[];
}

// Review step additional data
export interface ReviewData {
  installation_fee: number;
  delivery_fee: number;
}

// Complete wizard state structure
export interface WizardState {
  customer: CustomerInfo | null;
  measurements: WindowMeasurements | null;
  review: ReviewData | null;
  currentStep: 'customer' | 'measurements' | 'review';
  lastUpdated: string; // ISO timestamp for tracking
}

// localStorage keys
export const WIZARD_DRAFT_KEY = 'quote_wizard_draft';
export const WIZARD_DRAFT_BACKUP_KEY = 'quote_wizard_draft_backup';