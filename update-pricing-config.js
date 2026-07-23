require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  console.error('Make sure .env.local file exists and contains DATABASE_URL');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function updatePricingConfig() {
  try {
    console.log('Checking current pricing_config...');

    // Check current pricing
    const currentPricing = await sql`
      SELECT * FROM pricing_config
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    if (currentPricing.length > 0) {
      console.log('Current pricing from database:');
      console.log(JSON.stringify(currentPricing[0], null, 2));
    } else {
      console.log('No active pricing found in database');
    }

    console.log('\nUpdating pricing_config to user desired values:');
    console.log('- Monthly base rate: ₱500');
    console.log('- Quarterly discount: 10% (₱1,350 total)');
    console.log('- Annual discount: 15% (₱5,100 total)');

    // Update the pricing configuration
    const result = await sql`
      UPDATE pricing_config
      SET
        monthly_base_rate = 500.00,
        quarterly_discount_percent = 10.00,
        annual_discount_percent = 15.00,
        updated_at = NOW(),
        change_reason = 'Update to user desired pricing: Monthly ₱500, Quarterly ₱1,350 (10% discount), Annual ₱5,100 (15% discount)'
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      RETURNING *
    `;

    if (result.length > 0) {
      console.log('\n✅ Pricing updated successfully!');
      console.log('Updated pricing config:');
      console.log(JSON.stringify(result[0], null, 2));

      // Create history entry
      await sql`
        INSERT INTO pricing_history (
          pricing_config_id,
          change_type,
          change_reason,
          new_value,
          previous_config
        ) VALUES (
          ${result[0].id},
          'UPDATE',
          'Update to user desired pricing: Monthly ₱500, Quarterly ₱1,350 (10% discount), Annual ₱5,100 (15% discount)',
          'Monthly Base Rate: 500.00, Quarterly Discount: 10.00%, Annual Discount: 15.00%',
          ${JSON.stringify(result[0])}
        )
      `;
      console.log('✅ History entry created');
    } else {
      console.log('❌ No active pricing configuration found to update');
    }

    // Verify the update
    console.log('\nVerifying updated pricing...');
    const updatedPricing = await sql`
      SELECT * FROM pricing_config
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    if (updatedPricing.length > 0) {
      const pricing = updatedPricing[0];
      console.log('Updated pricing values:');
      console.log(`- Monthly base rate: ₱${pricing.monthly_base_rate}`);
      console.log(`- Quarterly discount: ${pricing.quarterly_discount_percent}%`);
      console.log(`- Annual discount: ${pricing.annual_discount_percent}%`);

      // Calculate expected prices
      const monthlyRate = parseFloat(pricing.monthly_base_rate);
      const quarterlyDiscount = parseFloat(pricing.quarterly_discount_percent);
      const annualDiscount = parseFloat(pricing.annual_discount_percent);

      const monthlyPrice = monthlyRate;
      const quarterlyPrice = (monthlyRate * 3) * (1 - quarterlyDiscount / 100);
      const annualPrice = (monthlyRate * 12) * (1 - annualDiscount / 100);

      console.log('\nExpected prices:');
      console.log(`- Monthly: ₱${monthlyPrice.toFixed(2)}`);
      console.log(`- Quarterly: ₱${quarterlyPrice.toFixed(2)}`);
      console.log(`- Annual: ₱${annualPrice.toFixed(2)}`);
    }

  } catch (error) {
    console.error('Error updating pricing config:', error);
    process.exit(1);
  }
  process.exit(0);
}

updatePricingConfig();