-- ROLLBACK SNAPSHOT taken 2026-08-02T06:26:22.882Z
-- Restores function defs + companies_insert_protection policy to pre-fix state

BEGIN;

-- check_company_exists(p_code text)
CREATE OR REPLACE FUNCTION public.check_company_exists(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Security: Validate role context before company existence check
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for company lookup';
  END IF;

  -- Return company existence status
  RETURN EXISTS(SELECT 1 FROM companies WHERE UPPER(code) = UPPER(p_code));
END;
$function$


-- check_user_exists_by_email_hash(p_email_hash text)
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email_hash(p_email_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Security: Validate role context before user existence check
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user lookup';
  END IF;

  -- Return user existence status
  RETURN EXISTS(SELECT 1 FROM users WHERE email_hash = p_email_hash);
END;
$function$


-- create_company(p_code text, p_name text, p_address text, p_mobile text, p_email text, p_prepared_by text, p_minimum_area_sqft numeric)
CREATE OR REPLACE FUNCTION public.create_company(p_code text, p_name text, p_address text, p_mobile text, p_email text, p_prepared_by text, p_minimum_area_sqft numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company RECORD;
BEGIN
  -- Security: Validate role context before company creation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for company creation';
  END IF;

  -- Create company with RLS bypass
  INSERT INTO companies (code, name, address, mobile, email, prepared_by, minimum_area_sqft)
  VALUES (p_code, p_name, p_address, p_mobile, p_email, p_prepared_by, p_minimum_area_sqft)
  RETURNING id, code, name
  INTO v_company;

  RETURN row_to_json(v_company)::json;
END;
$function$


-- create_company_with_context(p_code text, p_name text, p_address text, p_mobile text, p_email text, p_minimum_area_sqft numeric)
CREATE OR REPLACE FUNCTION public.create_company_with_context(p_code text, p_name text, p_address text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_minimum_area_sqft numeric DEFAULT 15)
 RETURNS TABLE(company_id uuid, company_code text, company_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Security: Validate role context
  -- Only allow from application layer with proper role
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for company creation';
  END IF;

  -- Create company with RLS bypass
  RETURN QUERY
  INSERT INTO companies (code, name, address, mobile, email, minimum_area_sqft)
  VALUES (
    p_code,
    p_name,
    p_address,
    p_mobile,
    p_email,
    p_minimum_area_sqft
  )
  RETURNING
    id as company_id,
    code as company_code,
    name as company_name;
END;
$function$


-- create_user(p_email text, p_password_hash text, p_email_hash text, p_company_id uuid, p_role text)
CREATE OR REPLACE FUNCTION public.create_user(p_email text, p_password_hash text, p_email_hash text, p_company_id uuid, p_role text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  -- Security: Validate role context before user creation
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user creation';
  END IF;

  -- Create user with RLS bypass
  INSERT INTO users (email, password_hash, email_hash, company_id, role)
  VALUES (p_email, p_password_hash, p_email_hash, p_company_id, p_role)
  RETURNING id, email, company_id, role, created_at
  INTO v_user;

  RETURN row_to_json(v_user)::json;
END;
$function$


-- reset_complete_user_context()
CREATE OR REPLACE FUNCTION public.reset_complete_user_context()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reset tenant context
  PERFORM reset_tenant_context();

  -- Reset user context
  PERFORM set_config('rls.current_user_id', NULL, false);

  -- Log the context reset
  RAISE LOG 'RLS complete context reset';
END;
$function$


-- reset_tenant_context()
CREATE OR REPLACE FUNCTION public.reset_tenant_context()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Clear session context variables
  PERFORM set_config('rls.current_company_id', NULL, false);
  PERFORM set_config('rls.current_user_role', NULL, false);

  -- Log the context reset (for debugging and audit purposes)
  RAISE LOG 'RLS context reset';
END;
$function$


-- set_app_role(p_role text)
CREATE OR REPLACE FUNCTION public.set_app_role(p_role text DEFAULT 'concetto'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- FIXED: Changed third parameter from true to false for session persistence
  PERFORM set_config('app.role', p_role, false);
END;
$function$


-- set_complete_user_context(company_id uuid, user_id uuid, user_role text)
CREATE OR REPLACE FUNCTION public.set_complete_user_context(company_id uuid, user_id uuid, user_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Set tenant context
  PERFORM set_tenant_context(company_id, user_role);

  -- Set user context
  PERFORM set_user_context(user_id);

  -- Log the complete context set
  RAISE LOG 'RLS complete context set: company_id=%, user_id=%, user_role=%', company_id, user_id, user_role;
END;
$function$


-- set_tenant_context(company_id uuid, user_role text)
CREATE OR REPLACE FUNCTION public.set_tenant_context(company_id uuid, user_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID cannot be NULL';
  END IF;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User role cannot be NULL';
  END IF;

  IF user_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid user role: %', user_role;
  END IF;

  -- Set session context using PostgreSQL's built-in session variables
  PERFORM set_config('rls.current_company_id', company_id::TEXT, false);
  PERFORM set_config('rls.current_user_role', user_role, false);

  -- Log the context set (for debugging and audit purposes)
  RAISE LOG 'RLS context set: company_id=%, user_role=%', company_id, user_role;
END;
$function$


-- set_user_context(user_id uuid)
CREATE OR REPLACE FUNCTION public.set_user_context(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate input
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be NULL';
  END IF;

  -- Set user context using PostgreSQL's built-in session variables
  PERFORM set_config('rls.current_user_id', user_id::TEXT, false);

  -- Log the context set (for debugging and audit purposes)
  RAISE LOG 'RLS user context set: user_id=%', user_id;
END;
$function$


-- update_user_email_hash(p_user_id uuid, p_email_hash text)
CREATE OR REPLACE FUNCTION public.update_user_email_hash(p_user_id uuid, p_email_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Security: Validate role context before user email update
  IF current_setting('app.role', true) IS NULL THEN
    RAISE EXCEPTION 'Security: No role context set for user update';
  END IF;

  -- Update user email hash
  UPDATE users SET email_hash = p_email_hash WHERE id = p_user_id;
END;
$function$


-- companies_insert_protection
DROP POLICY IF EXISTS companies_insert_protection ON companies;
CREATE POLICY companies_insert_protection ON companies FOR INSERT TO public WITH CHECK (((get_current_company_id() IS NULL) OR is_current_user_superadmin()));

COMMIT;
