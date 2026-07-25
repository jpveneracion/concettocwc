/**
 * Payment method enumeration
 */
export type PaymentMethod = 'gcash' | 'gotyme' | 'usdc' | 'card' | 'bank_transfer';

/**
 * Payment verification status enumeration
 */
export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * Payment verification record interface
 */
export interface PaymentVerification {
  id: string;
  user_id: string;
  plan_id: string;
  screenshot_url: string; // IPFS CID or Pinata gateway URL
  reference_number?: string;
  notes?: string;
  status: VerificationStatus;
  admin_notes?: string;
  admin_id?: string; // ID of admin who approved/rejected
  submitted_at: Date;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
  promo_code?: string; // Promo code used for this payment verification, if any

  // Joined fields for API responses
  user_email?: string;
  user_name?: string;
  plan_name?: string;
  plan_amount?: number;
}

/**
 * GCash webhook data record interface
 */
export interface GCashWebhookData {
  id: string;
  transaction_number: string;
  cleaned_transaction_number: string;
  amount: number;
  sender_name?: string;
  sender_account?: string;
  receiver_name?: string;
  receiver_account?: string;
  transaction_time: Date;
  notification_text?: string;
  raw_webhook_payload: Record<string, any>;
  received_at: Date;
  processed: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Gateway device heartbeat record interface
 */
export interface GatewayHeartbeat {
  id: string;
  device_id: string;
  last_ping: Date;
  status: 'online' | 'offline' | 'degraded';
  ip_address?: string;
  battery_level?: number;
  macrodroid_version?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Payment settings interface
 */
export interface PaymentSettings {
  id: string;
  payment_method: 'gcash' | 'gotyme' | 'usdc';
  qr_code_url: string;
  account_name: string;
  account_number: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Enhanced payment verification with automatic verification fields
 */
export interface EnhancedPaymentVerification extends PaymentVerification {
  automatic_verification_attempted: boolean;
  automatic_verification_status?: 'matched' | 'no_webhook_data' | 'amount_mismatch' | 'time_mismatch';
  webhook_data_id?: string;
  verification_method: 'automatic' | 'manual';
  cleaned_reference_number?: string;
}

/**
 * Webhook creation request interface
 */
export interface CreateWebhookRequest {
  transaction_number: string;
  amount: number;
  sender_name?: string;
  sender_account?: string;
  receiver_name?: string;
  receiver_account?: string;
  transaction_time: string; // ISO string
  notification_text?: string;
  raw_data?: Record<string, any>;
}

/**
 * Gateway heartbeat request interface
 */
export interface HeartbeatRequest {
  device_id: string;
  battery_level?: number;
  macrodroid_version?: string;
}

/**
 * Create verification request interface
 */
export interface CreateVerificationRequest {
  plan_id: string;
  screenshot_file: File; // Will be uploaded to Pinata
  reference_number?: string;
  notes?: string;
}

/**
 * Create verification response interface
 */
export interface CreateVerificationResponse {
  success: boolean;
  verification_id?: string;
  message: string;
  estimated_review_time: string;
  verification_method?: 'automatic' | 'manual';
}

/**
 * Verification list filters interface
 */
export interface VerificationListFilters {
  status?: VerificationStatus;
  user_id?: string;
  plan_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Search by reference number or user email
  limit?: number;
  offset?: number;
}

/**
 * Verification approve request interface
 */
export interface ApproveVerificationRequest {
  admin_notes?: string;
}

/**
 * Verification approve response interface
 */
export interface ApproveVerificationResponse {
  success: boolean;
  subscription_id?: string;
  message: string;
  user_notified: boolean;
}

/**
 * Verification reject request interface
 */
export interface RejectVerificationRequest {
  reason: string; // Required rejection reason
  admin_notes?: string;
}

/**
 * Verification reject response interface
 */
export interface RejectVerificationResponse {
  success: boolean;
  message: string;
  user_notified: boolean;
}

/**
 * Verification statistics interface
 */
export interface VerificationStats {
  total_pending: number;
  pending_today: number;
  approved_today: number;
  rejected_today: number;
  total_approved: number;
  total_rejected: number;
}