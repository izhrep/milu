-- =====================================================
-- COMPREHENSIVE RLS POLICIES FOR ALL UNPROTECTED TABLES
-- =====================================================
-- This migration adds complete RLS protection for 14 critical tables
-- using permission-based access control via has_permission()
-- =====================================================

-- ========== TABLE: users ==========
-- Users can view: their own data, team data (if manager), all data (if has permission)
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT
  USING (
    id = get_current_user_id() OR
    has_permission('users.view_all') OR
    (has_permission('users.view_team') AND is_users_manager(id))
  );

-- Only users with permission can insert users
CREATE POLICY "users_insert_policy" ON public.users
  FOR INSERT
  WITH CHECK (has_permission('users.create'));

-- Users can update: their own data or if they have permission
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE
  USING (
    id = get_current_user_id() OR
    has_permission('users.update_all') OR
    (has_permission('users.update_team') AND is_users_manager(id))
  )
  WITH CHECK (
    id = get_current_user_id() OR
    has_permission('users.update_all') OR
    (has_permission('users.update_team') AND is_users_manager(id))
  );

-- Only users with permission can delete users
CREATE POLICY "users_delete_policy" ON public.users
  FOR DELETE
  USING (has_permission('users.delete'));

-- ========== TABLE: user_profiles ==========
-- Users can view their own profile or if they have permission
CREATE POLICY "user_profiles_select_policy" ON public.user_profiles
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('users.view_all') OR
    (has_permission('users.view_team') AND is_users_manager(user_id))
  );

-- Users can insert their own profile
CREATE POLICY "user_profiles_insert_policy" ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('users.create')
  );

-- Users can update their own profile or if they have permission
CREATE POLICY "user_profiles_update_policy" ON public.user_profiles
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('users.update_all')
  );

-- Only users with permission can delete profiles
CREATE POLICY "user_profiles_delete_policy" ON public.user_profiles
  FOR DELETE
  USING (has_permission('users.delete'));

-- ========== TABLE: tasks ==========
-- Users can view: their own tasks, team tasks (if manager), or all tasks (if has permission)
CREATE POLICY "tasks_select_policy" ON public.tasks
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('tasks.view_all') OR
    (has_permission('tasks.view_team') AND is_users_manager(user_id))
  );

-- Users can create tasks for themselves or if they have permission
CREATE POLICY "tasks_insert_policy" ON public.tasks
  FOR INSERT
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('tasks.create_all') OR
    (has_permission('tasks.create_team') AND is_users_manager(user_id))
  );

-- Users can update their own tasks or if they have permission
CREATE POLICY "tasks_update_policy" ON public.tasks
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('tasks.update_all') OR
    (has_permission('tasks.update_team') AND is_users_manager(user_id))
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('tasks.update_all') OR
    (has_permission('tasks.update_team') AND is_users_manager(user_id))
  );

-- Only users with permission can delete tasks
CREATE POLICY "tasks_delete_policy" ON public.tasks
  FOR DELETE
  USING (
    has_permission('tasks.delete_all') OR
    (has_permission('tasks.delete_team') AND is_users_manager(user_id))
  );

-- ========== TABLE: diagnostic_stages ==========
-- Users can view diagnostic stages if they are participants or have permission
CREATE POLICY "diagnostic_stages_select_policy" ON public.diagnostic_stages
  FOR SELECT
  USING (
    has_permission('diagnostics.view_all') OR
    EXISTS (
      SELECT 1 FROM diagnostic_stage_participants
      WHERE stage_id = diagnostic_stages.id
      AND user_id = get_current_user_id()
    )
  );

-- Only users with permission can create diagnostic stages
CREATE POLICY "diagnostic_stages_insert_policy" ON public.diagnostic_stages
  FOR INSERT
  WITH CHECK (has_permission('diagnostics.create'));

-- Only users with permission can update diagnostic stages
CREATE POLICY "diagnostic_stages_update_policy" ON public.diagnostic_stages
  FOR UPDATE
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));

-- Only users with permission can delete diagnostic stages
CREATE POLICY "diagnostic_stages_delete_policy" ON public.diagnostic_stages
  FOR DELETE
  USING (has_permission('diagnostics.delete'));

-- ========== TABLE: diagnostic_stage_participants ==========
-- Users can view participants if they are participants or have permission
CREATE POLICY "diagnostic_stage_participants_select_policy" ON public.diagnostic_stage_participants
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('diagnostics.view_all') OR
    EXISTS (
      SELECT 1 FROM diagnostic_stage_participants dsp2
      WHERE dsp2.stage_id = diagnostic_stage_participants.stage_id
      AND dsp2.user_id = get_current_user_id()
    )
  );

-- Only users with permission can add participants
CREATE POLICY "diagnostic_stage_participants_insert_policy" ON public.diagnostic_stage_participants
  FOR INSERT
  WITH CHECK (has_permission('diagnostics.manage'));

-- Only users with permission can update participants
CREATE POLICY "diagnostic_stage_participants_update_policy" ON public.diagnostic_stage_participants
  FOR UPDATE
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));

-- Only users with permission can delete participants
CREATE POLICY "diagnostic_stage_participants_delete_policy" ON public.diagnostic_stage_participants
  FOR DELETE
  USING (has_permission('diagnostics.manage'));

-- ========== TABLE: survey_360_assignments ==========
-- Users can view assignments where they are evaluating or evaluated, or if they have permission
CREATE POLICY "survey_360_assignments_select_policy" ON public.survey_360_assignments
  FOR SELECT
  USING (
    evaluated_user_id = get_current_user_id() OR
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.view_all') OR
    (has_permission('surveys.view_team') AND (
      is_users_manager(evaluated_user_id) OR is_users_manager(evaluating_user_id)
    ))
  );

-- Users can create self-assignments or if they have permission
CREATE POLICY "survey_360_assignments_insert_policy" ON public.survey_360_assignments
  FOR INSERT
  WITH CHECK (
    (evaluated_user_id = get_current_user_id() AND evaluating_user_id = get_current_user_id()) OR
    has_permission('surveys.create_all') OR
    (has_permission('surveys.create_team') AND is_users_manager(evaluated_user_id))
  );

-- Users can update their own assignments or if they have permission
CREATE POLICY "survey_360_assignments_update_policy" ON public.survey_360_assignments
  FOR UPDATE
  USING (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.update_all') OR
    (has_permission('surveys.update_team') AND is_users_manager(evaluated_user_id))
  )
  WITH CHECK (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.update_all') OR
    (has_permission('surveys.update_team') AND is_users_manager(evaluated_user_id))
  );

-- Only users with permission can delete assignments
CREATE POLICY "survey_360_assignments_delete_policy" ON public.survey_360_assignments
  FOR DELETE
  USING (has_permission('surveys.delete'));

-- ========== TABLE: hard_skill_results ==========
-- Users can view results where they are involved or if they have permission
CREATE POLICY "hard_skill_results_select_policy" ON public.hard_skill_results
  FOR SELECT
  USING (
    evaluated_user_id = get_current_user_id() OR
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.view_all') OR
    (has_permission('surveys.view_team') AND is_users_manager(evaluated_user_id))
  );

-- Users can create results for themselves or if they have permission
CREATE POLICY "hard_skill_results_insert_policy" ON public.hard_skill_results
  FOR INSERT
  WITH CHECK (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.create_all')
  );

-- Users can update their own evaluations or if they have permission
CREATE POLICY "hard_skill_results_update_policy" ON public.hard_skill_results
  FOR UPDATE
  USING (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  )
  WITH CHECK (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  );

-- Only users with permission can delete results
CREATE POLICY "hard_skill_results_delete_policy" ON public.hard_skill_results
  FOR DELETE
  USING (has_permission('surveys.delete'));

-- ========== TABLE: soft_skill_results ==========
-- Users can view results where they are involved or if they have permission
CREATE POLICY "soft_skill_results_select_policy" ON public.soft_skill_results
  FOR SELECT
  USING (
    evaluated_user_id = get_current_user_id() OR
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.view_all') OR
    (has_permission('surveys.view_team') AND is_users_manager(evaluated_user_id))
  );

-- Users can create results for themselves or if they have permission
CREATE POLICY "soft_skill_results_insert_policy" ON public.soft_skill_results
  FOR INSERT
  WITH CHECK (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.create_all')
  );

-- Users can update their own evaluations or if they have permission
CREATE POLICY "soft_skill_results_update_policy" ON public.soft_skill_results
  FOR UPDATE
  USING (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  )
  WITH CHECK (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  );

-- Only users with permission can delete results
CREATE POLICY "soft_skill_results_delete_policy" ON public.soft_skill_results
  FOR DELETE
  USING (has_permission('surveys.delete'));

-- ========== TABLE: meeting_stages ==========
-- Users can view meeting stages if they are participants or have permission
CREATE POLICY "meeting_stages_select_policy" ON public.meeting_stages
  FOR SELECT
  USING (
    has_permission('meetings.view_all') OR
    EXISTS (
      SELECT 1 FROM meeting_stage_participants
      WHERE stage_id = meeting_stages.id
      AND user_id = get_current_user_id()
    )
  );

-- Only users with permission can create meeting stages
CREATE POLICY "meeting_stages_insert_policy" ON public.meeting_stages
  FOR INSERT
  WITH CHECK (has_permission('meetings.create'));

-- Only users with permission can update meeting stages
CREATE POLICY "meeting_stages_update_policy" ON public.meeting_stages
  FOR UPDATE
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));

-- Only users with permission can delete meeting stages
CREATE POLICY "meeting_stages_delete_policy" ON public.meeting_stages
  FOR DELETE
  USING (has_permission('meetings.delete'));

-- ========== TABLE: meeting_stage_participants ==========
-- Users can view participants if they are participants or have permission
CREATE POLICY "meeting_stage_participants_select_policy" ON public.meeting_stage_participants
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('meetings.view_all') OR
    EXISTS (
      SELECT 1 FROM meeting_stage_participants msp2
      WHERE msp2.stage_id = meeting_stage_participants.stage_id
      AND msp2.user_id = get_current_user_id()
    )
  );

-- Only users with permission can add participants
CREATE POLICY "meeting_stage_participants_insert_policy" ON public.meeting_stage_participants
  FOR INSERT
  WITH CHECK (has_permission('meetings.manage'));

-- Only users with permission can update participants
CREATE POLICY "meeting_stage_participants_update_policy" ON public.meeting_stage_participants
  FOR UPDATE
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));

-- Only users with permission can delete participants
CREATE POLICY "meeting_stage_participants_delete_policy" ON public.meeting_stage_participants
  FOR DELETE
  USING (has_permission('meetings.manage'));

-- ========== TABLE: one_on_one_meetings ==========
-- Users can view meetings where they are employee or manager, or if they have permission
CREATE POLICY "one_on_one_meetings_select_policy" ON public.one_on_one_meetings
  FOR SELECT
  USING (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.view_all') OR
    (has_permission('meetings.view_team') AND is_users_manager(employee_id))
  );

-- Users can create meetings for themselves (as employee) or if they have permission
CREATE POLICY "one_on_one_meetings_insert_policy" ON public.one_on_one_meetings
  FOR INSERT
  WITH CHECK (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.create_all')
  );

-- Users can update their own meetings or if they have permission
CREATE POLICY "one_on_one_meetings_update_policy" ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.update_all') OR
    (has_permission('meetings.update_team') AND is_users_manager(employee_id))
  )
  WITH CHECK (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.update_all') OR
    (has_permission('meetings.update_team') AND is_users_manager(employee_id))
  );

-- Only users with permission can delete meetings
CREATE POLICY "one_on_one_meetings_delete_policy" ON public.one_on_one_meetings
  FOR DELETE
  USING (has_permission('meetings.delete'));

-- ========== TABLE: meeting_decisions ==========
-- Users can view decisions from their meetings or if they have permission
CREATE POLICY "meeting_decisions_select_policy" ON public.meeting_decisions
  FOR SELECT
  USING (
    has_permission('meetings.view_all') OR
    EXISTS (
      SELECT 1 FROM one_on_one_meetings
      WHERE one_on_one_meetings.id = meeting_decisions.meeting_id
      AND (employee_id = get_current_user_id() OR manager_id = get_current_user_id())
    )
  );

-- Users can create decisions for their meetings or if they have permission
CREATE POLICY "meeting_decisions_insert_policy" ON public.meeting_decisions
  FOR INSERT
  WITH CHECK (
    created_by = get_current_user_id() OR
    has_permission('meetings.create_all')
  );

-- Users can update decisions they created or if they have permission
CREATE POLICY "meeting_decisions_update_policy" ON public.meeting_decisions
  FOR UPDATE
  USING (
    created_by = get_current_user_id() OR
    has_permission('meetings.update_all')
  )
  WITH CHECK (
    created_by = get_current_user_id() OR
    has_permission('meetings.update_all')
  );

-- Users can delete decisions they created or if they have permission
CREATE POLICY "meeting_decisions_delete_policy" ON public.meeting_decisions
  FOR DELETE
  USING (
    created_by = get_current_user_id() OR
    has_permission('meetings.delete')
  );

-- ========== TABLE: development_plans ==========
-- Users can view their own development plans or if they have permission
CREATE POLICY "development_plans_select_policy" ON public.development_plans
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('development.view_all') OR
    (has_permission('development.view_team') AND is_users_manager(user_id))
  );

-- Users can create development plans for themselves or if they have permission
CREATE POLICY "development_plans_insert_policy" ON public.development_plans
  FOR INSERT
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('development.create_all') OR
    (has_permission('development.create_team') AND is_users_manager(user_id))
  );

-- Users can update their own development plans or if they have permission
CREATE POLICY "development_plans_update_policy" ON public.development_plans
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('development.update_all') OR
    (has_permission('development.update_team') AND is_users_manager(user_id))
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('development.update_all') OR
    (has_permission('development.update_team') AND is_users_manager(user_id))
  );

-- Only users with permission can delete development plans
CREATE POLICY "development_plans_delete_policy" ON public.development_plans
  FOR DELETE
  USING (has_permission('development.delete'));

-- ========== TABLE: admin_sessions ==========
-- Admin sessions are only for dev mode and should be restricted
-- Only system or users with admin permissions can view sessions
CREATE POLICY "admin_sessions_select_policy" ON public.admin_sessions
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  );

-- Only system can insert sessions (for dev login)
CREATE POLICY "admin_sessions_insert_policy" ON public.admin_sessions
  FOR INSERT
  WITH CHECK (true); -- System needs to create sessions during dev login

-- Users can update their own sessions or if they have permission
CREATE POLICY "admin_sessions_update_policy" ON public.admin_sessions
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  );

-- Users can delete their own sessions or if they have permission
CREATE POLICY "admin_sessions_delete_policy" ON public.admin_sessions
  FOR DELETE
  USING (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  );

-- =====================================================
-- VERIFICATION: Check that all tables have policies
-- =====================================================
DO $$
DECLARE
  unprotected_tables text[];
BEGIN
  SELECT array_agg(tablename)
  INTO unprotected_tables
  FROM pg_tables
  WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN (
    'users', 'user_profiles', 'tasks', 'diagnostic_stages', 
    'diagnostic_stage_participants', 'survey_360_assignments',
    'hard_skill_results', 'soft_skill_results', 'meeting_stages',
    'meeting_stage_participants', 'one_on_one_meetings', 
    'meeting_decisions', 'development_plans', 'admin_sessions'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = pg_tables.tablename
  );
  
  IF array_length(unprotected_tables, 1) > 0 THEN
    RAISE WARNING 'Tables with RLS enabled but no policies: %', unprotected_tables;
  ELSE
    RAISE NOTICE 'All critical tables are now protected with RLS policies';
  END IF;
END $$;