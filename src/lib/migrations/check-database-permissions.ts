/**
 * Check database permissions and existing tables
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function checkDatabase() {
  const sql = neon(DATABASE_URL);

  try {
    console.log('🔍 Checking database permissions and current state...');

    // Check current user
    const currentUser = await sql`SELECT current_user, current_database()`;
    console.log('Current user:', currentUser);

    // Check existing tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('Existing tables:', tables);

    // Check if we can query companies table (should exist)
    const companiesCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'companies'
      )
    `;
    console.log('Companies table exists:', companiesCheck);

    // Check if we can query users table
    const usersCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      )
    `;
    console.log('Users table exists:', usersCheck);

    // Check if we can query products table
    const productsCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'products'
      )
    `;
    console.log('Products table exists:', productsCheck);

    // Try to create a simple test table
    console.log('Testing CREATE TABLE permissions...');
    try {
      await sql`CREATE TABLE IF NOT EXISTS test_permissions (id SERIAL PRIMARY KEY)`;
      console.log('✅ CREATE TABLE permission granted');
      await sql`DROP TABLE IF EXISTS test_permissions`;
      console.log('✅ DROP TABLE permission granted');
    } catch (error: any) {
      console.log('❌ No CREATE TABLE permission:', error.message);
      console.log('Error code:', error.code);
    }

  } catch (error) {
    console.error('Database check failed:', error);
  }
}

checkDatabase();