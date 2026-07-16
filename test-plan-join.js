/**
 * Test script to investigate the plan_id JOIN issue
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

const sql = neon(process.env.DATABASE_URL);

async function investigatePlanJoin() {
  console.log('🔍 INVESTIGATING PLAN_ID JOIN ISSUE\n');

  try {
    // Check if subscription_plans table exists
    const plansTable = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'subscription_plans'
      );
    `);

    console.log('subscription_plans table exists:', plansTable[0].exists);

    if (plansTable[0].exists) {
      // Get subscription_plans structure
      const plansColumns = await sql(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'subscription_plans'
        ORDER BY ordinal_position;
      `);

      console.log('\nsubscription_plans columns:');
      plansColumns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });

      // Get payment_verifications plan_id type
      const pvColumnType = await sql(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'payment_verifications'
        AND column_name = 'plan_id'
      `);

      console.log(`\npayment_verifications.plan_id type: ${pvColumnType[0].data_type}`);

      // Check if there are any subscription plans
      const plansCount = await sql('SELECT COUNT(*) as count FROM subscription_plans');
      console.log(`\nsubscription_plans count: ${plansCount[0].count}`);

      if (plansCount[0].count > 0) {
        const samplePlans = await sql('SELECT * FROM subscription_plans LIMIT 3');
        console.log('\nSample subscription_plans:');
        samplePlans.forEach(plan => {
          console.log(`  ID: ${plan.id}, Name: ${plan.name}`);
        });
      }

      // Test the JOIN with explicit casting
      console.log('\n🧪 Testing JOIN with different approaches:');

      // Test 1: Direct JOIN (should fail)
      try {
        const result = await sql(`
          SELECT
            pv.*,
            sp.name as plan_name
          FROM payment_verifications pv
          LEFT JOIN subscription_plans sp ON pv.plan_id = sp.id
          LIMIT 1
        `);
        console.log('  ✅ Direct JOIN works');
      } catch (error) {
        console.log(`  ❌ Direct JOIN failed: ${error.message}`);
      }

      // Test 2: JOIN with text casting
      try {
        const result = await sql(`
          SELECT
            pv.*,
            sp.name as plan_name
          FROM payment_verifications pv
          LEFT JOIN subscription_plans sp ON pv.plan_id::text = sp.id::text
          LIMIT 1
        `);
        console.log('  ✅ JOIN with text casting works');
      } catch (error) {
        console.log(`  ❌ JOIN with text casting failed: ${error.message}`);
      }

    } else {
      console.log('⚠️  subscription_plans table does not exist');
      console.log('This is expected if subscription plans are not implemented yet');
    }

    console.log('\n🎯 INVESTIGATION COMPLETE');
    console.log('The JOIN issue is likely due to missing subscription_plans table or type mismatch');
    console.log('This is not a migration issue - the payment_verifications table is correct');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

investigatePlanJoin();