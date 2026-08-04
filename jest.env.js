// Load environment variables for Jest tests
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local first (has priority), then fallback to .env
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env')
];

for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed) {
      console.log(`✅ Loaded environment variables from ${path.basename(envPath)}`);
    }
  } catch (error) {
    // File doesn't exist or can't be read, try next one
    continue;
  }
}

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set in .env or .env.local files');
} else {
  console.log('✅ DATABASE_URL is configured');
}