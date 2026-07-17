/**
 * Payment Configuration
 *
 * Add your actual payment details here. For production, consider using environment variables
 * for sensitive information like wallet addresses and phone numbers.
 */

export const paymentConfig = {
  // Mobile Payment Methods
  mobile: {
    gcash: {
      name: 'GCash',
      number: process.env.GCASH_NUMBER || '0917-123-4567',
      accountName: process.env.GCASH_ACCOUNT_NAME || 'Concetto Inc.',
      instructions: [
        'Open your GCash app',
        'Select "Send Money"',
        'Choose "Express Send"',
        'Enter the number: {number}',
        'Input the exact amount: {amount}',
        'Take a screenshot of the confirmation'
      ]
    },
    gotyme: {
      name: 'GoTyme',
      number: process.env.GOTYME_NUMBER || '0928-987-6543',
      accountName: process.env.GOTYME_ACCOUNT_NAME || 'Concetto Inc.',
      instructions: [
        'Open your GoTyme app',
        'Select "Transfer"',
        'Choose "Send to Mobile Number"',
        'Enter the number: {number}',
        'Input the exact amount: {amount}',
        'Take a screenshot of the confirmation'
      ]
    }
  },

  // Crypto Payment Methods
  crypto: {
    USDC: {
      network: 'Polygon (MATIC)',
      address: process.env.USDC_POLYGON_ADDRESS || '0x1234567890123456789012345678901234567890',
      usdRate: 1.0,
      explorerUrl: 'https://polygonscan.com'
    },
    USDT: {
      network: 'Tron (TRC20)',
      address: process.env.USDT_TRON_ADDRESS || 'TXyz123456789012345678901234567890123',
      usdRate: 1.0,
      explorerUrl: 'https://tronscan.org'
    }
  },

  // Conversion Rates
  rates: {
    phpToUsd: 0.018, // Update with current rate
    // You could also integrate with a rate API for live rates
  },

  // Business Information
  business: {
    name: 'Concetto Inc.',
    supportEmail: 'support@concetto.com',
    verificationTime: '24 hours',
    website: 'https://concetto.com'
  },

  // Payment Instructions
  instructions: {
    mobile: [
      'Open your payment app',
      'Select "Send Money" or "Transfer"',
      'Enter the phone number above',
      'Input the EXACT amount shown',
      'Use your registered name in notes',
      'Take a clear screenshot of confirmation'
    ],
    crypto: [
      'Open your crypto wallet',
      'Select the correct network',
      'Copy the wallet address carefully',
      'Send the exact amount',
      'Save the transaction hash/ID',
      'Take a screenshot of the confirmation'
    ]
  }
};

// Helper function to get live rates (optional - integrate with rate API)
export async function getLiveRates() {
  try {
    // Example: Integrate with a free exchange rate API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    return {
      phpToUsd: 1 / data.rates.PHP,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error('Failed to fetch live rates, using defaults:', error);
    return {
      phpToUsd: paymentConfig.rates.phpToUsd,
      lastUpdated: new Date()
    };
  }
}