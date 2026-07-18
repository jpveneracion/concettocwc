import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { sql } from '@/lib/db';

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

    // Fetch from database using the existing row-based schema
    try {
      const result = await sql`
        SELECT payment_method, account_number, account_name, qr_code_url, active
        FROM payment_settings
      `;

      // Convert row-based format to our API format
      const gcashRow = result.find(r => r.payment_method === 'gcash');
      const gotymeRow = result.find(r => r.payment_method === 'gotyme');

      const settings = {
        mobile: {
          gcash: {
            number: gcashRow?.account_number || process.env.GCASH_NUMBER || '0917-123-4567',
            accountName: gcashRow?.account_name || process.env.GCASH_ACCOUNT_NAME || 'Concetto Inc.',
            qrCodeUrl: gcashRow?.qr_code_url || process.env.GCASH_QR_CODE_URL || '',
            enabled: gcashRow?.active ?? true
          },
          gotyme: {
            number: gotymeRow?.account_number || process.env.GOTYME_NUMBER || '0928-987-6543',
            accountName: gotymeRow?.account_name || process.env.GOTYME_ACCOUNT_NAME || 'Concetto Inc.',
            qrCodeUrl: gotymeRow?.qr_code_url || process.env.GOTYME_QR_CODE_URL || '',
            enabled: gotymeRow?.active ?? true
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
        discounts: {
          quarterly: parseFloat(result[0]?.quarterly_discount_percent || '5.00'),
          annual: parseFloat(result[0]?.annual_discount_percent || '8.00')
        },
        business: {
          name: process.env.BUSINESS_NAME || 'Concetto Inc.',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@concetto.com',
          verificationTime: '24 hours'
        }
      };

      return NextResponse.json(settings);
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // Fallback to environment variables if database fails
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
      },
      discounts: {
        quarterly: 5.00,
        annual: 8.00
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
    if (!settings.mobile || !settings.crypto || !settings.rates || !settings.business || !settings.discounts) {
      return NextResponse.json(
        { error: 'Invalid settings structure' },
        { status: 400 }
      );
    }

    // Try to save to database using the existing schema
    try {
      // Insert or update GCash settings
      await sql`
        INSERT INTO payment_settings (payment_method, account_number, account_name, qr_code_url, active, quarterly_discount_percent, annual_discount_percent)
        VALUES ('gcash', ${settings.mobile.gcash.number}, ${settings.mobile.gcash.accountName}, ${settings.mobile.gcash.qrCodeUrl}, ${settings.mobile.gcash.enabled}, ${settings.discounts.quarterly}, ${settings.discounts.annual})
        ON CONFLICT (payment_method) DO UPDATE SET
          account_number = EXCLUDED.account_number,
          account_name = EXCLUDED.account_name,
          qr_code_url = EXCLUDED.qr_code_url,
          active = EXCLUDED.active,
          quarterly_discount_percent = EXCLUDED.quarterly_discount_percent,
          annual_discount_percent = EXCLUDED.annual_discount_percent,
          updated_at = CURRENT_TIMESTAMP
      `;

      // Insert or update GoTyme settings
      await sql`
        INSERT INTO payment_settings (payment_method, account_number, account_name, qr_code_url, active, quarterly_discount_percent, annual_discount_percent)
        VALUES ('gotyme', ${settings.mobile.gotyme.number}, ${settings.mobile.gotyme.accountName}, ${settings.mobile.gotyme.qrCodeUrl}, ${settings.mobile.gotyme.enabled}, ${settings.discounts.quarterly}, ${settings.discounts.annual})
        ON CONFLICT (payment_method) DO UPDATE SET
          account_number = EXCLUDED.account_number,
          account_name = EXCLUDED.account_name,
          qr_code_url = EXCLUDED.qr_code_url,
          active = EXCLUDED.active,
          quarterly_discount_percent = EXCLUDED.quarterly_discount_percent,
          annual_discount_percent = EXCLUDED.annual_discount_percent,
          updated_at = CURRENT_TIMESTAMP
      `;

      console.log('Payment settings updated by admin:', session.userId);
      return NextResponse.json({
        success: true,
        message: 'Payment settings updated successfully'
      });
    } catch (dbError) {
      console.error('Database save failed, settings not persisted:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save settings to database'
      }, { status: 500 });
    }

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