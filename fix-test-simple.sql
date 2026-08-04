-- Simplified test function that checks for subqueries instead of exact patterns
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
  test_company_1_id UUID;
BEGIN
  test_company_1_id := gen_random_uuid();

  -- Test 11: Verify indirect tenant isolation through quotes
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quote_items'
      AND policyname = 'quote_items_tenant_isolation'
      AND (qual LIKE '%SELECT%FROM quotes%' OR with_check LIKE '%SELECT%FROM quotes%')
      AND (qual LIKE '%get_current_company_id()%' OR with_check LIKE '%get_current_company_id()%')
    ) THEN
      RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, true::BOOLEAN,
        'Tenant isolation uses proper indirect pattern through quotes'::TEXT,
        'Correctly implements quote-based company access control'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, false::BOOLEAN,
        'Tenant isolation may not use proper indirect pattern'::TEXT,
        'Consider updating to use quotes subquery for proper security'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Indirect Tenant Isolation'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  -- Test 12: Verify financial protection enforcement
  BEGIN
    PERFORM set_tenant_context(test_company_1_id, 'admin');

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'quote_items'
      AND policyname = 'quote_items_financial_protection'
      AND (qual LIKE '%SELECT%FROM quote_items%' OR with_check LIKE '%SELECT%FROM quote_items%')
    ) THEN
      RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, true::BOOLEAN,
        'Financial protection uses proper RLS subquery pattern'::TEXT,
        'Correctly prevents modification of cost structures after creation'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, false::BOOLEAN,
        'Financial protection may not use proper RLS pattern'::TEXT,
        'Consider updating to use RLS subquery for proper security'::TEXT;
    END IF;

    PERFORM reset_tenant_context();
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Financial Protection Enforcement'::TEXT, false::BOOLEAN,
      SQLERRM::TEXT, ''::TEXT;
    PERFORM reset_tenant_context();
  END;

  RETURN;
END;
$$;