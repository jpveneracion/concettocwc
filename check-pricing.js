const { sql } = require('./src/lib/db.js');

async function checkPricing() {
  try {
    const result = await sql`
      SELECT * FROM pricing_config 
      WHERE is_active = TRUE 
        AND valid_from <= NOW() 
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY valid_from DESC 
      LIMIT 1
    `;
    
    if (result.length > 0) {
      console.log('Current pricing from database:');
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      console.log('No active pricing found in database - using fallback pricing (500 PHP)');
    }
  } catch (error) {
    console.error('Error checking pricing:', error.message);
  }
  process.exit(0);
}

checkPricing();
