# Encryption Verification & Plaintext Deletion Design

**Date**: 2026-07-01
**Scope**: Add verification and automatic plaintext deletion to PII encryption migration

## Problem Statement

The current `/api/encrypt-quotes` endpoint encrypts PII data but:
1. Does NOT verify encryption worked correctly
2. Does NOT delete plaintext columns after encryption
3. No endpoint exists for encrypting users table

## Requirements

Per user requirements:
1. **Comprehensive verification**: Decrypt ALL encrypted records and verify every single one matches the original
2. **Immediate deletion**: Delete plaintext columns in the same API call after successful verification
3. **Both tables**: Apply to both `quotes` and `users` tables

## Architecture

### Encryption + Verification + Deletion Flow

```
POST /api/encrypt-quotes
POST /api/encrypt-users (NEW)
```

**Process:**
1. Fetch records where plaintext is not null and encrypted is null
2. For each record:
   - Encrypt plaintext fields
   - UPDATE with encrypted values
   - Decrypt and verify against original
   - If verification fails → log error, continue
3. If ALL verifications pass:
   - DELETE plaintext columns (SET to NULL)
4. Return: { encrypted, verified, deleted, errors[] }

### Safety Guarantees

**Per-record validation**:
- If ANY record fails verification → log it, continue processing
- If ANY verification fails → DO NOT delete plaintext columns (abort deletion)
- Return detailed error list with record IDs

**Transaction safety**:
- All operations in a single try-catch block
- Verification failures prevent deletion phase
- Detailed error reporting for debugging

## Implementation

### Files to Create

**1. src/app/api/encrypt-users/route.ts** (NEW)
```typescript
POST /api/encrypt-users
- Fetch unencrypted users (email/name not null, encrypted is null)
- Encrypt email_encrypted, name_encrypted
- Verify each record via decrypt+compare
- If all verified: SET email=NULL, name=NULL
- Return: { success, encrypted, verified, deleted, errors[] }
```

### Files to Modify

**2. src/app/api/encrypt-quotes/route.ts**
Add verification + deletion logic:
```typescript
// After encrypting each quote:
const nameDecrypted = decryptPII(nameEncrypted);
const addressDecrypted = decryptPII(addressEncrypted);

if (nameDecrypted !== quote.customer_name || addressDecrypted !== quote.customer_address) {
  errors.push(`Quote ${quote.id}: verification failed`);
  continue; // Skip this record, don't delete
}
verified++;

// After ALL records verified:
if (errors.length === 0) {
  await sql`UPDATE quotes SET customer_name=NULL, customer_address=NULL WHERE id IN (${quoteIds})`;
}
```

**3. src/app/api/dashboard/route.ts** (BUILD RULE COMPLIANCE)
Fix `getTopCustomers()` to handle deleted plaintext columns:
```typescript
// SQL: GROUP BY encrypted column
GROUP BY customer_name_encrypted

// JavaScript: Decrypt after aggregation
customerName: row.customer_name_encrypted
  ? decryptPII(row.customer_name_encrypted)
  : 'Unknown'
```

**4. src/app/api/quotes/[id]/route.ts** (BUG FIX)
Fix typo on line 173:
```typescript
// Wrong:
customer_address: quote.address_encrypted

// Correct:
customer_address: quote.customer_address_encrypted
```

**5. src/components/EncryptionModal.tsx**
Add phase-based messaging:
```typescript
interface EncryptionModalProps {
  show: boolean;
  message?: string;
  phase?: 'encrypting' | 'verifying' | 'deleting' | 'complete';
}
```

**6. src/app/dashboard/page.tsx**
Call both endpoints:
```typescript
await encryptQuotes();  // Existing
await encryptUsers();    // New
Update modal phase state for each step
```

## Data Flow

**UI → API → Database:**
1. Dashboard calls `/api/encrypt-quotes`
2. Modal shows: "Encrypting sensitive data..."
3. Backend encrypts, verifies, deletes
4. Modal shows: "Verification complete ✓"
5. Dashboard calls `/api/encrypt-users`
6. Modal shows: "Encrypting user data..."
7. Backend encrypts, verifies, deletes
8. Modal shows: "Encryption complete ✓"

**Database → API → UI:**
1. SQL queries use encrypted columns (`customer_name_encrypted`)
2. API decrypts in JavaScript before responding
3. Frontend receives plaintext data
4. UI displays readable data to users

## Response Format

```typescript
{
  success: boolean,
  encrypted: number,      // Records encrypted
  verified: number,       // Records verified
  deleted: number,        // Records deleted (plaintext)
  errors: Array<{
    recordId: string,
    field: string,
    message: string
  }>
}
```

## Testing Strategy

1. **Manual test**: Add quote via POST `/api/quotes`, verify encrypted columns populated, plaintext is NULL, GET returns decrypted data

2. **Migration test**: Temporarily add plaintext-only records, run encryption endpoint, verify results

3. **Error case test**: Manually corrupt encrypted value, verify detection works

4. **Build check**: Run `npm run build` to ensure no TypeScript errors

## Build Rules Compliance

✓ **Rule #17**: Audit ALL clients before committing - fixed dashboard API and quotes/[id] bug in same commit
✓ **Rule #18**: Verify functions exist before using - confirmed `encryptPII()` and `decryptPII()` in crypto.ts
✓ **Run build locally**: Will verify before committing
