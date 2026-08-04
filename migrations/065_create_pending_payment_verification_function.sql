-- Migration: Create SECURITY DEFINER function for pending payment verification lookups
-- Purpose: Provide controlled RLS bypass for webhook payment verification matching
-- Pattern: Following SECURITY DEFINER approach with proper authorization checks

-- ============================================================================
-- CREATE SECURITY DEFINER FUNCTION FOR PENDING PAYMENT VERIFICATIONS LOOKUP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_payment_verifications_by_reference(p_cleaned_reference_number VARCHAR(50))
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: Validate role context before payment verifications access
  IF current_setting('app.role', true) IS NULL OR current_setting('app.role', true) = '' THEN
    RAISE EXCEPTION 'Security: No role context set for payment verification lookup';
  END IF;

  -- Return pending payment verifications matching the cleaned reference number
  RETURN QUERY
  SELECT row_to_json(t)::json
  FROM (
    SELECT
      pv.id,
      pv.company_id,
      pv.user_id,
      pv.plan_id,
      pv.screenshot_url,
      pv.reference_number,
      pv.cleaned_reference_number,
      pv.notes,
      pv.status,
      pv.admin_notes,
      pv.admin_id,
      pv.submitted_at,
      pv.reviewed_at,
      pv.created_at,
      pv.updated_at,
      pv.automatic_verification_attempted,
      pv.automatic_verification_status,
      pv.verification_method,
      pv.webhook_data_id,
      u.email as user_email,
      u.name as user_name,
      sp.name as plan_name,
      sp.amount as plan_amount,
      sp.currency as plan_currency
    FROM payment_verifications pv
    LEFT JOIN users u ON pv.user_id = u.id
    LEFT JOIN subscription_plans sp ON pv.plan_id = sp.id
    WHERE pv.cleaned_reference_number = p_cleaned_reference_number
      AND pv.status = 'pending'
      AND pv.automatic_verification_attempted = FALSE
    ORDER BY pv.submitted_at ASC
  ) t;
END;
$$;

COMMENT ON FUNCTION get_pending_payment_verifications_by_reference IS 'SECURITY DEFINER function to get pending payment verifications by cleaned reference number. Used by webhook payment verification system. Requires role context and bypasses RLS for cross-company payment matching.';

GRANT EXECUTE ON FUNCTION get_pending_payment_verifications_by_reference(VARCHAR(50)) TO PUBLIC;

COMMIT;