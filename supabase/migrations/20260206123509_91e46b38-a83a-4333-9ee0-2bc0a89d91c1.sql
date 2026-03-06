-- ============================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ============================================

-- 1. Create SECURITY DEFINER function for peer selection
-- Returns only minimal fields needed for peer selection dialog
CREATE OR REPLACE FUNCTION public.get_users_for_peer_selection(_current_user_id uuid)
RETURNS TABLE(
  id uuid,
  last_name text,
  first_name text,
  middle_name text,
  department_id uuid,
  position_id uuid
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
    u.position_id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.status = true
    AND u.id != _current_user_id
    AND ur.role IN ('employee', 'manager')
  ORDER BY u.last_name, u.first_name;
$$;

-- 2. Drop and recreate users_select_policy without broad diagnostic access
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
FOR SELECT TO authenticated
USING (
  -- Own data
  id = auth.uid()
  -- Admin or HR BP role
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'hr_bp')
  )
  -- Has permission to view users
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('users.view', 'users.view_all', 'security.manage_users')
  )
  -- Direct subordinates (manager can see their team)
  OR manager_id = auth.uid()
  -- User's own manager
  OR id = (SELECT manager_id FROM public.users WHERE id = auth.uid())
);

-- 3. Create view for aggregated assignment stats (evaluated user sees only counts)
CREATE OR REPLACE FUNCTION public.get_my_assignment_stats(_evaluated_user_id uuid, _stage_id uuid DEFAULT NULL)
RETURNS TABLE(
  total_evaluators bigint,
  completed_evaluators bigint,
  pending_evaluators bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::bigint as total_evaluators,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_evaluators,
    COUNT(*) FILTER (WHERE status = 'pending' OR status = 'approved')::bigint as pending_evaluators
  FROM survey_360_assignments
  WHERE evaluated_user_id = _evaluated_user_id
    AND evaluating_user_id != _evaluated_user_id  -- Exclude self-assessment
    AND (_stage_id IS NULL OR diagnostic_stage_id = _stage_id);
$$;

-- 4. Fix survey_360_assignments policy - evaluated user only sees their own assignments as evaluator
DROP POLICY IF EXISTS "survey_360_assignments_select_policy" ON public.survey_360_assignments;

CREATE POLICY "survey_360_assignments_select_policy" ON public.survey_360_assignments
FOR SELECT TO authenticated
USING (
  -- User is the evaluator (can see assignments where they evaluate others)
  evaluating_user_id = auth.uid()
  -- Managers can see assignments for their subordinates
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = evaluated_user_id
    AND u.manager_id = auth.uid()
  )
  -- Admin/HR BP can see all
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'hr_bp')
  )
  -- Has permission to view diagnostics
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('diagnostics.view', 'diagnostics.manage')
  )
);

-- 5. Fix hard_skill_results policy - evaluated user cannot directly access raw results
DROP POLICY IF EXISTS "hard_skill_results_select_policy" ON public.hard_skill_results;

CREATE POLICY "hard_skill_results_select_policy" ON public.hard_skill_results
FOR SELECT TO authenticated
USING (
  -- User is the evaluator (can see their own submitted evaluations)
  evaluating_user_id = auth.uid()
  -- Managers can see results for their subordinates
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = evaluated_user_id
    AND u.manager_id = auth.uid()
  )
  -- Admin/HR BP can see all
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'hr_bp')
  )
  -- Has permission to view assessment results
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('assessment_results.view', 'assessment_results.view_all')
  )
);

-- 6. Fix soft_skill_results policy - same as hard_skill_results
DROP POLICY IF EXISTS "soft_skill_results_select_policy" ON public.soft_skill_results;

CREATE POLICY "soft_skill_results_select_policy" ON public.soft_skill_results
FOR SELECT TO authenticated
USING (
  -- User is the evaluator (can see their own submitted evaluations)
  evaluating_user_id = auth.uid()
  -- Managers can see results for their subordinates
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = evaluated_user_id
    AND u.manager_id = auth.uid()
  )
  -- Admin/HR BP can see all
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'hr_bp')
  )
  -- Has permission to view assessment results
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('assessment_results.view', 'assessment_results.view_all')
  )
);