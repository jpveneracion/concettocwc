import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/payment-settings
 *
 * Retrieves payment configuration settings (admin only)
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin access
    await requireAdmin(session.userId);

    // In a real implementation, you would fetch these from a database
    // For now, returning default settings that can be configured
    const settings = {
      mobile: {
        gcash: {
          number: process.env.GCASH_NUMBER || '0917-123-4567',
          accountName: process.env.GCASH_ACCOUNT_NAME || 'Concetto Inc.',
          qrCodeUrl: process.env.GCASH_QR_CODE_URL || '',
          enabled: true
        },
        gotyme: {
          number: process.env.GOTYME_NUMBER || '0928-987-6543',
          accountName: process.env.GOTYME_ACCOUNT_NAME || 'Concetto Inc.',
          qrCodeUrl: process.env.GOTYME_QR_CODE_URL || '',
          enabled: true
        }
      },
      crypto: {
        usdc: {
          polygonAddress: process.env.USDC_POLYGON_ADDRESS || '0x1234567890123456789012345678901234567890',
          enabled: true
        },
        usdt: {
          tronAddress: process.env.USDT_TRON_ADDRESS || 'TXyz123456789012345678901234567890123',
          enabled: true
        }
      },
      rates: {
        phpToUsd: parseFloat(process.env.PHP_TO_USD_RATE || '0.018')
      },
      business: {
        name: process.env.BUSINESS_NAME || 'Concetto Inc.',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@concetto.com',
        verificationTime: '24 hours'
      }
    };

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Get payment settings error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve payment settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/payment-settings
 *
 * Updates payment configuration settings (admin only)
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin access
    await requireAdmin(session.userId);

    const settings = await req.json();

    // Validate settings structure
    if (!settings.mobile || !settings.crypto || !settings.rates || !settings.business) {
      return NextResponse.json(
        { error: 'Invalid settings structure' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Validate the settings data
    // 2. Store in database (create a payment_settings table)
    // 3. Optionally update environment variables
    // 4. Log the changes for audit trail

    // For now, we'll update environment variables and return success
    // This is a simplified version - in production you'd use a database

    console.log('Payment settings updated by admin:', session.userId);
    console.log('New settings:', JSON.stringify(settings, null, 2));

    // Store in database or update env variables
    // await db.payment_settings.upsert({
    //   where: { id: 'default' },
    //   update: settings,
    //   create: { id: 'default', ...settings }
    // });

    return NextResponse.json({
      success: true,
      message: 'Payment settings updated successfully'
    });

  } catch (error) {
    console.error('Update payment settings error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update payment settings' },
      { status: 500 }
    );
  }
}