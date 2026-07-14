// Debug script to check user permissions in database
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function debugUsers() {
  try {
    console.log('🔍 DEBUG: Checking users and roles...');

    // Get all users with their roles
    const users = await sql`
      SELECT id, email, role, is_admin, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log('\n📋 Recent Users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role || 'NULL'}`);
      console.log(`   Is Admin: ${user.is_admin || 'NULL'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });

    // Check if any users have admin roles
    const admins = await sql`
      SELECT id, email, role, is_admin
      FROM users
      WHERE role IN ('admin', 'superadmin') OR is_admin = true
    `;

    console.log(`👑 Admin users found: ${admins.length}`);
    admins.forEach((admin) => {
      console.log(`- ${admin.email} (${admin.role}, is_admin: ${admin.is_admin})`);
    });

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugUsers();