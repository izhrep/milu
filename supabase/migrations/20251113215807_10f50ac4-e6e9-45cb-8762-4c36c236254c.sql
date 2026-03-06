-- ============================================
-- MIGRATION: Switch to Supabase Auth
-- ============================================

-- 1. Drop custom auth tables and functions
DROP TABLE IF EXISTS admin_sessions CASCADE;
DROP TABLE IF EXISTS auth_users CASCADE;

-- 2. Remove auth_user_id field from users if exists
ALTER TABLE users DROP COLUMN IF EXISTS auth_user_id CASCADE;

-- 3. Create or replace get_current_user_id() to use auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- 4. Create function to check if user has permission (updated to use auth.uid())
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Admin has all permissions
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check if user has the specific permission
  RETURN EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = _permission_name
  );
END;
$$;

-- 5. Create trigger function to auto-create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 6. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Update RLS policies for users table
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_select_temp_policy ON users;
CREATE POLICY users_select_auth_policy ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see themselves
    id = auth.uid()
    -- Or if they have users.view permission
    OR has_permission('users.view')
    -- Or if they have team.view permission and share the same manager
    OR (
      has_permission('team.view') 
      AND manager_id = (SELECT manager_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS users_update_temp_policy ON users;
CREATE POLICY users_update_auth_policy ON users
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR has_permission('users.manage')
  )
  WITH CHECK (
    id = auth.uid()
    OR has_permission('users.manage')
  );

DROP POLICY IF EXISTS users_insert_temp_policy ON users;
CREATE POLICY users_insert_auth_policy ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('users.manage'));

-- 8. Update RLS for user_profiles
DROP POLICY IF EXISTS user_profiles_select_temp_policy ON user_profiles;
CREATE POLICY user_profiles_select_auth_policy ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('users.view')
  );

DROP POLICY IF EXISTS user_profiles_update_temp_policy ON user_profiles;
CREATE POLICY user_profiles_update_auth_policy ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('users.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('users.manage'));

DROP POLICY IF EXISTS user_profiles_insert_temp_policy ON user_profiles;
CREATE POLICY user_profiles_insert_auth_policy ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_permission('users.manage'));

-- 9. Update RLS for tasks
DROP POLICY IF EXISTS tasks_select_temp_policy ON tasks;
CREATE POLICY tasks_select_auth_policy ON tasks
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('tasks.view_all')
  );

DROP POLICY IF EXISTS tasks_update_temp_policy ON tasks;
CREATE POLICY tasks_update_auth_policy ON tasks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('tasks.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('tasks.manage'));

DROP POLICY IF EXISTS tasks_insert_temp_policy ON tasks;
CREATE POLICY tasks_insert_auth_policy ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_permission('tasks.manage'));

-- 10. Update RLS for survey_360_assignments
DROP POLICY IF EXISTS survey_360_assignments_select_temp_policy ON survey_360_assignments;
CREATE POLICY survey_360_assignments_select_auth_policy ON survey_360_assignments
  FOR SELECT
  TO authenticated
  USING (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  );

DROP POLICY IF EXISTS survey_360_assignments_insert_temp_policy ON survey_360_assignments;
CREATE POLICY survey_360_assignments_insert_auth_policy ON survey_360_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluated_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  );

DROP POLICY IF EXISTS survey_360_assignments_update_temp_policy ON survey_360_assignments;
CREATE POLICY survey_360_assignments_update_auth_policy ON survey_360_assignments
  FOR UPDATE
  TO authenticated
  USING (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  )
  WITH CHECK (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  );

-- 11. Update RLS for hard_skill_results
DROP POLICY IF EXISTS hard_skill_results_select_temp_policy ON hard_skill_results;
CREATE POLICY hard_skill_results_select_auth_policy ON hard_skill_results
  FOR SELECT
  TO authenticated
  USING (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.view_all')
  );

DROP POLICY IF EXISTS hard_skill_results_insert_temp_policy ON hard_skill_results;
CREATE POLICY hard_skill_results_insert_auth_policy ON hard_skill_results
  FOR INSERT
  TO authenticated
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS hard_skill_results_update_temp_policy ON hard_skill_results;
CREATE POLICY hard_skill_results_update_auth_policy ON hard_skill_results
  FOR UPDATE
  TO authenticated
  USING (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'))
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));

-- 12. Update RLS for soft_skill_results
DROP POLICY IF EXISTS soft_skill_results_select_temp_policy ON soft_skill_results;
CREATE POLICY soft_skill_results_select_auth_policy ON soft_skill_results
  FOR SELECT
  TO authenticated
  USING (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.view_all')
  );

DROP POLICY IF EXISTS soft_skill_results_insert_temp_policy ON soft_skill_results;
CREATE POLICY soft_skill_results_insert_auth_policy ON soft_skill_results
  FOR INSERT
  TO authenticated
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS soft_skill_results_update_temp_policy ON soft_skill_results;
CREATE POLICY soft_skill_results_update_auth_policy ON soft_skill_results
  FOR UPDATE
  TO authenticated
  USING (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'))
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));

-- 13. Update RLS for diagnostic_stages
DROP POLICY IF EXISTS diagnostic_stages_select_temp_policy ON diagnostic_stages;
CREATE POLICY diagnostic_stages_select_auth_policy ON diagnostic_stages
  FOR SELECT
  TO authenticated
  USING (
    is_diagnostic_stage_participant(id, auth.uid())
    OR has_permission('diagnostics.manage')
  );

DROP POLICY IF EXISTS diagnostic_stages_insert_temp_policy ON diagnostic_stages;
CREATE POLICY diagnostic_stages_insert_auth_policy ON diagnostic_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS diagnostic_stages_update_temp_policy ON diagnostic_stages;
CREATE POLICY diagnostic_stages_update_auth_policy ON diagnostic_stages
  FOR UPDATE
  TO authenticated
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));

-- 14. Update RLS for diagnostic_stage_participants
DROP POLICY IF EXISTS diagnostic_stage_participants_select_temp_policy ON diagnostic_stage_participants;
CREATE POLICY diagnostic_stage_participants_select_auth_policy ON diagnostic_stage_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  );

DROP POLICY IF EXISTS diagnostic_stage_participants_insert_temp_policy ON diagnostic_stage_participants;
CREATE POLICY diagnostic_stage_participants_insert_auth_policy ON diagnostic_stage_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS diagnostic_stage_participants_delete_temp_policy ON diagnostic_stage_participants;
CREATE POLICY diagnostic_stage_participants_delete_auth_policy ON diagnostic_stage_participants
  FOR DELETE
  TO authenticated
  USING (has_permission('diagnostics.manage'));

-- 15. Update RLS for meeting_stages
DROP POLICY IF EXISTS meeting_stages_select_temp_policy ON meeting_stages;
CREATE POLICY meeting_stages_select_auth_policy ON meeting_stages
  FOR SELECT
  TO authenticated
  USING (
    is_meeting_stage_participant(id, auth.uid())
    OR has_permission('meetings.manage')
  );

DROP POLICY IF EXISTS meeting_stages_insert_temp_policy ON meeting_stages;
CREATE POLICY meeting_stages_insert_auth_policy ON meeting_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('meetings.manage'));

DROP POLICY IF EXISTS meeting_stages_update_temp_policy ON meeting_stages;
CREATE POLICY meeting_stages_update_auth_policy ON meeting_stages
  FOR UPDATE
  TO authenticated
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));

-- 16. Update RLS for meeting_stage_participants
DROP POLICY IF EXISTS meeting_stage_participants_select_temp_policy ON meeting_stage_participants;
CREATE POLICY meeting_stage_participants_select_auth_policy ON meeting_stage_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('meetings.manage')
  );

DROP POLICY IF EXISTS meeting_stage_participants_insert_temp_policy ON meeting_stage_participants;
CREATE POLICY meeting_stage_participants_insert_auth_policy ON meeting_stage_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('meetings.manage'));

-- 17. Update RLS for one_on_one_meetings
DROP POLICY IF EXISTS one_on_one_meetings_select_temp_policy ON one_on_one_meetings;
CREATE POLICY one_on_one_meetings_select_auth_policy ON one_on_one_meetings
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.view_all')
  );

DROP POLICY IF EXISTS one_on_one_meetings_insert_temp_policy ON one_on_one_meetings;
CREATE POLICY one_on_one_meetings_insert_auth_policy ON one_on_one_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  );

DROP POLICY IF EXISTS one_on_one_meetings_update_temp_policy ON one_on_one_meetings;
CREATE POLICY one_on_one_meetings_update_auth_policy ON one_on_one_meetings
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  );

-- 18. Update RLS for development_plans
DROP POLICY IF EXISTS development_plans_select_temp_policy ON development_plans;
CREATE POLICY development_plans_select_auth_policy ON development_plans
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('development.view_all')
  );

DROP POLICY IF EXISTS development_plans_insert_temp_policy ON development_plans;
CREATE POLICY development_plans_insert_auth_policy ON development_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_permission('development.manage'));

DROP POLICY IF EXISTS development_plans_update_temp_policy ON development_plans;
CREATE POLICY development_plans_update_auth_policy ON development_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('development.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('development.manage'));

-- 19. Update RLS for user_career_progress
DROP POLICY IF EXISTS user_career_progress_select_temp_policy ON user_career_progress;
CREATE POLICY user_career_progress_select_auth_policy ON user_career_progress
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('career.view_all')
  );

DROP POLICY IF EXISTS user_career_progress_insert_temp_policy ON user_career_progress;
CREATE POLICY user_career_progress_insert_auth_policy ON user_career_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_permission('career.manage'));

DROP POLICY IF EXISTS user_career_progress_update_temp_policy ON user_career_progress;
CREATE POLICY user_career_progress_update_auth_policy ON user_career_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('career.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('career.manage'));

-- 20. Update RLS for user_career_ratings
DROP POLICY IF EXISTS user_career_ratings_select_temp_policy ON user_career_ratings;
CREATE POLICY user_career_ratings_select_auth_policy ON user_career_ratings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('career.view_all')
  );

DROP POLICY IF EXISTS user_career_ratings_insert_temp_policy ON user_career_ratings;
CREATE POLICY user_career_ratings_insert_auth_policy ON user_career_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission('career.manage'));

-- 21. Update RLS for meeting_decisions
DROP POLICY IF EXISTS meeting_decisions_select_temp_policy ON meeting_decisions;
CREATE POLICY meeting_decisions_select_auth_policy ON meeting_decisions
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
        AND (m.employee_id = auth.uid() OR m.manager_id = auth.uid())
    )
    OR has_permission('meetings.view_all')
  );

DROP POLICY IF EXISTS meeting_decisions_insert_temp_policy ON meeting_decisions;
CREATE POLICY meeting_decisions_insert_auth_policy ON meeting_decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR has_permission('meetings.manage'));

DROP POLICY IF EXISTS meeting_decisions_update_temp_policy ON meeting_decisions;
CREATE POLICY meeting_decisions_update_auth_policy ON meeting_decisions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR has_permission('meetings.manage'))
  WITH CHECK (created_by = auth.uid() OR has_permission('meetings.manage'));

-- 22. Update RLS for user_kpi_results
DROP POLICY IF EXISTS user_kpi_results_select_temp_policy ON user_kpi_results;
CREATE POLICY user_kpi_results_select_auth_policy ON user_kpi_results
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('kpi.view_all')
  );

DROP POLICY IF EXISTS user_kpi_results_insert_temp_policy ON user_kpi_results;
CREATE POLICY user_kpi_results_insert_auth_policy ON user_kpi_results
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_permission('kpi.manage'));

DROP POLICY IF EXISTS user_kpi_results_update_temp_policy ON user_kpi_results;
CREATE POLICY user_kpi_results_update_auth_policy ON user_kpi_results
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('kpi.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('kpi.manage'));