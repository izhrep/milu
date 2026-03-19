
-- Step 1: Recursive subtree functions for manager hierarchy
-- get_management_subtree_ids: returns all user IDs below a given manager (not including self)
CREATE OR REPLACE FUNCTION public.get_management_subtree_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct subordinates
    SELECT id, 1 AS depth
    FROM users
    WHERE manager_id = _manager_id
      AND status = true
    
    UNION ALL
    
    -- Indirect subordinates (max depth 10)
    SELECT u.id, s.depth + 1
    FROM users u
    INNER JOIN subordinates s ON u.manager_id = s.id
    WHERE u.status = true
      AND s.depth < 10
  )
  SELECT id FROM subordinates;
$$;

-- is_in_management_subtree: checks if target user is anywhere in manager's subtree
CREATE OR REPLACE FUNCTION public.is_in_management_subtree(_manager_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_management_subtree_ids(_manager_id) AS sub_id
    WHERE sub_id = _target_id
  );
$$;
