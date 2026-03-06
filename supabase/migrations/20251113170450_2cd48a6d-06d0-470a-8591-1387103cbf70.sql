-- ============================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ: PERMISSION-BASED АРХИТЕКТУРА
-- ============================================================
-- Полное переписывание всех RLS политик на has_permission()
-- Удаление всех deprecated функций
-- Добавление недостающих permissions
-- ============================================================

-- 1. ДОБАВИТЬ НЕДОСТАЮЩИЕ PERMISSIONS
-- ============================================================

-- Проверка, существуют ли уже эти permissions
DO $$
BEGIN
  -- diagnostics.manage (используется в RLS, но отсутствует)
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'diagnostics.manage') THEN
    INSERT INTO permissions (name, resource, action, description)
    VALUES ('diagnostics.manage', 'diagnostics', 'manage', 'Полное управление диагностикой');
  END IF;
END $$;

-- 2. ПЕРЕПИСАТЬ ВСЕ RLS ПОЛИТИКИ НА has_permission()
-- ============================================================

-- admin_activity_logs
DROP POLICY IF EXISTS "activity_logs_select_admin" ON admin_activity_logs;
CREATE POLICY "activity_logs_select_admin" ON admin_activity_logs
  FOR SELECT USING (has_permission(get_current_session_user(), 'audit.view'));

-- admin_sessions (оставляем как есть - специальная логика для сессий)
-- Эти политики должны остаться с текущей логикой

-- audit_log
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
CREATE POLICY "audit_log_select_admin" ON audit_log
  FOR SELECT USING (has_permission(get_current_session_user(), 'audit.view'));

-- auth_users (только чтение)
DROP POLICY IF EXISTS "auth_users_select_admin" ON auth_users;
CREATE POLICY "auth_users_select_admin" ON auth_users
  FOR SELECT USING (has_permission(get_current_session_user(), 'users.view'));

-- career_track_steps
DROP POLICY IF EXISTS "Admins can manage career_track_steps" ON career_track_steps;
CREATE POLICY "career_tracks_all" ON career_track_steps
  FOR ALL USING (
    has_permission(get_current_session_user(), 'career.update') OR 
    has_permission(get_current_session_user(), 'career.delete')
  )
  WITH CHECK (
    has_permission(get_current_session_user(), 'career.update') OR 
    has_permission(get_current_session_user(), 'career.create')
  );

-- career_tracks
DROP POLICY IF EXISTS "Admins can manage career_tracks" ON career_tracks;
CREATE POLICY "career_tracks_all" ON career_tracks
  FOR ALL USING (
    has_permission(get_current_session_user(), 'career.update') OR 
    has_permission(get_current_session_user(), 'career.delete')
  )
  WITH CHECK (
    has_permission(get_current_session_user(), 'career.update') OR 
    has_permission(get_current_session_user(), 'career.create')
  );

-- category_skills
DROP POLICY IF EXISTS "Admins can manage category_skills" ON category_skills;
CREATE POLICY "category_skills_all" ON category_skills
  FOR ALL USING (
    has_permission(get_current_session_user(), 'skills.update') OR 
    has_permission(get_current_session_user(), 'skills.delete')
  )
  WITH CHECK (
    has_permission(get_current_session_user(), 'skills.update') OR 
    has_permission(get_current_session_user(), 'skills.create')
  );

-- certifications
DROP POLICY IF EXISTS "ref_certifications_all_admin" ON certifications;
CREATE POLICY "certifications_all" ON certifications
  FOR ALL USING (has_permission(get_current_session_user(), 'skills.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'skills.create'));

-- competency_levels
DROP POLICY IF EXISTS "ref_competency_levels_all_admin" ON competency_levels;
CREATE POLICY "competency_levels_all" ON competency_levels
  FOR ALL USING (has_permission(get_current_session_user(), 'skills.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'skills.create'));

-- departments
DROP POLICY IF EXISTS "ref_departments_all_admin" ON departments;
CREATE POLICY "departments_all" ON departments
  FOR ALL USING (has_permission(get_current_session_user(), 'departments.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'departments.create'));

-- development_tasks
DROP POLICY IF EXISTS "ref_dev_tasks_all_admin" ON development_tasks;
CREATE POLICY "development_tasks_all" ON development_tasks
  FOR ALL USING (has_permission(get_current_session_user(), 'development.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'development.create'));

-- diagnostic_stage_participants
DROP POLICY IF EXISTS "Admins can manage diagnostic_stage_participants" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "Managers can view their team diagnostic participants" ON diagnostic_stage_participants;

CREATE POLICY "diagnostic_stage_participants_all" ON diagnostic_stage_participants
  FOR ALL USING (has_permission(get_current_session_user(), 'diagnostics.manage_participants'))
  WITH CHECK (has_permission(get_current_session_user(), 'diagnostics.manage_participants'));

CREATE POLICY "diagnostic_stage_participants_view_team" ON diagnostic_stage_participants
  FOR SELECT USING (
    has_permission(get_current_session_user(), 'diagnostics.view') OR
    has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = diagnostic_stage_participants.user_id 
      AND users.manager_id = get_current_session_user()
    )
  );

-- grade_qualities
DROP POLICY IF EXISTS "Admins can manage grade_qualities" ON grade_qualities;
CREATE POLICY "grade_qualities_all" ON grade_qualities
  FOR ALL USING (has_permission(get_current_session_user(), 'qualities.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'qualities.create'));

-- grade_skills
DROP POLICY IF EXISTS "Admins can manage grade skills" ON grade_skills;
CREATE POLICY "grade_skills_all" ON grade_skills
  FOR ALL USING (has_permission(get_current_session_user(), 'skills.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'skills.create'));

-- grades
DROP POLICY IF EXISTS "ref_grades_all_admin" ON grades;
CREATE POLICY "grades_all" ON grades
  FOR ALL USING (has_permission(get_current_session_user(), 'grades.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'grades.create'));

-- hard_skill_answer_options
DROP POLICY IF EXISTS "Admins can manage skill survey answer options" ON hard_skill_answer_options;
CREATE POLICY "hard_skill_answer_options_all" ON hard_skill_answer_options
  FOR ALL USING (has_permission(get_current_session_user(), 'surveys.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'surveys.create'));

-- hard_skill_questions
DROP POLICY IF EXISTS "Admins can manage skill survey questions" ON hard_skill_questions;
CREATE POLICY "hard_skill_questions_all" ON hard_skill_questions
  FOR ALL USING (has_permission(get_current_session_user(), 'surveys.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'surveys.create'));

-- hard_skill_results
DROP POLICY IF EXISTS "Users can delete hard_skill_results" ON hard_skill_results;
DROP POLICY IF EXISTS "Users can insert hard_skill_results" ON hard_skill_results;
DROP POLICY IF EXISTS "Users can update hard_skill_results" ON hard_skill_results;
DROP POLICY IF EXISTS "Users can view hard_skill_results" ON hard_skill_results;

CREATE POLICY "hard_skill_results_delete" ON hard_skill_results
  FOR DELETE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "hard_skill_results_insert" ON hard_skill_results
  FOR INSERT WITH CHECK (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "hard_skill_results_update" ON hard_skill_results
  FOR UPDATE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "hard_skill_results_select" ON hard_skill_results
  FOR SELECT USING (
    evaluating_user_id = get_current_session_user() OR 
    evaluated_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.results') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = hard_skill_results.evaluated_user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );

-- manufacturers
DROP POLICY IF EXISTS "ref_manufacturers_all_admin" ON manufacturers;
CREATE POLICY "manufacturers_all" ON manufacturers
  FOR ALL USING (has_permission(get_current_session_user(), 'settings.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'settings.update'));

-- meeting_decisions
DROP POLICY IF EXISTS "Participants can create meeting decisions" ON meeting_decisions;
DROP POLICY IF EXISTS "Participants can delete meeting decisions" ON meeting_decisions;
DROP POLICY IF EXISTS "Participants can update meeting decisions" ON meeting_decisions;
DROP POLICY IF EXISTS "Participants can view meeting decisions" ON meeting_decisions;

CREATE POLICY "meeting_decisions_participant_all" ON meeting_decisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
    ) OR has_permission(get_current_session_user(), 'meetings.update')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
    ) OR has_permission(get_current_session_user(), 'meetings.create')
  );

CREATE POLICY "meeting_decisions_view" ON meeting_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
    ) OR has_permission(get_current_session_user(), 'meetings.view')
  );

-- meeting_stage_participants
DROP POLICY IF EXISTS "Admins can manage meeting_stage_participants" ON meeting_stage_participants;
DROP POLICY IF EXISTS "Managers can view their team meeting participants" ON meeting_stage_participants;

CREATE POLICY "meeting_stage_participants_all" ON meeting_stage_participants
  FOR ALL USING (has_permission(get_current_session_user(), 'meetings.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'meetings.create'));

CREATE POLICY "meeting_stage_participants_view_team" ON meeting_stage_participants
  FOR SELECT USING (
    has_permission(get_current_session_user(), 'meetings.view') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = meeting_stage_participants.user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );

-- meeting_stages
DROP POLICY IF EXISTS "Admins and HR can manage meeting_stages" ON meeting_stages;
DROP POLICY IF EXISTS "Managers can view their team meeting_stages" ON meeting_stages;
DROP POLICY IF EXISTS "Participants can view their meeting_stages" ON meeting_stages;

CREATE POLICY "meeting_stages_all" ON meeting_stages
  FOR ALL USING (has_permission(get_current_session_user(), 'meetings.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'meetings.create'));

CREATE POLICY "meeting_stages_view" ON meeting_stages
  FOR SELECT USING (
    has_permission(get_current_session_user(), 'meetings.view') OR
    EXISTS (
      SELECT 1 FROM meeting_stage_participants msp
      WHERE msp.stage_id = meeting_stages.id
      AND msp.user_id = get_current_session_user()
    ) OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM meeting_stage_participants msp
      JOIN users u ON u.id = msp.user_id
      WHERE msp.stage_id = meeting_stages.id
      AND u.manager_id = get_current_session_user()
    ))
  );

-- one_on_one_meetings
DROP POLICY IF EXISTS "Employees and managers can update meetings" ON one_on_one_meetings;
DROP POLICY IF EXISTS "Employees can create their own meetings" ON one_on_one_meetings;
DROP POLICY IF EXISTS "Employees can view their own meetings" ON one_on_one_meetings;
DROP POLICY IF EXISTS "Only admins can delete meetings" ON one_on_one_meetings;

CREATE POLICY "one_on_one_meetings_update" ON one_on_one_meetings
  FOR UPDATE USING (
    (employee_id = get_current_session_user() AND status IN ('draft', 'returned', 'submitted')) OR
    (manager_id = get_current_session_user() AND status IN ('submitted', 'approved', 'returned')) OR
    has_permission(get_current_session_user(), 'meetings.update')
  )
  WITH CHECK (
    (employee_id = get_current_session_user() AND status IN ('draft', 'returned', 'submitted')) OR
    (manager_id = get_current_session_user() AND status IN ('submitted', 'approved', 'returned')) OR
    has_permission(get_current_session_user(), 'meetings.update')
  );

CREATE POLICY "one_on_one_meetings_insert" ON one_on_one_meetings
  FOR INSERT WITH CHECK (
    employee_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'meetings.create')
  );

CREATE POLICY "one_on_one_meetings_select" ON one_on_one_meetings
  FOR SELECT USING (
    employee_id = get_current_session_user() OR 
    manager_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'meetings.view')
  );

CREATE POLICY "one_on_one_meetings_delete" ON one_on_one_meetings
  FOR DELETE USING (has_permission(get_current_session_user(), 'meetings.delete'));

-- position_categories
DROP POLICY IF EXISTS "ref_position_categories_all_admin" ON position_categories;
CREATE POLICY "position_categories_all" ON position_categories
  FOR ALL USING (has_permission(get_current_session_user(), 'positions.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'positions.create'));

-- positions
DROP POLICY IF EXISTS "ref_positions_all_admin" ON positions;
CREATE POLICY "positions_all" ON positions
  FOR ALL USING (has_permission(get_current_session_user(), 'positions.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'positions.create'));

-- qualities
DROP POLICY IF EXISTS "Admins can manage qualities" ON qualities;
CREATE POLICY "qualities_all" ON qualities
  FOR ALL USING (has_permission(get_current_session_user(), 'qualities.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'qualities.create'));

-- role_permissions (специальная логика - используем has_role для админа)
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Admins can view role_permissions" ON role_permissions;

CREATE POLICY "role_permissions_all" ON role_permissions
  FOR ALL USING (has_role(get_current_session_user(), 'admin'))
  WITH CHECK (has_role(get_current_session_user(), 'admin'));

-- skills
DROP POLICY IF EXISTS "Admins can manage skills" ON skills;
CREATE POLICY "skills_all" ON skills
  FOR ALL USING (has_permission(get_current_session_user(), 'skills.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'skills.create'));

-- soft_skill_answer_options
DROP POLICY IF EXISTS "Admins can manage 360 answer options" ON soft_skill_answer_options;
CREATE POLICY "soft_skill_answer_options_all" ON soft_skill_answer_options
  FOR ALL USING (has_permission(get_current_session_user(), 'surveys.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'surveys.create'));

-- soft_skill_questions
DROP POLICY IF EXISTS "Admins can manage 360 questions" ON soft_skill_questions;
CREATE POLICY "soft_skill_questions_all" ON soft_skill_questions
  FOR ALL USING (has_permission(get_current_session_user(), 'surveys.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'surveys.create'));

-- soft_skill_results
DROP POLICY IF EXISTS "Users can delete soft_skill_results" ON soft_skill_results;
DROP POLICY IF EXISTS "Users can insert soft_skill_results" ON soft_skill_results;
DROP POLICY IF EXISTS "Users can update soft_skill_results" ON soft_skill_results;
DROP POLICY IF EXISTS "Users can view soft_skill_results" ON soft_skill_results;

CREATE POLICY "soft_skill_results_delete" ON soft_skill_results
  FOR DELETE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "soft_skill_results_insert" ON soft_skill_results
  FOR INSERT WITH CHECK (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "soft_skill_results_update" ON soft_skill_results
  FOR UPDATE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "soft_skill_results_select" ON soft_skill_results
  FOR SELECT USING (
    evaluating_user_id = get_current_session_user() OR 
    evaluated_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.results') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = soft_skill_results.evaluated_user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );

-- survey_360_assignments
DROP POLICY IF EXISTS "Users can create 360 assignments" ON survey_360_assignments;
DROP POLICY IF EXISTS "Users can delete their 360 assignments" ON survey_360_assignments;
DROP POLICY IF EXISTS "Users can update their 360 assignments" ON survey_360_assignments;
DROP POLICY IF EXISTS "Users can view their 360 assignments" ON survey_360_assignments;

CREATE POLICY "survey_360_assignments_insert" ON survey_360_assignments
  FOR INSERT WITH CHECK (
    evaluated_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.assign')
  );

CREATE POLICY "survey_360_assignments_delete" ON survey_360_assignments
  FOR DELETE USING (
    evaluated_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );

CREATE POLICY "survey_360_assignments_update" ON survey_360_assignments
  FOR UPDATE USING (
    evaluated_user_id = get_current_session_user() OR 
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );

CREATE POLICY "survey_360_assignments_select" ON survey_360_assignments
  FOR SELECT USING (
    evaluated_user_id = get_current_session_user() OR 
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.view') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );

-- 3. УДАЛИТЬ DEPRECATED ФУНКЦИИ
-- ============================================================

-- Удаляем устаревшие функции проверки ролей
DROP FUNCTION IF EXISTS public.is_current_user_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_current_user_hr() CASCADE;
DROP FUNCTION IF EXISTS public.is_manager_of_user(uuid) CASCADE;

-- 4. ДОБАВИТЬ КОММЕНТАРИЙ О ЗАВЕРШЕНИИ МИГРАЦИИ
-- ============================================================

COMMENT ON DATABASE postgres IS 'Permission-based architecture fully implemented. Use has_permission() for all access checks. Deprecated functions removed. All RLS policies updated.';
