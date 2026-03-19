
-- Step 3: RLS SELECT policy updates — add subtree visibility
-- No UPDATE policies are changed — direct-only stays for writes

-- 1. users SELECT: add subtree visibility
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT USING (
    (id = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['admin'::app_role, 'hr_bp'::app_role])
    ))
    OR (EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
        AND uep.permission_name = ANY (ARRAY['users.view', 'users.view_all', 'security.manage_users'])
    ))
    OR (manager_id = auth.uid())
    OR (id = get_current_user_manager_id())
    OR is_in_management_subtree(auth.uid(), id)
  );

-- 2. one_on_one_meetings SELECT: add subtree check on employee_id
DROP POLICY IF EXISTS "one_on_one_meetings_select_auth_policy" ON public.one_on_one_meetings;
CREATE POLICY "one_on_one_meetings_select_auth_policy" ON public.one_on_one_meetings
  FOR SELECT USING (
    (employee_id = auth.uid())
    OR (manager_id = auth.uid())
    OR is_users_manager(employee_id)
    OR is_in_management_subtree(auth.uid(), employee_id)
    OR has_permission('meetings.view_all')
  );

-- 3. meeting_decisions SELECT: add subtree check via join
DROP POLICY IF EXISTS "meeting_decisions_select_auth_policy" ON public.meeting_decisions;
CREATE POLICY "meeting_decisions_select_auth_policy" ON public.meeting_decisions
  FOR SELECT USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR (EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
        AND (is_users_manager(m.employee_id) OR is_in_management_subtree(auth.uid(), m.employee_id))
    ))
    OR has_permission('meetings.view_all')
  );

-- 4. meeting_artifacts SELECT: add subtree check via join
DROP POLICY IF EXISTS "meeting_artifacts_select" ON public.meeting_artifacts;
CREATE POLICY "meeting_artifacts_select" ON public.meeting_artifacts
  FOR SELECT USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR (EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_artifacts.meeting_id
        AND (is_users_manager(m.employee_id) OR is_in_management_subtree(auth.uid(), m.employee_id))
    ))
    OR has_permission('meetings.view_all')
  );

-- 5. tasks SELECT: add subtree check
DROP POLICY IF EXISTS "tasks_select_auth_policy" ON public.tasks;
CREATE POLICY "tasks_select_auth_policy" ON public.tasks
  FOR SELECT USING (
    (user_id = auth.uid())
    OR is_users_manager(auth.uid(), user_id)
    OR is_in_management_subtree(auth.uid(), user_id)
    OR has_permission('tasks.view_all')
  );
