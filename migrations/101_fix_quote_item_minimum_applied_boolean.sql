-- ============================================================================
-- 101: Fix minimum_applied type mismatch
--
-- quote_items.minimum_applied is BOOLEAN (migration 012), but
-- create_quote_item() declared p_minimum_applied as NUMERIC and
-- update_quote_items() cast the JSON value to NUMERIC. Inserting a numeric
-- into the boolean column fails with:
--   ERROR: column "minimum_applied" is of type boolean but expression is of type numeric
--
-- Fix: both functions now use BOOLEAN for minimum_applied.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_quote_item: p_minimum_applied boolean
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS create_quote_item CASCADE;
CREATE OR REPLACE FUNCTION create_quote_item(
  p_quote_id uuid, p_sort_order int, p_location text, p_product_id uuid, p_product_code text,
  p_product_collection text, p_product_description text, p_unit text, p_is_fixed boolean,
  p_measured_width numeric, p_measured_drop numeric, p_final_width numeric, p_final_drop numeric,
  p_area_sqft numeric, p_retail_price_sqft numeric, p_supplier_cost_sqft numeric,
  p_retail_amount numeric, p_supplier_amount numeric, p_minimum_applied boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quote_items (
    quote_id, sort_order, location, product_id, product_code, product_collection, product_description,
    unit, is_fixed, measured_width, measured_drop, final_width, final_drop,
    area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount, minimum_applied
  ) VALUES (
    p_quote_id, p_sort_order, p_location, p_product_id, p_product_code, p_product_collection, p_product_description,
    p_unit, p_is_fixed, p_measured_width, p_measured_drop, p_final_width, p_final_drop,
    p_area_sqft, p_retail_price_sqft, p_supplier_cost_sqft, p_retail_amount, p_supplier_amount, p_minimum_applied
  );

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_quote_items: cast minimum_applied to boolean
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_quote_items CASCADE;
CREATE OR REPLACE FUNCTION update_quote_items(p_quote_id uuid, p_items json)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM quote_items WHERE quote_id = p_quote_id;

  INSERT INTO quote_items (
    quote_id, sort_order, location, product_id, product_code, product_collection, product_description,
    unit, is_fixed, measured_width, measured_drop, final_width, final_drop,
    area_sqft, retail_price_sqft, supplier_cost_sqft, retail_amount, supplier_amount, minimum_applied
  )
  SELECT
    p_quote_id, (elem->>'sort_order')::int, elem->>'location',
    (elem->>'product_id')::uuid, elem->>'product_code', elem->>'product_collection', elem->>'product_description',
    elem->>'unit', (elem->>'is_fixed')::boolean,
    (elem->>'measured_width')::numeric, (elem->>'measured_drop')::numeric,
    (elem->>'final_width')::numeric, (elem->>'final_drop')::numeric,
    (elem->>'area_sqft')::numeric, (elem->>'retail_price_sqft')::numeric,
    (elem->>'supplier_cost_sqft')::numeric, (elem->>'retail_amount')::numeric,
    (elem->>'supplier_amount')::numeric, (elem->>'minimum_applied')::boolean
  FROM json_array_elements(p_items) as elem;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Re-grant execute privileges (dropped by DROP ... CASCADE)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION create_quote_item(uuid, int, text, uuid, text, text, text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION update_quote_items(uuid, json) TO PUBLIC;
