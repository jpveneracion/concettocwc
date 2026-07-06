# Fix Email Authentication with Encryption

## Problem
Login searches by plaintext `email`, but PII encryption deletes plaintext emails, making authentication impossible.

## Solution
Add searchable `email_hash` column for authentication while keeping `email_encrypted` for secure data.

## Implementation Steps

### 1. Add email_hash column
```sql
ALTER TABLE users ADD COLUMN email_hash TEXT;
CREATE INDEX users_email_hash_idx ON users(email_hash);
```

### 2. Update signup to include email_hash
```typescript
import crypto from 'crypto';

function hashEmailForSearch(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}
```

### 3. Update login to search by hash
```typescript
const emailHash = hashEmailForSearch(email);
const users = await sql`
  SELECT * FROM users WHERE email_hash = ${emailHash}
`;
```

### 4. Restore existing encrypted emails
- Decrypt email_encrypted 
- Recreate email_hash
- Verify authentication works