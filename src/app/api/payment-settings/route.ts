import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/payment-settings
 *
 * Public endpoint for payment configuration (no auth required)
 */
export async function GET(req: Request) {
  try {
    // Try to fetch from database using the existing row-based schema
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
      }
    };

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Get payment settings error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve payment settings' },
      { status: 500 }
    );
  }
}