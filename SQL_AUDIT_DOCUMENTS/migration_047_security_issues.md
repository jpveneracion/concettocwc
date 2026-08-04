# Migration 047 Security Issues (Working Version)

**File:** `migrations/047_create_comprehensive_security_definer_functions.sql`  
**Status:** ✅ WORKING CODE - Compiles and runs successfully  
**Security Issues:** 🔴 CRITICAL VULNERABILITIES DOCUMENTED BELOW

## Security Vulnerabilities (Code Works, But Insecure)

### 🔴 CRITICAL: `find_user_by_email_hash` (Line 57)
**Issue:** Returns `password_hash` without any authorization checks
**Impact:** Anyone can call this function to retrieve password hashes
**Attack Vector:** Direct password hash exposure for credential theft

**Current Code (WORKING but insecure):**
```sql
CREATE FUNCTION find_user_by_email_hash(p_email_hash text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      u.id as user_id,
      u.email,
      u.email_hash,
      u.password_hash,  -- ❌ EXPOSED WITHOUT AUTHORIZATION
      u.company_id,
      c.code as company_code
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.email_hash = p_email_hash
  ) t
$$;
```

### 🔴 CRITICAL: `find_user_by_id` (Line 80)
**Issue:** Returns `password_hash` without authorization checks
**Impact:** Systematic password hash enumeration via UUID guessing

### 🔴 CRITICAL: `find_user_by_email` (Line 107)  
**Issue:** Returns `password_hash` and allows email enumeration
**Impact:** User reconnaissance plus credential exposure

### 🔴 CRITICAL: `update_user_email_hash` (Line 153)
**Issue:** UPDATE function without ownership verification
**Impact:** Account takeover by changing email hashes

### 🔴 CRITICAL: `update_user_password` (Line 164)
**Issue:** UPDATE function without ownership verification  
**Impact:** Direct password modification capability

### 🔴 CRITICAL: `mark_reset_token_used` (Line 219)
**Issue:** UPDATE function without authorization checks
**Impact:** Denial of service against password resets

## Correct Approach Going Forward

**Current Status:** This migration works but is insecure.

**Next Steps:** 
1. Document security issues without breaking working code ✅ DOING THIS NOW
2. Create proper security fixes that actually compile and work
3. Test all SQL before deploying
4. Verify functionality before claiming "fixed"

**Working Code Principle:** Working insecure code > broken "secure" code

## Security Assessment

**Functionality:** ✅ WORKING - Compiles and runs  
**Security:** 🔴 CRITICAL VULNERABLE - Multiple attack vectors  
**Priority:** HIGH - Security fixes needed without breaking functionality