const { Client } = require('pg');

async function checkDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check users table for role columns
    const usersSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('role', 'is_admin')
      ORDER BY column_name
    `);
    console.log('\n📋 Users table role columns:');
    console.log(usersSchema.rows);

    // Check products table structure
    const productsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Products table structure:');
    console.log(productsSchema.rows);

    // Check if pending_products table exists
    const pendingTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'pending_products'
    `);
    console.log('\n📋 Pending products table exists:', pendingTables.rows.length > 0);

    // Check existing products
    const existingProducts = await client.query(`
      SELECT COUNT(*) as count FROM products
    `);
    console.log('\n📋 Existing products count:', existingProducts.rows[0].count);

  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await client.end();
  }
}

checkDatabase();
