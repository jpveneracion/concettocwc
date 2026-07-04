export type Unit = 'sqft' | 'sqm';
export type MeasureUnit = 'in' | 'cm';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'cancelled';

export interface Company {
  id: string;
  code: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  prepared_by: string;
  terms: string;
  del_note: string;
  closing_note: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  company: string;
  address: string;
  mobile: string;
  email: string;
  prepared_by: string;
  terms: string;
  del_note: string;
  closing_note: string;
  updated_at: string;
}

export interface Product {
  id: string;
  code: string;
  collection: string;
  description: string;
  unit: Unit;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  sort_order: number;
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

export interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  installation_fee: number;
  delivery_fee: number;
  subtotal: number;
  total: number;
  total_area: number;
  panel_count: number;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
}

// Payload sent from the form to the API
export interface QuotePayload {
  quote_number: string;
  customer_name: string;
  customer_address: string;
  quote_date: string;
  our_ref: string;
  installation_fee: number;
  delivery_fee: number;
  items: Omit<QuoteItem, 'id' | 'quote_id'>[];
  status?: QuoteStatus;
}

// Dashboard metrics

export interface DashboardMetrics {
  monthlySales: number;
  yearlySales: number;
  profit: number;
  profitMargin: number;
  conversionRate: number;
  totalQuotes: number;
  approvedQuotes: number;
  pendingQuotes: number;
  averageOrderValue: number;
  revenueTrends: Array<{ month: string; revenue: number }>;
  popularCollections: Array<{ collection: string; count: number; revenue: number }>;
  topCustomers: Array<{ customerName: string; totalRevenue: number; quoteCount: number }>;
}

export interface DateRange {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  period: 'month' | 'year' | 'custom';
}

// Cost categories (company-configurable)

export type CostCategory = string; // e.g., "materials", "labor", "overhead"
export type CostBreakdown = Record<CostCategory, number>;
