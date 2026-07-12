# PayMongo Integration Archive

**Archive Date:** 2026-07-12  
**Reason:** Manual GCash/crypto payment system implementation  
**Status:** Archived - Not in active use

## Original Integration

This directory contains the original PayMongo payment integration that was used for automated payment processing.

### Components Archived

- **Webhook Handler:** `src/app/api/webhooks/paymongo/route.ts`
- **Subscription Creation:** `src/app/api/subscriptions/create/route.ts`
- **Subscription Cancellation:** `src/app/api/account/subscription/cancel/route.ts`
- **Account Management:** `src/app/api/account/subscription/route.ts`

### Migration Files

- Database migrations: `migration_files/subscription-system.sql`

### Documentation

- Original setup documentation
- Production readiness reports
- Implementation complete reports

## Reactivation Instructions

If you need to reactivate PayMongo integration in the future:

1. **Environment Variables Required:**
   - `PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here`
   - `PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here`
   - `PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here`
   - `PAYMONGO_API_URL=https://api.paymongo.com/v1`

2. **Database Tables:**
   - Ensure subscription tables still exist (marked with `paymongo_archived` flag)
   - Run original migration if needed

3. **Code Restoration:**
   - Move files from `original_integration/` back to `src/app/api/`
   - Update import paths
   - Test webhook endpoints

4. **Testing:**
   - Test webhook signature verification
   - Test payment creation flows
   - Test subscription lifecycle

## Migration Notes

- All existing subscriptions preserved in database
- User payment history maintained
- No data loss occurred during archival
- New system uses manual activation codes instead

## Contact

For questions about this archived integration, contact the development team.