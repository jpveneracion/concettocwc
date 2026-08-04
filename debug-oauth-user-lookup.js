// Debug script to understand why user lookup is failing in OAuth flow

const testEmail = 'jpveneracion@gmail.com';

// Recreate the hashEmail function
function hashEmail(email) {
  const normalized = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16) + normalized.length.toString(16);
}

console.log('🔍 Debugging OAuth user lookup issue:');
console.log('Email:', testEmail);
console.log('Email hash:', hashEmail(testEmail));
console.log('');

// Check what queries would be run
console.log('Expected SQL query:');
console.log(`SELECT id, email, email_hash, password_hash, company_id, role FROM users WHERE email_hash = '${hashEmail(testEmail)}'`);
console.log('');

// Possible issues:
console.log('Possible reasons for user lookup failure:');
console.log('1. RLS policies blocking the read');
console.log('2. Email hash mismatch in database');
console.log('3. User stored with different email format');
console.log('4. User was not properly created in previous attempt');
console.log('5. Database connection issue during OAuth flow');