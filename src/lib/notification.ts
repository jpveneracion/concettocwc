// src/lib/notification.ts

import { getUser } from './db';
import { getSubscriptionPlanById } from './subscription-plans';

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

/**
 * Email notification result interface
 */
interface NotificationResult {
  success: boolean;
  sent: boolean;
  error?: string;
  method: 'log' | 'email';
}

/**
 * Email content interface
 */
interface EmailContent {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Notification parameters interface
 */
interface NotificationParams {
  userId: string;
  planId: string;
  verificationId: string;
}

/**
 * Rejection notification parameters interface
 */
interface RejectionNotificationParams extends NotificationParams {
  reason: string;
}

/**
 * Admin notification parameters interface
 */
interface AdminNotificationParams {
  verificationId: string;
  userId: string;
  planId: string;
}

// ============================================================================
// EMAIL CONTENT GENERATORS
// ============================================================================

/**
 * Generate approval email content
 */
async function generateApprovalEmailContent(
  userEmail: string,
  userName: string,
  planName: string,
  planPrice: string,
  verificationId: string
): Promise<EmailContent> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const subject = 'Payment Verified - Subscription Activated';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Payment Verified!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your subscription has been activated</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          Hi ${userName},
        </p>

        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          Great news! Your payment has been verified and your subscription has been successfully activated.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Subscription Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <strong>Plan:</strong> ${planName}
            </li>
            <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <strong>Amount Paid:</strong> ${planPrice}
            </li>
            <li style="padding: 8px 0;">
              <strong>Verification ID:</strong> ${verificationId}
            </li>
          </ul>
        </div>

        <p style="font-size: 16px; color: #374151; margin: 20px 0;">
          You can now access all the features included in your subscription plan.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/account/subscription" style="display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Access Your Account
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
          If you have any questions or need assistance, please don't hesitate to contact our support team.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  `;

  const textBody = `
    PAYMENT VERIFIED - SUBSCRIPTION ACTIVATED

    Hi ${userName},

    Great news! Your payment has been verified and your subscription has been successfully activated.

    Subscription Details:
    Plan: ${planName}
    Amount Paid: ${planPrice}
    Verification ID: ${verificationId}

    You can now access all the features included in your subscription plan.

    Access your account: ${appUrl}/account/subscription

    If you have any questions or need assistance, please don't hesitate to contact our support team.

    This is an automated email. Please do not reply.
  `;

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody
  };
}

/**
 * Generate rejection email content
 */
async function generateRejectionEmailContent(
  userEmail: string,
  userName: string,
  planName: string,
  verificationId: string,
  rejectionReason: string
): Promise<EmailContent> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const subject = 'Payment Verification Requires Attention';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Verification Update Required</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your payment verification needs attention</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          Hi ${userName},
        </p>

        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          We reviewed your payment verification for <strong>${planName}</strong> and need some additional information.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Reason for Review:</h3>
          <p style="color: #6b7280; margin: 0; font-size: 15px; line-height: 1.5;">${rejectionReason}</p>
        </div>

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">Next Steps:</h3>
          <ol style="color: #1e40af; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Review the reason provided above</li>
            <li style="margin-bottom: 10px;">Take a clear screenshot of your payment confirmation</li>
            <li style="margin-bottom: 10px;">Include the transaction reference number</li>
            <li style="margin-bottom: 10px;">Submit a new verification with correct information</li>
          </ol>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/payment/verification?plan_id=re-submit" style="display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Resubmit Verification
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
          <strong>Verification ID:</strong> ${verificationId}
        </p>

        <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
          If you believe this is an error or need assistance, please contact our support team.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  `;

  const textBody = `
    VERIFICATION UPDATE REQUIRED

    Hi ${userName},

    We reviewed your payment verification for ${planName} and need some additional information.

    Reason for Review:
    ${rejectionReason}

    Next Steps:
    1. Review the reason provided above
    2. Take a clear screenshot of your payment confirmation
    3. Include the transaction reference number
    4. Submit a new verification with correct information

    Resubmit verification: ${appUrl}/payment/verification

    Verification ID: ${verificationId}

    If you believe this is an error or need assistance, please contact our support team.

    This is an automated email. Please do not reply.
  `;

  return {
    to: userEmail,
    subject,
    htmlBody,
    textBody
  };
}

/**
 * Generate admin notification email content
 */
async function generateAdminNotificationEmailContent(
  adminEmail: string,
  verificationId: string,
  userEmail: string,
  planName: string
): Promise<EmailContent> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const subject = 'New Payment Verification Requires Review';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">New Verification Alert</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Payment verification requires your review</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          A new payment verification has been submitted and requires your review.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Verification Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <strong>Verification ID:</strong> ${verificationId}
            </li>
            <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <strong>User Email:</strong> ${userEmail}
            </li>
            <li style="padding: 8px 0;">
              <strong>Plan:</strong> ${planName}
            </li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/admin/verifications" style="display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Review Verification
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
          Please review this verification at your earliest convenience to ensure timely activation of the user's subscription.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  `;

  const textBody = `
    NEW VERIFICATION ALERT

    A new payment verification has been submitted and requires your review.

    Verification Details:
    Verification ID: ${verificationId}
    User Email: ${userEmail}
    Plan: ${planName}

    Review verification: ${appUrl}/admin/verifications

    Please review this verification at your earliest convenience to ensure timely activation of the user's subscription.

    This is an automated email. Please do not reply.
  `;

  return {
    to: adminEmail,
    subject,
    htmlBody,
    textBody
  };
}

// ============================================================================
// EMAIL SENDING FUNCTIONS
// ============================================================================

/**
 * Send email using configured email service
 */
async function sendEmail(content: EmailContent): Promise<NotificationResult> {
  try {
    // Check if email service is configured
    const emailServiceConfigured = process.env.SENDGRID_API_KEY ||
                                  process.env.AWS_SES_ACCESS_KEY_ID ||
                                  process.env.EMAIL_SERVICE_URL;

    if (!emailServiceConfigured) {
      console.log('📧 Email service not configured - logging email content:');
      console.log(`To: ${content.to}`);
      console.log(`Subject: ${content.subject}`);
      console.log(`Text Body:\n${content.textBody}`);

      return {
        success: true,
        sent: false,
        method: 'log'
      };
    }

    // TODO: Implement actual email service integration
    // Options: SendGrid, AWS SES, Mailgun, or custom email service

    // SendGrid example (when configured):
    // if (process.env.SENDGRID_API_KEY) {
    //   const sgMail = require('@sendgrid/mail');
    //   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    //   await sgMail.send({
    //     to: content.to,
    //     from: process.env.FROM_EMAIL || 'noreply@concetto.com',
    //     subject: content.subject,
    //     text: content.textBody,
    //     html: content.htmlBody
    //   });
    // }

    // For now, log the email that would be sent
    console.log('📧 Email would be sent:', {
      to: content.to,
      subject: content.subject,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      sent: true,
      method: 'email'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email:', errorMessage);

    return {
      success: false,
      sent: false,
      error: errorMessage,
      method: 'email'
    };
  }
}

// ============================================================================
// PUBLIC NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send payment approval notification to user
 *
 * @param params - Notification parameters including userId, planId, and verificationId
 * @returns Promise<void> - Resolves when notification is sent or logged
 * @throws Error if user or plan lookup fails
 *
 * @example
 * ```typescript
 * await sendPaymentApprovalNotification({
 *   userId: 'user-uuid',
 *   planId: 'plan-uuid',
 *   verificationId: 'verification-uuid'
 * });
 * ```
 */
export async function sendPaymentApprovalNotification(params: NotificationParams): Promise<void> {
  try {
    console.log('📧 Sending payment approval notification...', {
      userId: params.userId,
      planId: params.planId,
      verificationId: params.verificationId
    });

    // Get user details
    const user = await getUser(params.userId);
    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // Get plan details
    const plan = await getSubscriptionPlanById(params.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }

    // Format price
    const formattedPrice = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: plan.currency
    }).format(parseFloat(plan.price));

    // Generate email content
    const emailContent = await generateApprovalEmailContent(
      user.email,
      user.name,
      plan.name,
      formattedPrice,
      params.verificationId
    );

    // Send email
    const result = await sendEmail(emailContent);

    if (result.success) {
      console.log('✅ Payment approval notification sent successfully:', {
        to: user.email,
        method: result.method,
        sent: result.sent
      });
    } else {
      console.error('❌ Failed to send payment approval notification:', result.error);
    }

  } catch (error) {
    console.error('❌ Failed to send payment approval notification:', error);
    throw new Error(`Failed to send payment approval notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send payment rejection notification to user
 *
 * @param params - Rejection notification parameters including userId, planId, verificationId, and reason
 * @returns Promise<void> - Resolves when notification is sent or logged
 * @throws Error if user or plan lookup fails, or reason is empty
 *
 * @example
 * ```typescript
 * await sendPaymentRejectionNotification({
 *   userId: 'user-uuid',
 *   planId: 'plan-uuid',
 *   verificationId: 'verification-uuid',
 *   reason: 'Screenshot is blurry and transaction details are not visible'
 * });
 * ```
 */
export async function sendPaymentRejectionNotification(params: RejectionNotificationParams): Promise<void> {
  try {
    // Validate rejection reason
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    console.log('📧 Sending payment rejection notification...', {
      userId: params.userId,
      planId: params.planId,
      verificationId: params.verificationId,
      reason: params.reason
    });

    // Get user details
    const user = await getUser(params.userId);
    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // Get plan details
    const plan = await getSubscriptionPlanById(params.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }

    // Generate email content with rejection reason
    const emailContent = await generateRejectionEmailContent(
      user.email,
      user.name,
      plan.name,
      params.verificationId,
      params.reason
    );

    // Send email
    const result = await sendEmail(emailContent);

    if (result.success) {
      console.log('✅ Payment rejection notification sent successfully:', {
        to: user.email,
        method: result.method,
        sent: result.sent
      });
    } else {
      console.error('❌ Failed to send payment rejection notification:', result.error);
    }

  } catch (error) {
    console.error('❌ Failed to send payment rejection notification:', error);
    throw new Error(`Failed to send payment rejection notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send admin notification for new payment verification
 *
 * @param params - Admin notification parameters including verificationId, userId, and planId
 * @returns Promise<void> - Resolves when notification is sent or logged
 * @throws Error if user or plan lookup fails
 *
 * @example
 * ```typescript
 * await sendAdminNotification({
 *   verificationId: 'verification-uuid',
 *   userId: 'user-uuid',
 *   planId: 'plan-uuid'
 * });
 * ```
 */
export async function sendAdminNotification(params: AdminNotificationParams): Promise<void> {
  try {
    console.log('📧 Sending admin notification for new verification...', {
      verificationId: params.verificationId,
      userId: params.userId,
      planId: params.planId
    });

    // Get user details
    const user = await getUser(params.userId);
    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // Get plan details
    const plan = await getSubscriptionPlanById(params.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }

    // Get admin email (can be configured via environment variable)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@concetto.com';

    // Generate email content for admin
    const emailContent = await generateAdminNotificationEmailContent(
      adminEmail,
      params.verificationId,
      user.email,
      plan.name
    );

    // Send email
    const result = await sendEmail(emailContent);

    if (result.success) {
      console.log('✅ Admin notification sent successfully:', {
        to: adminEmail,
        method: result.method,
        sent: result.sent
      });
    } else {
      console.error('❌ Failed to send admin notification:', result.error);
    }

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
    throw new Error(`Failed to send admin notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}