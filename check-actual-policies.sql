-- Check what's actually in the database policies
CREATE OR REPLACE FUNCTION test_quote_items_rls()
RETURNS TABLE(
  test_name TEXT,
  success BOOLEAN,
  message TEXT,
  details TEXT
)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  policy_count INTEGER;
  qual_text TEXT;
  with_check_text TEXT;
BEGIN
  -- Test 11: Check tenant isolation policy exists and has correct structure
  BEGIN
    SELECT qual, with_check INTO qual_text, with_check_text
    FROM pg_policies
    WHERE tablename = 'quote_items'
    AND policyname = 'quote_items_tenant_isolation';

    IF qual_text IS NOT NULL OR with_check_text IS NOT NULL THEN
      -- Check if it uses quotes subquery and get_current_company_id
      IF (qual_text LIKE '%SELECT quotes.id FROM quotes%' OR with_check_text LIKE '%SELECT quotes.id FROM quotes%')
      AND (qual_text LIKE '%quotes.company_id = get_current_company_id()%' OR with_check_text LIKE '%quotes.company_id = get_current_company_id()%') THEN
        RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, true::BOOLEAN,
          'Tenant isolation uses quotes subquery pattern'::TEXT,
          'Policy correctly implements quote-based access control'::TEXT;
      ELSE
        RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, false::BOOLEAN,
          'Policy exists but pattern differs from expected'::TEXT,
          'Expected: SELECT quotes.id FROM quotes with company_id check'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, false::BOOLEAN,
        'Policy not found'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  -- Test 12: Check financial protection policy exists and has correct structure
  BEGIN
    SELECT qual, with_check INTO qual_text, with_check_text
    FROM pg_policies
    WHERE tablename = 'quote_items'
    AND policyname = 'quote_items_financial_protection';

    IF qual_text IS NOT NULL OR with_check_text IS NOT NULL THEN
      -- Check if it uses RLS subquery for quote_items
      IF (qual_text LIKE '%SELECT quote_items_1.supplier_cost_sqft FROM quote_items quote_items_1%' OR
          with_check_text LIKE '%SELECT quote_items_1.supplier_cost_sqft FROM quote_items quote_items_1%' OR
          qual_text LIKE '%SELECT quote_items_1.supplier_amount FROM quote_items quote_items_1%' OR
          with_check_text LIKE '%SELECT quote_items_1.supplier_amount FROM quote_items quote_items_1%') THEN
        RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, true::BOOLEAN,
          'Financial protection uses RLS subquery pattern'::TEXT,
          'Policy correctly prevents cost modifications'::TEXT;
      ELSE
        RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, false::BOOLEAN,
          'Policy exists but pattern differs from expected'::TEXT,
          'Expected: SELECT quote_items_1.supplier_cost_sqft FROM quote_items quote_items_1 pattern'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, false::BOOLEAN,
        'Policy not found'::TEXT, ''::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
  END;

  RETURN;
END;
$$;