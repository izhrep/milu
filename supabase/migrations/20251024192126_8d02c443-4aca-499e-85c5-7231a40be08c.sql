-- Create security definer functions for permissions data

-- Function to get all permissions
CREATE OR REPLACE FUNCTION get_all_permissions()
RETURNS SETOF permissions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM permissions ORDER BY resource, name;
$$;

-- Function to get role permissions
CREATE OR REPLACE FUNCTION get_role_permissions()
RETURNS SETOF role_permissions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM role_permissions;
$$;