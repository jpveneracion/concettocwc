export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  paymongo_plan_id: string;
  features: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  company_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'suspended';
  plan_id: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  paymongo_subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  plan_id: string;
  quantity: number;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  company_id: string;
  number: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  paid_at: Date | null;
  attempt_count: number;
  paymongo_invoice_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  company_id: string;
  paymongo_payment_method_id: string;
  type: 'gcash' | 'maya' | 'card';
  card_last4: string | null;
  expiry_date: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  paymongo_event_id: string;
  payload: Record<string, any>;
  processed: boolean;
  processing_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionAccess {
  allowed: boolean;
  mode: 'full' | 'readonly' | 'denied';
  reason?: string;
  subscription?: SubscriptionDetails;
}

export interface SubscriptionDetails {
  plan: SubscriptionPlan;
  status: string;
  trial_end: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  usage_stats: {
    quotes_created_this_period: number;
    quotes_remaining: number;
  };
}

export interface PayMongoCheckoutRequest {
  plan_id: string;
  success_url: string;
  cancel_url: string;
}

export interface PayMongoCheckoutResponse {
  checkout_url: string;
  session_id: string;
}
