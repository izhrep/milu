
-- Step 4: Exclude evaluated user's immediate manager from peer selection
CREATE OR REPLACE FUNCTION public.get_users_for_peer_selection(_current_user_id uuid)
RETURNS TABLE (
  id uuid,
  last_name text,
  first_name text,
  middle_name text,
  department_id uuid,
  position_id uuid,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.last_name,
    u.first_name,
    u.middle_name,
    u.department_id,
    u.position_id,
    u.email
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.status = true
    AND u.id != _current_user_id
    AND u.id != COALESCE((SELECT manager_id FROM users WHERE id = _current_user_id), '00000000-0000-0000-0000-000000000000'::uuid)
    AND ur.role IN ('employee', 'manager')
  ORDER BY u.last_name, u.first_name;
$$;
