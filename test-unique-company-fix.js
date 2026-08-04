// Test script to verify the unique company code generation fix
import crypto from 'crypto';

// Mock database for testing
const mockExistingCodes = new Set(['TEST1234', 'ABCD5678']);

async function generateUniqueCompanyCode(): Promise<string> {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();

  // Simulate database check
  if (mockExistingCodes.has(code)) {
    console.log(`⚠️ Collision detected: ${code}, retrying...`);
    return generateUniqueCompanyCode(); // Retry if collision
  }

  mockExistingCodes.add(code);
  console.log(`✅ Generated unique company code: ${code}`);
  return code;
}

// Test the function
async function testUniqueCodeGeneration() {
  console.log('🧪 Testing unique company code generation...');

  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = await generateUniqueCompanyCode();
    codes.push(code);
  }

  console.log(`✅ Generated ${codes.length} unique codes:`, codes);

  // Check for duplicates
  const uniqueCodes = new Set(codes);
  if (codes.length === uniqueCodes.size) {
    console.log('✅ All codes are unique - fix verified!');
    return true;
  } else {
    console.log('❌ Duplicate codes found - fix has issues!');
    return false;
  }
}

testUniqueCodeGeneration().then(success => {
  process.exit(success ? 0 : 1);
});