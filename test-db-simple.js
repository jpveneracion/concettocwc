const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
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

const DATABASE_URL = process.env.DATABASE_URL;
const sql = neon(DATABASE_URL);

async function quickTest() {
  try {
    console.log('Testing database connection...');

    // Test 1: Check if table exists
    const tableExists = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'payment_verifications'
      );
    `);

    console.log('Table exists:', tableExists[0].exists);

    // Test 2: Get column count
    const columns = await sql(`
      SELECT COUNT(*) as count FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
    `);

    console.log('Column count:', columns[0].count);

    // Test 3: Check key columns
    const keyColumns = await sql(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payment_verifications'
      AND column_name IN ('id', 'user_id', 'plan_id', 'screenshot_url', 'status')
    `);

    console.log('Key columns found:', keyColumns.map(c => c.column_name));

    // Test 4: Count verifications
    const count = await sql('SELECT COUNT(*) as count FROM payment_verifications');
    console.log('Total verifications:', count[0].count);

    // Test 5: Check indexes
    const indexes = await sql(`
      SELECT COUNT(*) as count FROM pg_indexes
      WHERE tablename = 'payment_verifications'
      AND schemaname = 'public'
    `);

    console.log('Index count:', indexes[0].count);

    console.log('✅ Database connection and structure verified!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();