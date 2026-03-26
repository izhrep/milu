-- Tighten tasks SELECT policy: remove is_in_management_subtree
-- Manager should only see tasks of DIRECT reports, not entire subtree
-- This prevents manager+1 from seeing/receiving tasks meant for direct manager

DROP POLICY IF EXISTS tasks_select_auth_policy ON public.tasks;

CREATE POLICY tasks_select_auth_policy ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_users_manager(auth.uid(), user_id)
    OR has_permission('tasks.view_all'::text)
  );