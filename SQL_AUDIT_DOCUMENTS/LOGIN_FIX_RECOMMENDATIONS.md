# Login Route Fix Recommendations

**Generated:** 2026-08-01  
**Status:** 🚨 CRITICAL SECURITY FIXES REQUIRED  
**Step:** 5/26 - Generate fix recommendations for login

## Executive Summary

**CRITICAL SECURITY ISSUES FOUND:** 4 vulnerabilities requiring immediate fixes

Based on the comprehensive code verification in Step 3, the login route analysis revealed that while RLS policies are properly configured, the SECURITY DEFINER functions that bypass RLS have critical authorization vulnerabilities that completely undermine the RLS protection.

## Critical Vulnerabilities

### 🔴 CRITICAL: `find_user_by_email_hash` Function
**File:** Migration 047  
**Severity:** CRITICAL - Account Takeover Risk  
**Issue:** Returns password_hash without any authorization checks  
**Impact:** Anyone can call this function to retrieve password hashes for any user  
**Attack Vector:** Direct password hash exposure for credential theft or offline cracking  

**Current Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_email_hash(p_email_hash TEXT)
RETURNS TABLE (
  id UUID,
  email_hash TEXT,
  password_hash TEXT,  -- ❌ EXPOSED WITHOUT AUTHORIZATION
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- ❌ NO authorization checks
  SELECT * FROM users WHERE email_hash = p_email_hash;
$$;
```

**Recommended Fix:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_email_hash(p_email_hash TEXT)
RETURNS TABLE (
  id UUID,
  email_hash TEXT,
  password_hash TEXT,  -- ✅ PROTECTED BY ROLE CHECK
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- ✅ ADD role context validation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for this operation';
  END IF;
  
  -- ✅ ADD ownership verification for non-superadmin roles
  IF current_setting('app.role', true) != 'superadmin' THEN
    -- Additional ownership checks if needed
    RAISE EXCEPTION 'Security: Unauthorized access to user data';
  END IF;
  
  SELECT * FROM users WHERE email_hash = p_email_hash;
$$;
```

**Migration File:** `migrations/050_fix_find_user_by_email_hash_security.sql`

---

### 🔴 CRITICAL: `find_user_by_id` Function
**File:** Migration 047  
**Severity:** CRITICAL - Systematic Credential Theft  
**Issue:** Returns password_hash without any authorization checks  
**Impact:** Anyone can call with any UUID to get password hashes  
**Attack Vector:** Systematic password hash enumeration using UUID guessing  

**Current Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  password_hash TEXT,  -- ❌ EXPOSED WITHOUT AUTHORIZATION
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- ❌ NO authorization checks
  SELECT * FROM users WHERE id = p_user_id;
$$;
```

**Recommended Fix:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  password_hash TEXT,  -- ✅ PROTECTED BY ROLE CHECK
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- ✅ ADD role context validation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for this operation';
  END IF;
  
  -- ✅ ADD ownership verification for non-superadmin roles
  IF current_setting('app.role', true) != 'superadmin' THEN
    -- Users can only access their own data
    IF current_setting('app.user_id', true) != p_user_id::text THEN
      RAISE EXCEPTION 'Security: Unauthorized access to user data';
    END IF;
  END IF;
  
  SELECT * FROM users WHERE id = p_user_id;
$$;
```

**Migration File:** `migrations/051_fix_find_user_by_id_security.sql`

---

### 🔴 CRITICAL: `find_user_by_email` Function
**File:** Migration 047  
**Severity:** CRITICAL - User Enumeration + Credential Exposure  
**Issue:** Returns password_hash and allows email enumeration without authorization  
**Impact:** User reconnaissance and password hash exposure  
**Attack Vector:** User email enumeration and credential exposure  

**Current Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  password_hash TEXT,  -- ❌ EXPOSED WITHOUT AUTHORIZATION
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- ❌ NO authorization checks
  SELECT * FROM users WHERE email = p_email;
$$;
```

**Recommended Fix:**
```sql
CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  password_hash TEXT,  -- ✅ PROTECTED BY ROLE CHECK
  -- ... other fields
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- ✅ ADD role context validation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for this operation';
  END IF;
  
  -- ✅ ADD ownership verification for non-superadmin roles
  IF current_setting('app.role', true) != 'superadmin' THEN
    -- Users can only lookup their own email
    IF current_setting('app.user_email', true) != p_email THEN
      RAISE EXCEPTION 'Security: Unauthorized email lookup';
    END IF;
  END IF;
  
  SELECT * FROM users WHERE email = p_email;
$$;
```

**Migration File:** `migrations/052_fix_find_user_by_email_security.sql`

---

### 🔴 CRITICAL: `update_user_email_hash` Function
**File:** Migration 047  
**Severity:** CRITICAL - Direct Account Takeover  
**Issue:** UPDATE function with no authorization checks  
**Impact:** Anyone can change any user's email_hash, breaking authentication or hijacking accounts  
**Attack Vector:** Direct account takeover by changing email hashes  

**Current Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION update_user_email_hash(p_user_id UUID, p_email_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- ❌ NO authorization or ownership checks
  UPDATE users SET email_hash = p_email_hash WHERE id = p_user_id;
  RETURN true;
$$;
```

**Recommended Fix:**
```sql
CREATE OR REPLACE FUNCTION update_user_email_hash(p_user_id UUID, p_email_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- ✅ ADD role context validation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for this operation';
  END IF;
  
  -- ✅ ADD strict ownership verification
  IF current_setting('app.role', true) != 'superadmin' THEN
    -- Users can only update their own email_hash
    IF current_setting('app.user_id', true) != p_user_id::text THEN
      RAISE EXCEPTION 'Security: Unauthorized email_hash modification';
    END IF;
  END IF;
  
  UPDATE users SET email_hash = p_email_hash WHERE id = p_user_id;
  RETURN true;
$$;
```

**Migration File:** `migrations/053_fix_update_user_email_hash_security.sql`

---

## Additional Security Concerns

### 🟡 MEDIUM: `get_user_admin_status` Function
**Severity:** MEDIUM - Privilege Reconnaissance  
**Issue:** Exposes admin status without authorization  
**Impact:** Privilege reconnaissance for targeted attacks  
**Attack Vector:** Admin user enumeration for privilege escalation attempts  

**Recommended Fix:** Add role context validation and restrict to superadmin only access.

**Migration File:** `migrations/054_fix_get_user_admin_status_security.sql`

---

### 🟡 MEDIUM: `mark_reset_token_used` Function  
**Severity:** MEDIUM - Denial of Service  
**Issue:** UPDATE function without authorization checks  
**Impact:** Anyone could mark tokens as used, blocking legitimate password resets  
**Attack Vector:** Denial of service against password reset functionality  

**Recommended Fix:** Add role context validation and ownership verification for token access.

**Migration File:** `migrations/055_fix_mark_reset_token_used_security.sql`

---

## Implementation Priority

### 🔴 CRITICAL (Fix Immediately - Account Takeover Risk)
1. **`find_user_by_email_hash`** - Password hash exposure without authorization
2. **`find_user_by_id`** - Systematic password hash enumeration  
3. **`find_user_by_email`** - User enumeration + credential exposure
4. **`update_user_email_hash`** - Direct account takeover capability

### 🟡 HIGH (Fix Soon - Security Hardening)
5. **`get_user_admin_status`** - Privilege reconnaissance prevention
6. **`mark_reset_token_used`** - Denial of service prevention

### ✅ VERIFIED SAFE (No Changes Needed)
7. **`check_company_has_pricing`** - Simple boolean check with proper security
8. **`validate_reset_token`** - Properly designed with expiration checking

---

## Root Cause Analysis

**Migration Gap Issue:** The SECURITY DEFINER functions in migration 047 are missing critical role context validation that was properly implemented in migration 046. This suggests:

- Migration 046 functions (with security) were overwritten by migration 047 functions (without security)
- OR migration 047 was created without inheriting the security controls from 046  
- Currently deployed version needs verification to determine which functions are active

## Deployment Strategy

### Phase 1: Verification (CRITICAL - Do First)
```sql
-- Check which version is currently deployed
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%user%'
AND security_definer = 'YES';
```

### Phase 2: Security Fixes (Apply in Order)
1. **Create migration 050:** Fix `find_user_by_email_hash`
2. **Create migration 051:** Fix `find_user_by_id`  
3. **Create migration 052:** Fix `find_user_by_email`
4. **Create migration 053:** Fix `update_user_email_hash`
5. **Create migration 054:** Fix `get_user_admin_status`
6. **Create migration 055:** Fix `mark_reset_token_used`

### Phase 3: Testing
```sql
-- Test that unauthorized access is blocked
SELECT test_unauthorized_access();
SELECT test_password_hash_protection();
SELECT test_account_takeover_prevention();
```

---

## Security Impact Assessment

### Before Fixes - 🚨 CRITICAL VULNERABLE
- ❌ Password hashes exposed to unauthorized callers
- ❌ User enumeration possible without authentication
- ❌ Direct account takeover via email_hash modification
- ❌ Admin privilege reconnaissance enabled
- ❌ Denial of service against password resets

### After Fixes - ✅ SECURE
- ✅ All functions require valid role context
- ✅ Password hashes protected by authorization checks
- ✅ User enumeration prevented
- ✅ Account takeover prevented by ownership verification
- ✅ Admin status protected
- ✅ Token operations properly secured

---

## Testing Requirements

### Security Tests (Must Pass)
```typescript
describe('Login Security Function Tests', () => {
  test('should prevent unauthorized password hash access', async () => {
    // Test that non-authenticated users cannot access password hashes
    const result = await sql`SELECT find_user_by_email_hash('test')`;
    expect(result.error).toContain('Security: No role context');
  });

  test('should prevent systematic UUID enumeration', async () => {
    // Test that UUID guessing doesn't expose password hashes
    const randomUUID = '00000000-0000-0000-0000-000000000000';
    const result = await sql`SELECT find_user_by_id(${randomUUID})`;
    expect(result.error).toContain('Security: Unauthorized');
  });

  test('should prevent account takeover via email_hash modification', async () => {
    // Test that users cannot modify other users' email_hash
    const result = await sql`SELECT update_user_email_hash(otherUserId, 'hacked')`;
    expect(result.error).toContain('Security: Unauthorized');
  });

  test('should prevent admin user enumeration', async () => {
    // Test that admin status cannot be queried without authorization
    const result = await sql`SELECT get_user_admin_status(userId)`;
    expect(result.error).toContain('Security: Unauthorized');
  });
});
```

---

## Verification Checklist

- [ ] **Migration 046 vs 047 comparison completed** - Determine which version is deployed
- [ ] **Migration 050 created** - `find_user_by_email_hash` security fix
- [ ] **Migration 051 created** - `find_user_by_id` security fix
- [ ] **Migration 052 created** - `find_user_by_email` security fix
- [ ] **Migration 053 created** - `update_user_email_hash` security fix
- [ ] **Migration 054 created** - `get_user_admin_status` security fix
- [ ] **Migration 055 created** - `mark_reset_token_used` security fix
- [ ] **All security tests pass** - Authorization checks working correctly
- [ ] **Production deployment verification** - Confirm fixes are active
- [ ] **Regression testing** - Login functionality still works correctly

---

## Success Criteria

✅ **All 6 SECURITY DEFINER function vulnerabilities fixed**  
✅ **Role context validation added to all functions**  
✅ **Password hash exposure eliminated**  
✅ **Account takeover vectors closed**  
✅ **User enumeration prevented**  
✅ **Admin privilege reconnaissance blocked**  
✅ **Zero RLS violation pathway maintained**  

**Status:** 🚨 CRITICAL SECURITY FIXES REQUIRED BEFORE PROCEEDING WITH REST OF AUDIT