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

## Implementation Steps

### Step 1: Base Scan (Agent-based)
Launch multiple parallel agents to search for SQL operations:
- Agent 1: Scan all `.ts` files in `src/app/api/`
- Agent 2: Scan all `.ts` files in `src/lib/`
- Agent 3: Scan remaining source files
- Agent 4: Scan migration files
- Agent 5: Cross-reference with RLS policy files

### Step 2: Analysis Pipeline
For each discovered operation:
1. Parse SQL query structure
2. Identify affected tables
3. Check RLS status for each table
4. Determine if SECURITY DEFINER function exists
5. Calculate risk level
6. Generate fix recommendation

### Step 3: Document Generation
Create the comprehensive audit document with:
- Executive summary with key metrics
- Categorized operation listings
- File-by-file breakdowns
- Table-by-table analysis
- SECURITY DEFINER function requirements
- Prioritized migration plan

### Step 4: Validation
Cross-check the audit:
- Verify no operations were missed
- Validate RLS impact assessments
- Confirm fix recommendations are accurate
- Test critical operations manually if needed

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