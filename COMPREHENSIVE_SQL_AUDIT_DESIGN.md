# Comprehensive SQL Operations Audit Design

**Date:** 2026-08-01  
**Project:** Concetto Window Coverings - Multi-tenant RLS Migration  
**Scope:** Complete inventory of every SQL operation affected by Row-Level Security

## Problem Statement

The application has implemented PostgreSQL Row-Level Security (RLS) across multiple tables to achieve multi-tenant data isolation. However, direct SQL operations throughout the codebase are now breaking because they don't bypass RLS policies appropriately. Every SELECT, INSERT, UPDATE, DELETE, and UPSERT operation needs to be audited and categorized by RLS impact.

## Design Goals

1. **Completeness**: Zero SQL queries left unchecked - comprehensive audit of entire codebase
2. **Accuracy**: Precise identification of which operations break due to RLS
3. **Actionability**: Clear categorization and fix recommendations for each operation
4. **Type Safety**: Use TypeScript types throughout the analysis
5. **Mobile-First**: Optimize documentation for easy reading on mobile devices

## Architecture

### Phase 1: Discovery (Ultra-Comprehensive Scan)

**Search Patterns:**
- Grep for all SQL query patterns: `SELECT|INSERT|UPDATE|DELETE|UPSERT`
- Find all database client usage: `sql()`, `query()`, `querySQL()`, `queryWithRLSBypass()`
- Locate template literal SQL strings
- Scan all `.ts` and `.tsx` files
- Include migration files and SECURITY DEFINER functions

**Files to Scan:**
- `src/**/*.ts` (all TypeScript files)
- `src/**/*.tsx` (React components with SQL)
- `migrations/*.sql` (migration files)
- `src/lib/db.ts` (database utility functions)
- All API route handlers

**Detection Methods:**
1. String pattern matching for SQL keywords
2. AST analysis for database function calls
3. Template literal detection
4. Dynamic query building identification

### Phase 2: Categorization

**Risk Levels:**
- 🔴 **BROKEN**: Direct SQL on RLS-enabled tables (requires SECURITY DEFINER function)
- 🟡 **RISKY**: Operations with mixed RLS context or ambiguous table access
- 🟢 **SAFE**: Operations that properly handle RLS or use SECURITY DEFINER functions

**Operation Types:**
- SELECT queries (reads)
- INSERT operations (creates)
- UPDATE operations (modifications)
- DELETE operations (removals)
- UPSERT/ON CONFLICT operations (create-or-update)

**RLS Impact Analysis:**
For each operation, determine:
- Which tables are accessed
- Whether each table has RLS enabled
- Current RLS policy conditions
- If SECURITY DEFINER functions exist
- If operation bypasses RLS correctly

### Phase 3: Documentation Structure

```
COMPREHENSIVE_DATABASE_OPERATIONS_AUDIT.md
├── Executive Summary
│   ├── Total operations count
│   ├── Breakdown by operation type
│   ├── Breakdown by risk level
│   └── Critical issues requiring immediate attention
├── Operations by Category
│   ├── SELECT Operations (with RLS impact)
│   ├── INSERT Operations (with RLS impact)
│   ├── UPDATE Operations (with RLS impact)
│   ├── DELETE Operations (with RLS impact)
│   └── UPSERT/ON CONFLICT Operations (with RLS impact)
├── File-by-File Breakdown
│   ├── Each source file
│   │   ├── Operations in file
│   │   ├── Risk assessment per operation
│   │   └── Recommended fixes
├── Table-by-Table Analysis
│   ├── Each database table
│   │   ├── RLS status
│   │   ├── Operations affecting table
│   │   ├── Required SECURITY DEFINER functions
│   │   └── Migration priority
├── SECURITY DEFINER Function Requirements
│   ├── Functions needed (by table)
│   ├── Function signatures
│   ├── Implementation templates
│   └── Usage examples
└── Migration Plan
    ├── Phase 1: Critical operations (user-facing)
    ├── Phase 2: Admin operations
    ├── Phase 3: Background operations
    └── Phase 4: Edge cases and cleanup
```

### Phase 4: TypeScript Integration

**Type System:**
```typescript
// Operation classification
interface SQLOperation {
  id: string;
  file: string;
  line: number;
  operationType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  query: string;
  tables: string[];
  riskLevel: 'BROKEN' | 'RISKY' | 'SAFE';
  rlsImpact: RLSImpact[];
  recommendedFix: FixRecommendation;
}

interface RLSImpact {
  table: string;
  hasRLS: boolean;
  policyBypassed: boolean;
  securityFunctionExists: boolean;
}

interface FixRecommendation {
  type: 'CREATE_SECURITY_FUNCTION' | 'USE_EXISTING_FUNCTION' | 'ADD_RLS_CONTEXT' | 'NO_ACTION';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  implementation: string;
}
```

### Phase 5: Mobile-First Documentation

**Optimization Strategy:**
- Clear hierarchy with emoji indicators for quick scanning
- Concise descriptions (under 200 words per section)
- Progressive disclosure - summary first, details on demand
- Touch-friendly table layouts
- Quick-reference cards for critical information
- Color-coded risk levels (🔴🟡🟢)

## Implementation Steps (Bite-Sized, Test-Driven)

### Step 1: Scan Single API Route File
**File**: `src/app/api/login/route.ts`
**Action**: Use Grep tool to find all SQL operations
**Expected Result**: Array of SQL operation patterns found
**Test Criteria**:
- ✅ PASS: Returns array (can be empty if no SQL found)
- ❌ FAIL: Grep tool errors or crashes
**Success**: Update progress → "Step 1: ✅ COMPLETE - login/route.ts scanned"

### Step 2: Analyze Operations from Step 1
**Input**: SQL operations found in login route
**Action**: Parse each query, identify tables and operation types
**Expected Result**: List of affected tables and operation categories
**Test Criteria**:
- ✅ PASS: Returns structured analysis (can be empty if no operations)
- ❌ FAIL: Parsing errors or timeout
**Success**: Update progress → "Step 2: ✅ COMPLETE - login operations analyzed"

### Step 3: Check RLS Status for Tables from Step 2
**Input**: Table names from login route analysis
**Action**: Cross-reference with migration files to determine RLS status
**Expected Result**: RLS status for each affected table
**Test Criteria**:
- ✅ PASS: Returns RLS status for all tables (can be "NO RLS" for all)
- ❌ FAIL: Missing table information or migration parse errors
**Success**: Update progress → "Step 3: ✅ COMPLETE - RLS status checked"

### Step 4: Determine Risk Level for Login Operations
**Input**: Operations + RLS status from previous steps
**Action**: Calculate risk level (🔴🟡🟢) for each operation
**Expected Result**: Risk categorization for each SQL operation
**Test Criteria**:
- ✅ PASS: Returns risk assessment (can be all 🟢 if no issues)
- ❌ FAIL: Risk calculation logic errors
**Success**: Update progress → "Step 4: ✅ COMPLETE - Risk levels determined"

### Step 5: Generate Fix Recommendations for Login Route
**Input**: Risk assessments from Step 4
**Action**: Create SECURITY DEFINER function requirements
**Expected Result**: List of required fixes and function signatures
**Test Criteria**:
- ✅ PASS: Returns fix recommendations (can be empty list if no fixes needed)
- ❌ FAIL: Recommendation generation errors
**Success**: Update progress → "Step 5: ✅ COMPLETE - Fix recommendations generated"

### Step 6: Write Login Route Section to Audit Document
**Input**: All analysis results from Steps 1-5
**Action**: Append formatted section to audit document
**Expected Result**: Audit document updated with login route analysis
**Test Criteria**:
- ✅ PASS: Document file updated, section exists
- ❌ FAIL: File write errors or missing sections
**Success**: Update progress → "Step 6: ✅ COMPLETE - Login section documented"

### Steps 7-12: Repeat for Each API Route File
**Pattern**: Same 6-step process for:
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/products/route.ts`
- `src/app/api/quotes/route.ts`
- (Continue for all API routes)

### Steps 13-18: Scan and Analyze Library Functions
**Pattern**: Same 6-step process for:
- `src/lib/db.ts`
- `src/lib/subscription-activation.ts`
- `src/lib/payment-verification.ts`
- (Continue for all library files)

### Steps 19-24: Scan Migration Files
**Pattern**: Same 6-step process for:
- `migrations/013_enable_rls_foundation.sql`
- `migrations/014_enable_rls_quotes.sql`
- (Continue for all RLS migrations)

### Step 25: Generate Executive Summary
**Input**: All completed sections from previous steps
**Action**: Calculate totals, create summary statistics
**Expected Result**: Summary with operation counts, risk breakdown, critical issues
**Test Criteria**:
- ✅ PASS: Summary section created with valid statistics
- ❌ FAIL: Calculation errors or missing data
**Success**: Update progress → "Step 25: ✅ COMPLETE - Executive summary generated"

### Step 26: Final Document Validation
**Action**: Read completed audit document, validate structure
**Expected Result**: Valid, complete audit document
**Test Criteria**:
- ✅ PASS: Document exists, has all required sections, non-zero file size
- ❌ FAIL: Missing sections or corrupt document
**Success**: Update progress → "Step 26: ✅ COMPLETE - Audit document finalized"

## Progress Tracking

**Live Progress Document**: `SQL_AUDIT_PROGRESS.md`
- Updates after each successful step
- Shows completed vs remaining steps
- Contains test results and success metrics
- Tracks any failures or retries needed

**Final Output**: `COMPREHENSIVE_DATABASE_OPERATIONS_AUDIT.md`

## Success Criteria

✅ **Completeness**: Every SQL operation in the codebase is documented  
✅ **Accuracy**: RLS impact correctly assessed for each operation  
✅ **Actionability**: Clear fix recommendations provided  
✅ **Type Safety**: All TypeScript types properly defined  
✅ **Mobile-Friendly**: Documentation optimized for mobile reading  

## Security Considerations

**RLS Bypass Safety:**
- Only create SECURITY DEFINER functions where absolutely necessary
- Functions must include proper authorization checks
- No privilege escalation in SECURITY DEFINER functions
- Audit all SECURITY DEFINER function implementations

**Data Isolation:**
- Ensure multi-tenant separation is maintained
- No cross-company data leakage
- Proper context setting for all operations

## Risk Assessment

**High-Risk Areas:**
1. User authentication and session management
2. Quote and order operations  
3. Payment verification processing
4. Company product management
5. Admin operations across companies

**Medium-Risk Areas:**
1. Subscription management
2. Pricing operations
3. Webhook processing
4. Gateway device communication

**Low-Risk Areas:**
1. Read-only reference data
2. System configuration
3. Logging and monitoring

## Timeline Estimate

- **Discovery Phase**: 2-3 hours (parallel agent processing)
- **Analysis Phase**: 1-2 hours (RLS cross-reference)
- **Documentation Phase**: 1-2 hours (document generation)
- **Validation Phase**: 30 minutes - 1 hour (cross-check)

**Total**: 4-8 hours for complete audit

## Post-Audit Actions

After the audit document is created:
1. Review broken operations by priority
2. Create SECURITY DEFINER functions for critical tables
3. Migrate operations to use security functions
4. Test multi-tenant isolation
5. Deploy RLS fixes incrementally