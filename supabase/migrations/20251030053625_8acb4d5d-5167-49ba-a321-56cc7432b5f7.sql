-- ============================================================================
-- UPDATE get_user_with_role FUNCTION TO USE NAME COMPONENTS
-- ============================================================================
-- Replace full_name with CONCAT of last_name, first_name, middle_name
-- Note: This function uses user_roles instead of roles table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_with_role(user_email text)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  email text, 
  role_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id, 
    CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, '')) as full_name,
    u.email, 
    ur.role::text as role_name
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.email = user_email;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ Function uses CONCAT with last_name, first_name, middle_name
-- ✅ No direct references to full_name column in function
-- ✅ Function returns computed full_name as result column
-- ============================================================================