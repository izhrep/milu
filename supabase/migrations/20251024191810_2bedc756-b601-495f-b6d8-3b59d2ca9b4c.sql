-- Create a security definer function to get users with roles
CREATE OR REPLACE FUNCTION get_users_with_roles()
RETURNS TABLE (
  id uuid,
  email text,
  status boolean,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  role app_role
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.email,
    u.status,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    ur.role
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id;
$$;