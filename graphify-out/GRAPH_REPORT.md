# Graph Report - .  (2026-08-12)

## Corpus Check
- Large corpus: 607 files · ~402,458 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2294 nodes · 4257 edges · 250 communities (159 shown, 91 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Theme System
- Admin & Verifications
- Trial System
- Community 3
- Community 4
- Payments & Billing
- Admin & Verifications
- Onboarding Flow
- Admin & Verifications
- Admin & Verifications
- Community 10
- Community 11
- Admin & Verifications
- Community 13
- Onboarding Flow
- Payments & Billing
- Community 16
- Community 17
- API Routes
- Admin & Verifications
- Community 20
- Community 21
- API Routes
- Community 23
- UI Components
- Admin & Verifications
- API Routes
- UI Components
- API Routes
- Admin & Verifications
- API Routes
- Community 31
- Onboarding Flow
- Admin & Verifications
- Admin & Verifications
- Admin & Verifications
- Payments & Billing
- Admin & Verifications
- Admin & Verifications
- Community 39
- Community 40
- Admin & Verifications
- Admin & Verifications
- Admin & Verifications
- Onboarding Flow
- Utilities & Libs
- Admin & Verifications
- Payments & Billing
- Admin & Verifications
- UI Components
- Security & Audit
- Community 51
- Community 52
- Utilities & Libs
- Community 54
- Security & Audit
- Community 56
- Community 57
- Community 58
- Admin & Verifications
- API Routes
- Community 61
- Trial System
- API Routes
- Utilities & Libs
- Community 65
- API Routes
- Community 67
- Community 68
- Community 69
- Community 70
- Admin & Verifications
- UI Components
- Utilities & Libs
- Utilities & Libs
- Utilities & Libs
- Utilities & Libs
- Utilities & Libs
- Community 78
- Community 79
- Community 80
- Community 81
- Admin & Verifications
- Community 83
- Community 84
- Security & Audit
- Community 86
- Community 87
- Trial System
- Community 89
- Community 90
- Trial System
- Trial System
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Admin & Verifications
- Community 104
- Admin & Verifications
- Community 106
- Utilities & Libs
- Admin & Verifications
- Community 110
- Security & Audit
- Security & Audit
- Community 113
- Community 114
- Community 115
- Payments & Billing
- Admin & Verifications
- Community 118
- Security & Audit
- Security & Audit
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Security & Audit
- Community 128
- Community 129
- Onboarding Flow
- Community 131
- Admin & Verifications
- Trial System
- Utilities & Libs
- Admin & Verifications
- Community 136
- Payments & Billing
- Security & Audit
- Community 139
- Security & Audit
- Security & Audit
- Security & Audit
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Security & Audit
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Admin & Verifications
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Security & Audit
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Admin & Verifications
- UI Components
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Security & Audit
- Security & Audit
- Security & Audit
- Security & Audit
- Security & Audit
- Security & Audit
- Community 210
- Community 211
- Community 212
- Community 213
- Admin & Verifications
- Community 215
- Admin & Verifications
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Security & Audit
- Security & Audit
- Security & Audit
- Community 239
- Community 240
- Community 246
- API Routes

## God Nodes (most connected - your core abstractions)
1. `sql` - 145 edges
2. `getSession()` - 143 edges
3. `requireAdmin()` - 61 edges
4. `query()` - 49 edges
5. `setTenantContext()` - 28 edges
6. `getCurrentUserId()` - 21 edges
7. `getSubscriptionPlanById()` - 21 edges
8. `getUserTrackingState()` - 19 edges
9. `decryptPII()` - 18 edges
10. `resetTenantContext()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Admin Function Data Exposure` --semantically_similar_to--> `Password Hash Exposure`  [INFERRED] [semantically similar]
  SECURITY_FIX_COMPLETION_SUMMARY.md → COMPREHENSIVE_SECURITY_AUDIT_FINAL_REPORT.md
- `Email Authentication Encryption Solution` --semantically_similar_to--> `Password Hash Exposure`  [INFERRED] [semantically similar]
  fix-email-authentication.md → COMPREHENSIVE_SECURITY_AUDIT_FINAL_REPORT.md
- `Transaction-Scoped Context` --supports--> `Zero RLS Violations Goal`  [INFERRED]
  RLS_FIX_COMPLETION.md → COMPREHENSIVE_SQL_AUDIT_DESIGN.md
- `Step C Routes Pattern Complete` --references--> `Admin Panel Integration Architecture`  [INFERRED]
  STEP_C_COMPLETE.md → admin-panel-integration-design.md
- `Admin Panel Integration Architecture` --references--> `QR Code Pinata IPFS Integration`  [INFERRED]
  admin-panel-integration-design.md → admin-panel-integration-plan.md

## Import Cycles
- 2-file cycle: `src/components/onboarding/OnboardingControls.tsx -> src/components/onboarding/index.ts -> src/components/onboarding/OnboardingControls.tsx`
- 2-file cycle: `src/components/onboarding/index.ts -> src/components/providers/OnboardingProvider.tsx -> src/components/onboarding/index.ts`

## Hyperedges (group relationships)
- **Security Migration Pattern** — rls_violations_audit, comprehensive_security_audit, security_definer_mapping [INFERRED 0.75]
- **Audit Ecosystem** — audit_completion_summary, comprehensive_fix_report, comprehensive_security_audit, rls_violations_audit [INFERRED 0.85]
- **RLS Fix Implementation** — rls_fix_completion, security_definer_mapping, comprehensive_sql_audit_plan [INFERRED 0.80]
- **Security Fix Migration Chain** — migrations_048_fix_password_hash_exposure_security.sql, migrations_049_fix_admin_function_exposure_security.sql, migrations_050_fix_authentication_functions_security.sql, migrations_051_fix_company_data_functions_security.sql, migrations_052_fix_quote_product_functions_security.sql, migrations_053_fix_remaining_functions_security.sql [INFERRED 0.85]
- **Admin Component Integration** — src\components\admin\AdvancedPaymentSettings.tsx, src\components\admin\PromoCodeManager.tsx, src\components\admin\VerificationInterface.tsx, src\app\admin\payment-settings\route.ts, src\app\admin\promo-codes\page.tsx [INFERRED 0.85]
- **Vulnerable Authentication Functions** — find_user_by_email_hash, find_user_by_id, find_user_by_email, update_user_email_hash, get_user_admin_status, mark_reset_token_used [INFERRED 0.85]
- **Onboarding Component Family** — src\components\onboarding\OnboardingModal, src\components\onboarding\FeatureOnboardingModal, onboarding_system [INFERRED 0.85]
- **Trial Subscription Flow** — oauth_trial_flow, subscription_management, trial_activation_system, src\auth.ts, src\proxy.ts [INFERRED 0.75]

## Communities (250 total, 91 thin omitted)

### Community 0 - "Theme System"
Cohesion: 0.05
Nodes (56): DEFAULT_PREFERENCE, GET(), PUT(), buildFoucScript(), metadata, RootLayout(), OnboardingModal, OnboardingProvider (+48 more)

### Community 1 - "Admin & Verifications"
Cohesion: 0.06
Nodes (59): POST(), isValidUUID(), POST(), TODO: This function will be implemented in later tasks, sanitizeRejectionInput(), GET(), isValidUUID(), GET() (+51 more)

### Community 2 - "Trial System"
Cohesion: 0.06
Nodes (51): GET(), TrialRestrictionContext, TrialRestrictionContextType, TrialRestrictionProvider(), TrialRestrictionProviderProps, validateQuoteCreation(), createUserDateTime(), formatDateForUser() (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (41): heroContent, CtaSection(), defaultCtaProps, features, FeaturesSection(), iconMap, HeroSection(), defaultFooterProps (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (38): config, generateUniqueCompanyCode(), POST(), generateUniqueCompanyCode(), POST(), POST(), NOTE: must use the SECURITY DEFINER lookup (find_user_by_id) - a raw, hashEmailForSearch() (+30 more)

### Community 5 - "Payments & Billing"
Cohesion: 0.07
Nodes (44): GET(), PaymentRow, PlanRow, GET(), POST(), GET(), POST(), CountResult (+36 more)

### Community 6 - "Admin & Verifications"
Cohesion: 0.05
Nodes (47): Admin Function Data Exposure, API Route Security, Audit Completion Summary, Bite-Sized Test-Driven Analysis, Code Duplication Patterns, Code Quality Crisis, Comprehensive Fix Report, Comprehensive Security Audit (+39 more)

### Community 7 - "Onboarding Flow"
Cohesion: 0.06
Nodes (34): CreateOrdersOnboardingContent, CreateOrdersOnboardingModal(), CreateOrdersOnboardingModalProps, FeatureOnboardingModal(), FeatureOnboardingModalProps, allOnboardingContent, dashboardOnboarding, productsOnboarding (+26 more)

### Community 8 - "Admin & Verifications"
Cohesion: 0.06
Nodes (27): Plan, VerificationContentProps, PaymentProofData, PlanDetails, CryptoPaymentInfo(), CryptoPaymentInfoProps, paymentMethods, PaymentMethodSelector() (+19 more)

### Community 9 - "Admin & Verifications"
Cohesion: 0.09
Nodes (27): POST(), GET(), GET(), GET(), OnboardingStatusResponse, OnboardingUpdateRequest, POST(), GET() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (31): checkPricing(), { sql }, exploreDatabase(), { sql }, POST(), generateResetToken(), POST(), TODO: Send email with reset link (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (40): ActivationCode, Bytea, CompanyCollection, CompanyCreateInput, CompanyProduct, CompanyProductDefinition, CompanyUpdateInput, DatabaseEntity (+32 more)

### Community 12 - "Admin & Verifications"
Cohesion: 0.12
Nodes (29): DELETE(), GET(), POST(), PUT(), DELETE(), getActivationCodeById(), PATCH(), GET() (+21 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (23): WizardStepData, CustomerStepData, MeasurementsStepData, QuoteWizard(), QuoteWizardProps, ReviewStepData, STEP_COMPONENTS, STEP_LABELS (+15 more)

### Community 14 - "Onboarding Flow"
Cohesion: 0.19
Nodes (30): OnboardingTrigger, getUserOnboardingStatsExport(), shouldExcludeAdmin(), clearMockSession(), createMockSession(), runAllOnboardingTests(), testLocalStorageOperations(), testOnboardingFlow() (+22 more)

### Community 15 - "Payments & Billing"
Cohesion: 0.08
Nodes (18): BillingEntry, BillingHistoryPage(), formatCurrency(), formatMethod(), LoadState, CodeStatus, CompanyForm, CollectionRow (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (28): AdminSubscriptionPlanStats, CommonPlanFields, ConversionRateStats, CreateSubscriptionPlanRequest, FeatureDefinition, PlanChange, PlanDistributionStats, PlanRevenueStats (+20 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, src/__tests__ (+20 more)

### Community 18 - "API Routes"
Cohesion: 0.12
Nodes (22): GET(), getRLSContext(), GET, isValidSubscriptionPlan(), isValidUUID(), mapIntervalToSubscriptionPlan(), POST(), activateSubscriptionPlan() (+14 more)

### Community 19 - "Admin & Verifications"
Cohesion: 0.14
Nodes (23): isValidUUID(), POST(), TODO: This function will be implemented in later tasks, sanitizeAdminNotes(), POST(), deletePaymentVerification(), getUser(), RLSContext (+15 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (25): autoprefixer, caniuse-lite, jest, @jest/globals, devDependencies, autoprefixer, caniuse-lite, jest (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (25): bcrypt, html2pdf.js, ipfs-http-client, lucide-react, @neondatabase/serverless, next-auth, dependencies, bcrypt (+17 more)

### Community 22 - "API Routes"
Cohesion: 0.23
Nodes (18): POST(), POST(), DELETE(), GET(), PUT(), PATCH(), GET(), POST() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (19): CompanyProductsPage(), emptyFormState, newRow(), ProductCreationModal(), ProductCreationModalProps, sanitizeInput(), CompanyProductDefinition, CompanyProductUsage (+11 more)

### Community 24 - "UI Components"
Cohesion: 0.16
Nodes (20): ItemRow, newRow(), QuoteForm(), recompute(), AutocompleteState, AutocompleteSuggestion, CompanySettings, debounce() (+12 more)

### Community 25 - "Admin & Verifications"
Cohesion: 0.09
Nodes (22): AdminActionResult, AdminActionType, AdminActivityItem, AdminBulkOperationRequest, AdminBulkOperationResult, AdminLayoutProps, AdminNotification, AdminNotificationState (+14 more)

### Community 26 - "API Routes"
Cohesion: 0.13
Nodes (19): getCookieDomain(), hashEmailForSearch(), POST(), verifyRLSContext(), withContextRestoration(), Session, querySQL(), getCurrentCompanyId() (+11 more)

### Community 27 - "UI Components"
Cohesion: 0.17
Nodes (19): AuthGuard(), AuthGuardProps, Session, useCompanyId(), useIsAdmin(), useSession(), UseSessionReturn, DEFAULT_OPTIONS (+11 more)

### Community 28 - "API Routes"
Cohesion: 0.15
Nodes (17): POST(), GET(), buildSubscriptionDetails(), cancelSubscriptionAtPeriodEnd(), checkUserAccess(), CountResult, getSubscriptionByCompanyId(), getSubscriptionPlan() (+9 more)

### Community 29 - "Admin & Verifications"
Cohesion: 0.22
Nodes (18): buildRLSContext(), DELETE(), GET(), PUT(), buildRLSContext(), DELETE(), GET(), POST() (+10 more)

### Community 30 - "API Routes"
Cohesion: 0.16
Nodes (17): DELETE(), GET(), PUT(), GET(), POST(), companyProductCodeExists(), CompanyProductError, CompanyProductErrorImpl (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (16): emptySharedState, newRow(), ProductRow, ProductsPage(), formatCurrency(), TopCustomersTable(), TopCustomersTableProps, ResponsiveTable() (+8 more)

### Community 32 - "Onboarding Flow"
Cohesion: 0.20
Nodes (17): getCurrentUserId(), OnboardingControls(), OnboardingContext, OnboardingContextType, OnboardingProvider(), OnboardingProviderProps, useManualOnboarding(), useOnboardingContext() (+9 more)

### Community 33 - "Admin & Verifications"
Cohesion: 0.18
Nodes (15): AdminCompanyProductsPage(), AdminHeader(), AdminHeaderProps, AdminNotificationCenter(), AdminNotificationCenterProps, AdminLayoutContent(), LayoutProps, AdminNotificationContext (+7 more)

### Community 34 - "Admin & Verifications"
Cohesion: 0.17
Nodes (13): POST(), GET(), POST(), createPricingHistoryEntry(), getAllPricingConfigs(), getCurrentPricing(), invalidatePricingCache(), parseDatabaseValue() (+5 more)

### Community 35 - "Admin & Verifications"
Cohesion: 0.20
Nodes (15): GET(), GET(), POST(), cleanupRLSContext(), requireAdmin(), requireRole(), requireSuperadmin(), withOptionalRLSContext() (+7 more)

### Community 36 - "Payments & Billing"
Cohesion: 0.16
Nodes (16): POST(), POST(), getPricingThresholds(), calculateFinalPrice(), getFallbackQrCode(), getPaymentQrCode(), getPaymentSettings(), getPlanQrCode() (+8 more)

### Community 37 - "Admin & Verifications"
Cohesion: 0.18
Nodes (15): GET(), GET(), CacheEntry, cacheManager, CacheStats, calculateFallbackPrice(), calculatePrice(), calculatePriceInternal() (+7 more)

### Community 38 - "Admin & Verifications"
Cohesion: 0.12
Nodes (16): CountResult, DiscountDistributionRow, GET(), getDashboardAnalytics(), PaymentMethodDistributionRow, PaymentMethodRow, PlanDistributionRow, RevenueOverTimeRow (+8 more)

### Community 39 - "Community 39"
Cohesion: 0.15
Nodes (11): colorAccents, MetricCard(), MetricCardProps, formatCurrency(), PopularCollections(), PopularCollectionsProps, TrendChart(), TrendChartProps (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (10): QuoteDetailPage(), DemoWatermark(), DemoWatermarkProps, PrintDoc(), Props, Props, generatePoNumber(), generatePDF() (+2 more)

### Community 41 - "Admin & Verifications"
Cohesion: 0.16
Nodes (15): Admin Panel Integration Architecture, Admin Panel Integration Design, Admin Panel Integration Implementation Plan, Configurable Term Discounts Migration, Promo Code Management System, QR Code Pinata IPFS Integration, Admin Payment Settings Page, Admin Promo Codes Page (+7 more)

### Community 42 - "Admin & Verifications"
Cohesion: 0.15
Nodes (5): AdvancedPaymentSettings(), PaymentSettings, PromoCode, PromoCodeManager(), AdminLayout()

### Community 43 - "Admin & Verifications"
Cohesion: 0.21
Nodes (12): GET(), getRevenueAnalytics(), GET(), getVerificationStats(), canApproveProducts(), canDeleteProducts(), canModifyProducts(), canViewAllPendingProducts() (+4 more)

### Community 44 - "Onboarding Flow"
Cohesion: 0.25
Nodes (13): getConfiguredRoutes(), getRouteConfig(), getRoutePriority(), hasOnboardingContent(), isTargetRoute(), matchRoute(), ROUTE_FEATURE_MAP, ROUTE_PRIORITY (+5 more)

### Community 45 - "Utilities & Libs"
Cohesion: 0.22
Nodes (13): AdminNotificationParams, EmailContent, generateAdminNotificationEmailContent(), generateApprovalEmailContent(), generateRejectionEmailContent(), NotificationParams, NotificationResult, TODO: Implement actual email service integration (+5 more)

### Community 46 - "Admin & Verifications"
Cohesion: 0.19
Nodes (9): SubscriptionPlan, SubscriptionPlanData, PlanFeature, SubscriptionPlanData, SubscriptionPlanForm(), SubscriptionPlanFormProps, SubscriptionPlan, SubscriptionPlanList() (+1 more)

### Community 47 - "Payments & Billing"
Cohesion: 0.36
Nodes (10): POST(), GET(), approvePiPayment(), callPiPaymentsApi(), computePiAmount(), getPhpToUsdRate(), getPiApiKey(), getPiUsdPrice() (+2 more)

### Community 48 - "Admin & Verifications"
Cohesion: 0.27
Nodes (8): LoadingSpinner(), LoadingSpinnerProps, PricingHistory(), PricingHistoryProps, formatRelativeTime(), getChangeTypeBadgeClass(), getChangeTypeCardStyles(), getTimelineDotClass()

### Community 49 - "UI Components"
Cohesion: 0.32
Nodes (11): useWizard(), CustomerData, CustomerStep(), CustomerStepProps, getUTCDaysDiff(), getUTCMidnight(), isFutureUTCDate(), isPastDatedQuote() (+3 more)

### Community 50 - "Security & Audit"
Cohesion: 0.29
Nodes (11): checkRLSStatus(), checkTableExists(), env, fs, getTableSchema(), getTableStats(), main(), match (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (12): scripts, build, db:migrate, db:migrate:company-products, db:migrate:pricing, db:migrate:subscription-plans, dev, lint (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.21
Nodes (8): CheckoutError, BillingPeriod, intervalToBillingPeriod(), intervalToMonths(), PlanComparison(), PlanComparisonProps, SubscriptionPlanApi, SubscriptionPlansResponse

### Community 53 - "Utilities & Libs"
Cohesion: 0.22
Nodes (10): ColumnDefinition, ConstraintDefinition, DatabaseSchema, generateCreateTableSQL(), generateMigrationSQL(), IndexDefinition, PRODUCTION_SCHEMA, RelationshipDefinition (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.31
Nodes (10): fs, main(), path, testApiResponsePatterns(), testCachingStrategies(), testDatabaseQueryPerformance(), testFileUploadHandling(), testMemoryLeakPatterns() (+2 more)

### Community 55 - "Security & Audit"
Cohesion: 0.33
Nodes (9): checkRLSStatus(), env, fs, getAllTables(), getTableStats(), main(), match, { neon } (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (9): env, fs, getTableSchema(), getTableStats(), main(), match, { neon }, sql (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (9): env, fs, getDetailedSchema(), getTableStats(), main(), match, { neon }, sql (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.27
Nodes (9): colors, crypto, displayResults(), generateSignature(), http, https, main(), sendWebhook() (+1 more)

### Community 59 - "Admin & Verifications"
Cohesion: 0.22
Nodes (6): DashboardAnalytics, DiscountStats, PaymentMethodStats, PlanStats, AccountLockedBanner(), AccountLockedBannerProps

### Community 60 - "API Routes"
Cohesion: 0.39
Nodes (7): POST(), GET(), getCompanyId(), requireAdmin(), requireSession(), activateSubscription(), getTrialStatusResponse()

### Community 61 - "Community 61"
Cohesion: 0.31
Nodes (8): QuotesPage(), MeasurementData, CustomerData, MeasurementData, ReviewData, ReviewStep(), phpFormat(), QuoteItem

### Community 62 - "Trial System"
Cohesion: 0.33
Nodes (8): getTrialDaysRemaining(), CachedSubscription, getCachedSubscription(), proxy(), setCachedSubscription(), subscriptionCache, AccountStatus, UserSubscriptionInfo

### Community 63 - "API Routes"
Cohesion: 0.36
Nodes (8): fs, main(), path, testAdminComponents(), testAdminPageRoutes(), testApiEndpointFiles(), testApiStructure(), testDatabaseIntegration()

### Community 64 - "Utilities & Libs"
Cohesion: 0.32
Nodes (8): Company Product System Migration Script, Company Product Definitions System, Database Migration Process, Subscription System Migration Instructions, Multi-Tenant Product Catalog Architecture, Company Product Definitions Migration Report, Company Product System Migration README, Step A Database Functions Complete

### Community 65 - "Community 65"
Cohesion: 0.25
Nodes (6): BillingPeriod, LoadingState, PricingData, TODO: Implement payment method update flow, WarningBanner, SubscriptionPlanInterval

### Community 66 - "API Routes"
Cohesion: 0.32
Nodes (7): buildRLSContext(), CreateCheckoutRequest, CreateCheckoutResponse, POST(), RLSContext, SUBSCRIPTION_STATUS, validateCheckoutRequest()

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (6): analyzeUserContext(), env, fs, match, { neon }, sql

### Community 69 - "Community 69"
Cohesion: 0.33
Nodes (6): checkSchema(), env, fs, match, { neon }, sql

### Community 70 - "Community 70"
Cohesion: 0.43
Nodes (6): crypto, decryptPII(), hashEmailForSearch(), main(), { neon }, sql

### Community 71 - "Admin & Verifications"
Cohesion: 0.33
Nodes (3): PricingData, PriceCalculations, PricingConfig

### Community 72 - "UI Components"
Cohesion: 0.48
Nodes (6): CardState, CurrentSubscriptionCard(), formatCurrency(), getBillingCycleLabel(), getPeriodLabel(), getStatusBadgeClass()

### Community 73 - "Utilities & Libs"
Cohesion: 0.33
Nodes (6): ConstraintInfo, DatabaseSchema, IndexInfo, runMigration(), TableInfo, verifyMigration()

### Community 74 - "Utilities & Libs"
Cohesion: 0.33
Nodes (6): ConstraintInfo, DatabaseSchema, IndexInfo, runMigration(), TableInfo, verifyMigration()

### Community 75 - "Utilities & Libs"
Cohesion: 0.33
Nodes (6): ConstraintInfo, DatabaseSchema, IndexInfo, runMigration(), TableInfo, verifyMigration()

### Community 76 - "Utilities & Libs"
Cohesion: 0.33
Nodes (6): ConstraintInfo, DatabaseSchema, IndexInfo, runMigration(), TableInfo, verifyMigration()

### Community 77 - "Utilities & Libs"
Cohesion: 0.43
Nodes (6): crypto, encryptPII(), getEncryptionKey(), { neon }, reencrypt(), sql

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (6): auth, auth/jwt, JWT, Session, User, Window

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (6): comprehensiveTest(), envPath, fs, { neon }, path, sql

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (6): envPath, fs, { neon }, path, sql, testDatabaseFunctions()

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (6): envPath, fs, { neon }, path, quickTest(), sql

### Community 82 - "Admin & Verifications"
Cohesion: 0.33
Nodes (6): envPath, fs, { neon }, path, sql, verifyMigration()

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (5): base64FromBytea, buffer, convertedToHex, crypto, hexEncrypted

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (6): envPath, fs, investigatePlanJoin(), { neon }, path, sql

### Community 85 - "Security & Audit"
Cohesion: 0.40
Nodes (5): applyMigrations(), fs, { neon }, path, sql

### Community 86 - "Community 86"
Cohesion: 0.33
Nodes (6): Database-Driven Pricing, Pricing Audit Trail, Pricing System Architecture, Pricing System Summary, Pricing System Test Report, Route Audit Report

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (6): Migration 047 Security Vulnerabilities, Migration 047 Security Functions, SECURITY DEFINER Pattern Analysis, Security Fix Implementation, Migration 047 Security Issues, SQL Audit Documents SQL Audit Progress

### Community 88 - "Trial System"
Cohesion: 0.60
Nodes (6): OAuth Trial Activation Flow, Authentication Module, Proxy Middleware, Subscription Management System, Trial Activation System Design, Trial Activation Test Report

### Community 89 - "Community 89"
Cohesion: 0.40
Nodes (5): fs, { neon }, path, runMigration(), sql

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (5): fs, migration, { neon }, sql, statements

### Community 91 - "Trial System"
Cohesion: 0.33
Nodes (4): fs, { neon }, path, sql

### Community 92 - "Trial System"
Cohesion: 0.40
Nodes (5): fs, { neon }, path, runMigration(), sql

### Community 94 - "Community 94"
Cohesion: 0.53
Nodes (5): main(), mockDatabase, runDatabaseConstraintTests(), validateDatabaseConstraints(), verifyMigrationImplementation()

### Community 95 - "Community 95"
Cohesion: 0.67
Nodes (5): calculateFinalPrice(), main(), mockGetPaymentSettings(), runCriticalTests(), runEdgeCaseTests()

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (5): apiRoutes, components, fs, path, requiredFiles

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (5): env, fs, match, { neon }, sql

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (5): env, fs, match, { neon }, sql

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (3): fs, path, { sql }

### Community 100 - "Community 100"
Cohesion: 0.50
Nodes (4): checkSchema(), DATABASE_URL, dbUrlMatch, sql

### Community 101 - "Community 101"
Cohesion: 0.40
Nodes (4): description, name, private, version

### Community 102 - "Community 102"
Cohesion: 0.50
Nodes (4): fs, { neon }, runMigration(), sql

### Community 103 - "Admin & Verifications"
Cohesion: 0.40
Nodes (3): fs, { neon }, sql

### Community 104 - "Community 104"
Cohesion: 0.40
Nodes (3): fs, { neon }, sql

### Community 105 - "Admin & Verifications"
Cohesion: 0.60
Nodes (4): GET(), POST(), updatePlanQrCodes(), updatePromoQrCode()

### Community 108 - "Utilities & Libs"
Cohesion: 0.50
Nodes (4): bcrypt, migrate(), { neon }, sql

### Community 109 - "Admin & Verifications"
Cohesion: 0.50
Nodes (4): Admin Access Control System, Admin Console Badge, Admin Layout Testing Checklist, AdminLayout Responsive Behavior Testing

### Community 110 - "Community 110"
Cohesion: 0.67
Nodes (3): applyMigrationDirect(), { neon }, sql

### Community 111 - "Security & Audit"
Cohesion: 0.67
Nodes (3): applyQuoteItemsRLS(), { neon }, sql

### Community 113 - "Community 113"
Cohesion: 0.50
Nodes (3): { Client }, fs, path

### Community 114 - "Community 114"
Cohesion: 0.67
Nodes (3): checkCompanyProductsSchema(), { neon }, sql

### Community 115 - "Community 115"
Cohesion: 0.67
Nodes (3): checkDatabaseContext(), { neon }, sql

### Community 116 - "Payments & Billing"
Cohesion: 0.67
Nodes (3): checkPaymentSettingsTable(), { neon }, sql

### Community 117 - "Admin & Verifications"
Cohesion: 0.67
Nodes (3): checkPaymentVerificationsSchema(), { neon }, sql

### Community 118 - "Community 118"
Cohesion: 0.67
Nodes (3): checkQuoteItemsSchema(), { neon }, sql

### Community 119 - "Security & Audit"
Cohesion: 0.67
Nodes (3): debugRLS(), { neon }, sql

### Community 120 - "Security & Audit"
Cohesion: 0.67
Nodes (3): checkRLSStatus(), { neon }, sql

### Community 121 - "Community 121"
Cohesion: 0.67
Nodes (3): checkSchema(), { neon }, sql

### Community 122 - "Community 122"
Cohesion: 0.67
Nodes (3): checkDatabase(), { neon }, sql

### Community 123 - "Community 123"
Cohesion: 0.67
Nodes (3): debugUsers(), { neon }, sql

### Community 124 - "Community 124"
Cohesion: 0.67
Nodes (3): exploreDatabase(), { neon }, sql

### Community 125 - "Community 125"
Cohesion: 0.67
Nodes (3): exploreDatabaseStructure(), { neon }, sql

### Community 126 - "Community 126"
Cohesion: 0.67
Nodes (3): exploreDatabase(), { neon }, sql

### Community 129 - "Community 129"
Cohesion: 0.50
Nodes (3): dotenv, envPaths, path

### Community 130 - "Onboarding Flow"
Cohesion: 0.83
Nodes (4): User Onboarding Modal System, Feature Onboarding Modal Component, Onboarding Modal Component, Onboarding Modal System README

### Community 131 - "Community 131"
Cohesion: 0.67
Nodes (3): checkTables(), { neon }, sql

### Community 132 - "Admin & Verifications"
Cohesion: 0.67
Nodes (3): { neon }, sql, verify()

### Community 133 - "Trial System"
Cohesion: 0.67
Nodes (3): { neon }, sql, verifySchema()

### Community 134 - "Utilities & Libs"
Cohesion: 0.67
Nodes (3): migrate(), { neon }, sql

### Community 135 - "Admin & Verifications"
Cohesion: 0.67
Nodes (3): migrate(), { neon }, sql

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (3): http, options, req

### Community 137 - "Payments & Billing"
Cohesion: 0.67
Nodes (3): { neon }, sql, testPaymentFunctions()

### Community 138 - "Security & Audit"
Cohesion: 0.67
Nodes (3): { neon }, sql, testRLSImplementation()

### Community 139 - "Community 139"
Cohesion: 0.67
Nodes (3): { neon }, sql, updatePricingConfig()

### Community 140 - "Security & Audit"
Cohesion: 0.67
Nodes (3): { neon }, sql, verifyQuoteItemsRLS()

### Community 141 - "Security & Audit"
Cohesion: 0.67
Nodes (3): Application Security Audit, Authorization Checks, Security Vulnerabilities

### Community 155 - "Community 155"
Cohesion: 0.67
Nodes (3): Concetto Window Coverings App, Project README, Subscription System

### Community 156 - "Community 156"
Cohesion: 0.67
Nodes (3): Dashboard Implementation, Enterprise Metrics, PII Encryption

### Community 198 - "Community 198"
Cohesion: 0.67
Nodes (3): Company, CompanyWithSubscription, CompanyWithUsers

### Community 199 - "Community 199"
Cohesion: 0.67
Nodes (3): Quote, QuoteWithCompany, QuoteWithItems

### Community 200 - "Community 200"
Cohesion: 0.67
Nodes (3): User, UserWithCompany, UserWithOAuth

## Knowledge Gaps
- **755 isolated node(s):** `{ neon }`, `s`, `fs`, `{ neon }`, `env` (+750 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **91 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sql` connect `Community 10` to `Admin & Verifications`, `Community 4`, `Payments & Billing`, `Admin & Verifications`, `Admin & Verifications`, `Admin & Verifications`, `API Routes`, `Community 23`, `API Routes`, `API Routes`, `API Routes`, `Admin & Verifications`, `Admin & Verifications`, `Payments & Billing`, `Admin & Verifications`, `Admin & Verifications`, `Admin & Verifications`, `Community 99`, `Admin & Verifications`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `getSession()` connect `Admin & Verifications` to `Theme System`, `Admin & Verifications`, `Trial System`, `Payments & Billing`, `Community 10`, `Admin & Verifications`, `API Routes`, `Admin & Verifications`, `API Routes`, `API Routes`, `Admin & Verifications`, `API Routes`, `Admin & Verifications`, `Admin & Verifications`, `Payments & Billing`, `Admin & Verifications`, `Admin & Verifications`, `Admin & Verifications`, `Payments & Billing`, `API Routes`, `API Routes`, `Admin & Verifications`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `query()` connect `Payments & Billing` to `Theme System`, `Admin & Verifications`, `Community 4`, `Payments & Billing`, `Admin & Verifications`, `Admin & Verifications`, `Admin & Verifications`, `Admin & Verifications`, `API Routes`, `Payments & Billing`, `Admin & Verifications`, `API Routes`, `API Routes`, `API Routes`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `{ neon }`, `s`, `fs` to the rest of the system?**
  _755 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Theme System` be split into smaller, more focused modules?**
  _Cohesion score 0.05209274314965372 - nodes in this community are weakly interconnected._
- **Should `Admin & Verifications` be split into smaller, more focused modules?**
  _Cohesion score 0.058747160012982795 - nodes in this community are weakly interconnected._
- **Should `Trial System` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._