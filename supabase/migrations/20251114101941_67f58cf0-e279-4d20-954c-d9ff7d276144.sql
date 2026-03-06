
-- =============================================
-- ПОЛНАЯ ОЧИСТКА И ВОССТАНОВЛЕНИЕ СИСТЕМЫ АВТОРИЗАЦИИ
-- =============================================

-- ============================================= 
-- ШАГ 1: Удаление ВСЕХ старых версий has_permission с CASCADE
-- =============================================

DROP FUNCTION IF EXISTS public.has_permission(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(_user_id uuid, _permission_name text) CASCADE;

-- ============================================= 
-- ШАГ 2: Удаление устаревшей функции get_current_user_id
-- =============================================

DROP FUNCTION IF EXISTS public.get_current_user_id() CASCADE;

-- ============================================= 
-- ШАГ 3: Создание ЕДИНСТВЕННОЙ корректной версии has_permission
-- =============================================

CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Получаем роль пользователя
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Администратор имеет ВСЕ права
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Проверяем конкретное разрешение через user_effective_permissions
  RETURN EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = _permission_name
  );
END;
$$;

-- ============================================= 
-- ШАГ 4: Пересоздание RLS политик для user_effective_permissions
-- =============================================

DROP POLICY IF EXISTS "Users can view their own effective permissions" ON public.user_effective_permissions;

CREATE POLICY "Users can view their own effective permissions"
ON public.user_effective_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================= 
-- ШАГ 5: Пересоздание RLS политик для users
-- =============================================

DROP POLICY IF EXISTS "Users can view user records" ON public.users;
DROP POLICY IF EXISTS "Users can view all user records" ON public.users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy"
ON public.users
FOR SELECT
USING (
  -- Пользователь видит свою запись
  auth.uid() = id
  OR
  -- Или имеет право просмотра всех пользователей
  has_permission('view_users')
);

DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy"
ON public.users
FOR INSERT
WITH CHECK (has_permission('users.manage'));

DROP POLICY IF EXISTS "users_update_policy" ON public.users;

CREATE POLICY "users_update_policy"
ON public.users
FOR UPDATE
USING (
  -- Пользователь обновляет свою запись
  auth.uid() = id
  OR
  -- Или имеет право управления пользователями
  has_permission('users.manage')
);

-- ============================================= 
-- ШАГ 6: Пересоздание RLS политик для user_roles
-- =============================================

DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "user_roles_select_policy"
ON public.user_roles
FOR SELECT
USING (
  -- Пользователь видит свою роль
  auth.uid() = user_id
  OR
  -- Или имеет право просмотра всех пользователей
  has_permission('view_users')
);

-- ============================================= 
-- ШАГ 7: Пересоздание RLS политик для tasks
-- =============================================

DROP POLICY IF EXISTS "tasks_select_auth_policy" ON public.tasks;

CREATE POLICY "tasks_select_auth_policy"
ON public.tasks
FOR SELECT
USING (
  -- Задача назначена пользователю
  user_id = auth.uid()
  OR
  -- Или пользователь — руководитель владельца задачи
  is_users_manager(user_id)
  OR
  -- Или имеет право просмотра всех задач
  has_permission('tasks.view_all')
);

DROP POLICY IF EXISTS "tasks_insert_auth_policy" ON public.tasks;

CREATE POLICY "tasks_insert_auth_policy"
ON public.tasks
FOR INSERT
WITH CHECK (
  -- Создаёт задачу для себя
  user_id = auth.uid()
  OR
  -- Или имеет право управления задачами
  has_permission('tasks.manage')
);

DROP POLICY IF EXISTS "tasks_update_auth_policy" ON public.tasks;

CREATE POLICY "tasks_update_auth_policy"
ON public.tasks
FOR UPDATE
USING (
  -- Обновляет свою задачу
  user_id = auth.uid()
  OR
  -- Или руководитель владельца задачи
  is_users_manager(user_id)
  OR
  -- Или имеет право управления задачами
  has_permission('tasks.manage')
);

DROP POLICY IF EXISTS "tasks_delete_auth_policy" ON public.tasks;

CREATE POLICY "tasks_delete_auth_policy"
ON public.tasks
FOR DELETE
USING (has_permission('tasks.manage'));

-- ============================================= 
-- ШАГ 8: Пересоздание RLS политик для development_plans
-- =============================================

DROP POLICY IF EXISTS "development_plans_select_auth_policy" ON public.development_plans;

CREATE POLICY "development_plans_select_auth_policy"
ON public.development_plans
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  has_permission('development.view_all')
);

DROP POLICY IF EXISTS "development_plans_insert_auth_policy" ON public.development_plans;

CREATE POLICY "development_plans_insert_auth_policy"
ON public.development_plans
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR
  has_permission('development.manage')
);

DROP POLICY IF EXISTS "development_plans_update_auth_policy" ON public.development_plans;

CREATE POLICY "development_plans_update_auth_policy"
ON public.development_plans
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  has_permission('development.manage')
);

-- ============================================= 
-- ШАГ 9: Пересоздание RLS политик для diagnostic_stages
-- =============================================

DROP POLICY IF EXISTS "diagnostic_stages_select_auth_policy" ON public.diagnostic_stages;

CREATE POLICY "diagnostic_stages_select_auth_policy"
ON public.diagnostic_stages
FOR SELECT
USING (
  is_diagnostic_stage_participant(id, auth.uid())
  OR
  has_permission('diagnostics.manage')
);

DROP POLICY IF EXISTS "diagnostic_stages_insert_auth_policy" ON public.diagnostic_stages;

CREATE POLICY "diagnostic_stages_insert_auth_policy"
ON public.diagnostic_stages
FOR INSERT
WITH CHECK (has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS "diagnostic_stages_update_auth_policy" ON public.diagnostic_stages;

CREATE POLICY "diagnostic_stages_update_auth_policy"
ON public.diagnostic_stages
FOR UPDATE
USING (has_permission('diagnostics.manage'));

-- ============================================= 
-- ШАГ 10: Пересоздание RLS политик для diagnostic_stage_participants
-- =============================================

DROP POLICY IF EXISTS "diagnostic_stage_participants_select_auth_policy" ON public.diagnostic_stage_participants;

CREATE POLICY "diagnostic_stage_participants_select_auth_policy"
ON public.diagnostic_stage_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);

DROP POLICY IF EXISTS "diagnostic_stage_participants_insert_auth_policy" ON public.diagnostic_stage_participants;

CREATE POLICY "diagnostic_stage_participants_insert_auth_policy"
ON public.diagnostic_stage_participants
FOR INSERT
WITH CHECK (has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS "diagnostic_stage_participants_update_auth_policy" ON public.diagnostic_stage_participants;

CREATE POLICY "diagnostic_stage_participants_update_auth_policy"
ON public.diagnostic_stage_participants
FOR UPDATE
USING (has_permission('diagnostics.manage'));

DROP POLICY IF EXISTS "diagnostic_stage_participants_delete_auth_policy" ON public.diagnostic_stage_participants;

CREATE POLICY "diagnostic_stage_participants_delete_auth_policy"
ON public.diagnostic_stage_participants
FOR DELETE
USING (has_permission('diagnostics.manage'));

-- ============================================= 
-- ШАГ 11: Пересоздание RLS политик для meeting_stages
-- =============================================

DROP POLICY IF EXISTS "meeting_stages_select_auth_policy" ON public.meeting_stages;

CREATE POLICY "meeting_stages_select_auth_policy"
ON public.meeting_stages
FOR SELECT
USING (
  is_meeting_stage_participant(id, auth.uid())
  OR
  has_permission('meetings.manage')
);

DROP POLICY IF EXISTS "meeting_stages_insert_auth_policy" ON public.meeting_stages;

CREATE POLICY "meeting_stages_insert_auth_policy"
ON public.meeting_stages
FOR INSERT
WITH CHECK (has_permission('meetings.manage'));

DROP POLICY IF EXISTS "meeting_stages_update_auth_policy" ON public.meeting_stages;

CREATE POLICY "meeting_stages_update_auth_policy"
ON public.meeting_stages
FOR UPDATE
USING (has_permission('meetings.manage'));

-- ============================================= 
-- ШАГ 12: Пересоздание RLS политик для meeting_stage_participants
-- =============================================

DROP POLICY IF EXISTS "meeting_stage_participants_select_auth_policy" ON public.meeting_stage_participants;

CREATE POLICY "meeting_stage_participants_select_auth_policy"
ON public.meeting_stage_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  has_permission('meetings.manage')
);

DROP POLICY IF EXISTS "meeting_stage_participants_insert_auth_policy" ON public.meeting_stage_participants;

CREATE POLICY "meeting_stage_participants_insert_auth_policy"
ON public.meeting_stage_participants
FOR INSERT
WITH CHECK (has_permission('meetings.manage'));

DROP POLICY IF EXISTS "meeting_stage_participants_delete_auth_policy" ON public.meeting_stage_participants;

CREATE POLICY "meeting_stage_participants_delete_auth_policy"
ON public.meeting_stage_participants
FOR DELETE
USING (has_permission('meetings.manage'));

-- ============================================= 
-- ШАГ 13: Пересоздание RLS политик для one_on_one_meetings
-- =============================================

DROP POLICY IF EXISTS "one_on_one_meetings_select_auth_policy" ON public.one_on_one_meetings;

CREATE POLICY "one_on_one_meetings_select_auth_policy"
ON public.one_on_one_meetings
FOR SELECT
USING (
  employee_id = auth.uid()
  OR
  manager_id = auth.uid()
  OR
  has_permission('meetings.view_all')
);

DROP POLICY IF EXISTS "one_on_one_meetings_update_auth_policy" ON public.one_on_one_meetings;

CREATE POLICY "one_on_one_meetings_update_auth_policy"
ON public.one_on_one_meetings
FOR UPDATE
USING (
  employee_id = auth.uid()
  OR
  manager_id = auth.uid()
  OR
  has_permission('meetings.manage')
);

-- ============================================= 
-- ШАГ 14: Пересоздание RLS политик для meeting_decisions
-- =============================================

DROP POLICY IF EXISTS "meeting_decisions_select_auth_policy" ON public.meeting_decisions;

CREATE POLICY "meeting_decisions_select_auth_policy"
ON public.meeting_decisions
FOR SELECT
USING (
  is_meeting_participant(meeting_id, auth.uid())
  OR
  has_permission('meetings.view_all')
);

DROP POLICY IF EXISTS "meeting_decisions_insert_auth_policy" ON public.meeting_decisions;

CREATE POLICY "meeting_decisions_insert_auth_policy"
ON public.meeting_decisions
FOR INSERT
WITH CHECK (
  is_meeting_participant(meeting_id, auth.uid())
  OR
  has_permission('meetings.manage')
);

DROP POLICY IF EXISTS "meeting_decisions_update_auth_policy" ON public.meeting_decisions;

CREATE POLICY "meeting_decisions_update_auth_policy"
ON public.meeting_decisions
FOR UPDATE
USING (
  is_meeting_participant(meeting_id, auth.uid())
  OR
  has_permission('meetings.manage')
);

-- ============================================= 
-- ШАГ 15: Пересоздание RLS политик для survey_360_assignments
-- =============================================

DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON public.survey_360_assignments;

CREATE POLICY "survey_360_assignments_select_auth_policy"
ON public.survey_360_assignments
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.view_all')
);

DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON public.survey_360_assignments;

CREATE POLICY "survey_360_assignments_update_auth_policy"
ON public.survey_360_assignments
FOR UPDATE
USING (
  evaluated_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);

-- ============================================= 
-- ШАГ 16: Пересоздание RLS политик для hard_skill_results
-- =============================================

DROP POLICY IF EXISTS "hard_skill_results_select_auth_policy" ON public.hard_skill_results;

CREATE POLICY "hard_skill_results_select_auth_policy"
ON public.hard_skill_results
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.view_all')
);

DROP POLICY IF EXISTS "hard_skill_results_insert_auth_policy" ON public.hard_skill_results;

CREATE POLICY "hard_skill_results_insert_auth_policy"
ON public.hard_skill_results
FOR INSERT
WITH CHECK (evaluating_user_id = auth.uid());

DROP POLICY IF EXISTS "hard_skill_results_update_auth_policy" ON public.hard_skill_results;

CREATE POLICY "hard_skill_results_update_auth_policy"
ON public.hard_skill_results
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);

-- ============================================= 
-- ШАГ 17: Пересоздание RLS политик для soft_skill_results
-- =============================================

DROP POLICY IF EXISTS "soft_skill_results_select_auth_policy" ON public.soft_skill_results;

CREATE POLICY "soft_skill_results_select_auth_policy"
ON public.soft_skill_results
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.view_all')
);

DROP POLICY IF EXISTS "soft_skill_results_insert_auth_policy" ON public.soft_skill_results;

CREATE POLICY "soft_skill_results_insert_auth_policy"
ON public.soft_skill_results
FOR INSERT
WITH CHECK (evaluating_user_id = auth.uid());

DROP POLICY IF EXISTS "soft_skill_results_update_auth_policy" ON public.soft_skill_results;

CREATE POLICY "soft_skill_results_update_auth_policy"
ON public.soft_skill_results
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);

-- ============================================= 
-- ШАГ 18: Пересоздание RLS политик для user_assessment_results
-- =============================================

DROP POLICY IF EXISTS "user_assessment_results_select_auth_policy" ON public.user_assessment_results;

CREATE POLICY "user_assessment_results_select_auth_policy"
ON public.user_assessment_results
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  is_users_manager(user_id)
  OR
  has_permission('diagnostics.view_all')
);

-- ============================================= 
-- ФИНАЛЬНАЯ ПРОВЕРКА
-- =============================================

-- Проверяем, что осталась только одна версия has_permission
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'has_permission';
  
  IF func_count != 1 THEN
    RAISE EXCEPTION 'Ошибка: обнаружено % версий has_permission, ожидается 1', func_count;
  END IF;
  
  RAISE NOTICE 'Проверка пройдена: существует ровно 1 версия has_permission';
END $$;
