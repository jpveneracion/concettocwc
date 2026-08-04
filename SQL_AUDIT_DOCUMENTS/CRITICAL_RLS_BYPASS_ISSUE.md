# CRITICAL SECURITY ISSUE: RLS Bypass Function

**Discovered:** 2026-08-01 during Phase 2 Library Functions audit  
**Severity:** 🔴 CRITICAL - Complete RLS bypass capability  
**Location:** `src/lib/db.ts:1631` - `queryWithRLSBypass` function

## Vulnerability Details

**Function Signature:**
```typescript
export async function queryWithRLSBypass<T extends QueryResultRow = Record<string, unknown>>(
  sqlQuery: string,
  params: QueryParams[] = []
): Promise<T[]>
```

**Critical Issue:**
```typescript
// Temporarily disable RLS for this transaction
await client.query('SET LOCAL row_security = off');
```

## Attack Scenarios

**1. Complete Data Access:**
- Anyone with access to call this function can bypass ALL RLS policies
- Can read data from any company/tenant
- Can modify data across tenant boundaries

**2. Authorization Bypass:**
- No role context validation before RLS bypass
- No ownership verification
- No audit trail of RLS bypass operations

**3. Data Exfiltration:**
- Systematic data extraction from all tenants
- Cross-company data leakage
- Privacy violation potential

## Risk Assessment

**Current Risk Level:** 🔴 **CRITICAL**

**Impact:** 
- ❌ Complete RLS system bypass
- ❌ Multi-tenant data isolation broken
- ❌ Zero RLS violations goal undermined
- ❌ Cross-company data access possible

**Attack Vector:** 
- Any code that can call `queryWithRLSBypass` can bypass all security
- No authorization checks before disabling RLS
- No audit logging of bypass operations

## Required Fixes

**Priority 1 - CRITICAL:**
1. **Add role context validation** - Only allow superadmin to use this function
2. **Add authorization checks** - Verify caller has legitimate RLS bypass need
3. **Add audit logging** - Log all RLS bypass operations with caller context
4. **Add usage monitoring** - Track and alert on RLS bypass usage patterns

**Priority 2 - HIGH:**
5. **Consider alternatives** - Use SECURITY DEFINER functions instead of RLS bypass
6. **Add rate limiting** - Prevent systematic data extraction
7. **Add caller tracking** - Log which code/paths are calling this function

## Immediate Actions Required

**🚨 CRITICAL:** This function represents a complete bypass of your RLS security system and must be secured immediately.

**Current Status:** Documented in audit, requires immediate security fixes