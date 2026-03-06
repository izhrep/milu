-- =====================================
-- УДАЛЕНИЕ ОСТАВШИХСЯ НЕБЕЗОПАСНЫХ ПОЛИТИК
-- =====================================

-- ТАБЛИЦА: users - Удаление старых публичных политик
DROP POLICY IF EXISTS "Allow all users to be read for surveys" ON public.users;
DROP POLICY IF EXISTS "Allow users operations for admin panel" ON public.users;

-- Проверка других критичных таблиц на старые политики

-- ТАБЛИЦА: admin_sessions
DROP POLICY IF EXISTS "Allow admin_sessions operations for testing" ON public.admin_sessions;

-- ТАБЛИЦА: auth_users  
DROP POLICY IF EXISTS "Allow all auth_users operations" ON public.auth_users;

-- ТАБЛИЦА: user_profiles
DROP POLICY IF EXISTS "Allow all user_profiles operations" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow user_profiles operations for admin panel" ON public.user_profiles;

-- ТАБЛИЦА: admin_activity_logs
DROP POLICY IF EXISTS "Allow all admin_activity_logs operations" ON public.admin_activity_logs;

-- ТАБЛИЦА: hard_skill_results
DROP POLICY IF EXISTS "Allow all hard_skill_results operations" ON public.hard_skill_results;

-- ТАБЛИЦА: soft_skill_results
DROP POLICY IF EXISTS "Allow all soft_skill_results operations" ON public.soft_skill_results;

-- ТАБЛИЦА: survey_360_assignments
DROP POLICY IF EXISTS "Allow all survey_360_assignments operations" ON public.survey_360_assignments;

-- ТАБЛИЦА: diagnostic_stages
DROP POLICY IF EXISTS "Allow all diagnostic_stages operations" ON public.diagnostic_stages;

-- ТАБЛИЦА: diagnostic_stage_participants
DROP POLICY IF EXISTS "Allow all diagnostic_stage_participants operations" ON public.diagnostic_stage_participants;

-- ТАБЛИЦА: one_on_one_meetings
DROP POLICY IF EXISTS "Allow all one_on_one_meetings operations" ON public.one_on_one_meetings;

-- ТАБЛИЦА: meeting_decisions
DROP POLICY IF EXISTS "Allow all meeting_decisions operations" ON public.meeting_decisions;
DROP POLICY IF EXISTS "Users can manage meeting decisions" ON public.meeting_decisions;

-- ТАБЛИЦА: tasks
DROP POLICY IF EXISTS "Allow all tasks operations" ON public.tasks;

-- Добавление недостающей политики для meeting_decisions с правильной логикой
CREATE POLICY "meeting_decisions_select_participants"
ON public.meeting_decisions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
));

CREATE POLICY "meeting_decisions_insert_participants"
ON public.meeting_decisions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
));

CREATE POLICY "meeting_decisions_update_participants"
ON public.meeting_decisions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
));

CREATE POLICY "meeting_decisions_delete_participants"
ON public.meeting_decisions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
));

CREATE POLICY "meeting_decisions_all_admin"
ON public.meeting_decisions FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());