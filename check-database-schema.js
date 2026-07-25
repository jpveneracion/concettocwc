const { Client } = require('pg');

async function checkDatabaseSchema() {
  const client = new Client({
    connectionString: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if payment_settings table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'payment_settings'
      );
    `);

    console.log('payment_settings table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Get all columns in payment_settings
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'payment_settings'
        ORDER BY ordinal_position;
      `);

      console.log('\n📋 Current payment_settings columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Check for both old and new column names
      const oldColumns = columns.rows.filter(col =>
        col.column_name.includes('basic') ||
        col.column_name.includes('pro') ||
        col.column_name.includes('premium')
      );

      const newColumns = columns.rows.filter(col =>
        col.column_name.includes('monthly') ||
        col.column_name.includes('quarterly') ||
        col.column_name.includes('annual')
      );

      console.log('\n🔍 Old column names (basic/pro/premium):');
      if (oldColumns.length > 0) {
        oldColumns.forEach(col => console.log(`  - ${col.column_name}`));
      } else {
        console.log('  ❌ None found');
      }

      console.log('\n✅ New column names (monthly/quarterly/annual):');
      if (newColumns.length > 0) {
        newColumns.forEach(col => console.log(`  - ${col.column_name}`));
      } else {
        console.log('  ❌ None found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabaseSchema();