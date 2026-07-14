import { config } from 'dotenv';
config({ path: '.env.local' });
import { sql } from './src/lib/db.js';

async function checkDatabase() {
  try {
    console.log('✅ Connected to database');

    // Check users table for role columns
    const usersSchema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('role', 'is_admin')
      ORDER BY column_name
    `;
    console.log('\n📋 Users table role columns:');
    console.log(usersSchema);

    // Check products table structure
    const productsSchema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `;
    console.log('\n📋 Products table structure:');
    console.log(productsSchema);

    // Check if pending_products table exists
    const pendingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'pending_products'
    `;
    console.log('\n📋 Pending products table exists:', pendingTables.length > 0);

    // Check existing products
    const existingProducts = await sql`
      SELECT COUNT(*) as count FROM products
    `;
    console.log('\n📋 Existing products count:', existingProducts[0]?.count || 0);

    process.exit(0);
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }
}

checkDatabase();