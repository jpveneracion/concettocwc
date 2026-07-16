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

  // Joined fields for API responses
  user_email?: string;
  user_name?: string;
  plan_name?: string;
  plan_amount?: number;
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
}

/**
 * Verification list filters interface
 */
export interface VerificationListFilters {
  status?: VerificationStatus;
  user_id?: string;
  plan_id?: string;
  date_from?: Date;
  date_to?: Date;
  search?: string; // Search by reference number or user email
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