
-- ============================================
-- МОДЕРНИЗАЦИЯ СИСТЕМЫ БЕЗОПАСНОСТИ
-- Приведение всех RLS-политик к единому стандарту
-- ============================================

-- ============================================
-- ЧАСТЬ 1: Добавление permissions для справочников
-- ============================================

-- Permissions для управления навыками (skills)
INSERT INTO permissions (name, resource, action, description) VALUES
('skills.create', 'skills', 'create', 'Создание навыков'),
('skills.update', 'skills', 'update', 'Редактирование навыков'),
('skills.delete', 'skills', 'delete', 'Удаление навыков'),
('skills.view', 'skills', 'view', 'Просмотр навыков')
ON CONFLICT (name) DO NOTHING;

-- Permissions для категорий навыков
INSERT INTO permissions (name, resource, action, description) VALUES
('categories.create', 'categories', 'create', 'Создание категорий навыков'),
('categories.update', 'categories', 'update', 'Редактирование категорий'),
('categories.delete', 'categories', 'delete', 'Удаление категорий'),
('categories.view', 'categories', 'view', 'Просмотр категорий')
ON CONFLICT (name) DO NOTHING;

-- Permissions для сертификаций
INSERT INTO permissions (name, resource, action, description) VALUES
('certifications.create', 'certifications', 'create', 'Создание сертификаций'),
('certifications.update', 'certifications', 'update', 'Редактирование сертификаций'),
('certifications.delete', 'certifications', 'delete', 'Удаление сертификаций'),
('certifications.view', 'certifications', 'view', 'Просмотр сертификаций')
ON CONFLICT (name) DO NOTHING;

-- Permissions для уровней компетенций
INSERT INTO permissions (name, resource, action, description) VALUES
('competency_levels.create', 'competency_levels', 'create', 'Создание уровней компетенций'),
('competency_levels.update', 'competency_levels', 'update', 'Редактирование уровней'),
('competency_levels.delete', 'competency_levels', 'delete', 'Удаление уровней'),
('competency_levels.view', 'competency_levels', 'view', 'Просмотр уровней')
ON CONFLICT (name) DO NOTHING;

-- Permissions для производителей
INSERT INTO permissions (name, resource, action, description) VALUES
('manufacturers.create', 'manufacturers', 'create', 'Создание производителей'),
('manufacturers.update', 'manufacturers', 'update', 'Редактирование производителей'),
('manufacturers.delete', 'manufacturers', 'delete', 'Удаление производителей'),
('manufacturers.view', 'manufacturers', 'view', 'Просмотр производителей')
ON CONFLICT (name) DO NOTHING;

-- Permissions для торговых точек
INSERT INTO permissions (name, resource, action, description) VALUES
('trade_points.create', 'trade_points', 'create', 'Создание торговых точек'),
('trade_points.update', 'trade_points', 'update', 'Редактирование торговых точек'),
('trade_points.delete', 'trade_points', 'delete', 'Удаление торговых точек'),
('trade_points.view', 'trade_points', 'view', 'Просмотр торговых точек')
ON CONFLICT (name) DO NOTHING;

-- Permissions для типов треков
INSERT INTO permissions (name, resource, action, description) VALUES
('track_types.create', 'track_types', 'create', 'Создание типов треков'),
('track_types.update', 'track_types', 'update', 'Редактирование типов'),
('track_types.delete', 'track_types', 'delete', 'Удаление типов'),
('track_types.view', 'track_types', 'view', 'Просмотр типов')
ON CONFLICT (name) DO NOTHING;

-- Permissions для задач развития
INSERT INTO permissions (name, resource, action, description) VALUES
('development_tasks.create', 'development_tasks', 'create', 'Создание задач развития'),
('development_tasks.update', 'development_tasks', 'update', 'Редактирование задач'),
('development_tasks.delete', 'development_tasks', 'delete', 'Удаление задач'),
('development_tasks.view', 'development_tasks', 'view', 'Просмотр задач')
ON CONFLICT (name) DO NOTHING;

-- Permissions для вопросов опросов
INSERT INTO permissions (name, resource, action, description) VALUES
('survey_questions.create', 'survey_questions', 'create', 'Создание вопросов опросов'),
('survey_questions.update', 'survey_questions', 'update', 'Редактирование вопросов'),
('survey_questions.delete', 'survey_questions', 'delete', 'Удаление вопросов'),
('survey_questions.view', 'survey_questions', 'view', 'Просмотр вопросов')
ON CONFLICT (name) DO NOTHING;

-- Permissions для результатов оценки
INSERT INTO permissions (name, resource, action, description) VALUES
('assessment_results.view_all', 'assessment_results', 'view_all', 'Просмотр всех результатов оценки'),
('assessment_results.view_team', 'assessment_results', 'view_team', 'Просмотр результатов команды'),
('assessment_results.export', 'assessment_results', 'export', 'Экспорт результатов оценки')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ЧАСТЬ 2: Назначение permissions для ролей
-- ============================================

-- Admin получает все permissions для справочников
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE resource IN (
  'skills', 'categories', 'certifications', 'competency_levels',
  'manufacturers', 'trade_points', 'track_types', 'development_tasks',
  'survey_questions', 'assessment_results'
)
ON CONFLICT DO NOTHING;

-- HR BP получает права на просмотр и управление справочниками
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'skills.view', 'skills.create', 'skills.update',
  'categories.view', 'categories.create', 'categories.update',
  'certifications.view', 'certifications.create', 'certifications.update',
  'competency_levels.view', 'competency_levels.create', 'competency_levels.update',
  'development_tasks.view', 'development_tasks.create', 'development_tasks.update',
  'survey_questions.view', 'survey_questions.create', 'survey_questions.update',
  'assessment_results.view_all', 'assessment_results.export',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;

-- Manager получает права на просмотр справочников и результатов команды
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'survey_questions.view', 'assessment_results.view_team',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;

-- Employee получает базовые права на просмотр
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- ЧАСТЬ 3: Обновление RLS-политик для справочников
-- ============================================

-- Skills (навыки)
DROP POLICY IF EXISTS "Public can view skills" ON skills;
DROP POLICY IF EXISTS "ref_skills_select" ON skills;

CREATE POLICY "skills_select_policy" ON skills
  FOR SELECT USING (true);

CREATE POLICY "skills_insert_policy" ON skills
  FOR INSERT WITH CHECK (has_permission('skills.create'));

CREATE POLICY "skills_update_policy" ON skills
  FOR UPDATE USING (has_permission('skills.update'))
  WITH CHECK (has_permission('skills.update'));

CREATE POLICY "skills_delete_policy" ON skills
  FOR DELETE USING (has_permission('skills.delete'));

-- Category Skills (категории навыков)
DROP POLICY IF EXISTS "Public can view category_skills" ON category_skills;

CREATE POLICY "category_skills_select_policy" ON category_skills
  FOR SELECT USING (true);

CREATE POLICY "category_skills_insert_policy" ON category_skills
  FOR INSERT WITH CHECK (has_permission('categories.create'));

CREATE POLICY "category_skills_update_policy" ON category_skills
  FOR UPDATE USING (has_permission('categories.update'))
  WITH CHECK (has_permission('categories.update'));

CREATE POLICY "category_skills_delete_policy" ON category_skills
  FOR DELETE USING (has_permission('categories.delete'));

-- Qualities (качества)
DROP POLICY IF EXISTS "Everyone can view qualities" ON qualities;

CREATE POLICY "qualities_select_policy" ON qualities
  FOR SELECT USING (true);

CREATE POLICY "qualities_insert_policy" ON qualities
  FOR INSERT WITH CHECK (has_permission('qualities.create'));

CREATE POLICY "qualities_update_policy" ON qualities
  FOR UPDATE USING (has_permission('qualities.update'))
  WITH CHECK (has_permission('qualities.update'));

CREATE POLICY "qualities_delete_policy" ON qualities
  FOR DELETE USING (has_permission('qualities.delete'));

-- Certifications
DROP POLICY IF EXISTS "ref_certifications_select" ON certifications;

CREATE POLICY "certifications_select_policy" ON certifications
  FOR SELECT USING (true);

CREATE POLICY "certifications_insert_policy" ON certifications
  FOR INSERT WITH CHECK (has_permission('certifications.create'));

CREATE POLICY "certifications_update_policy" ON certifications
  FOR UPDATE USING (has_permission('certifications.update'))
  WITH CHECK (has_permission('certifications.update'));

CREATE POLICY "certifications_delete_policy" ON certifications
  FOR DELETE USING (has_permission('certifications.delete'));

-- Competency Levels
DROP POLICY IF EXISTS "Everyone can view competency_levels" ON competency_levels;
DROP POLICY IF EXISTS "ref_competency_levels_select" ON competency_levels;

CREATE POLICY "competency_levels_select_policy" ON competency_levels
  FOR SELECT USING (true);

CREATE POLICY "competency_levels_insert_policy" ON competency_levels
  FOR INSERT WITH CHECK (has_permission('competency_levels.create'));

CREATE POLICY "competency_levels_update_policy" ON competency_levels
  FOR UPDATE USING (has_permission('competency_levels.update'))
  WITH CHECK (has_permission('competency_levels.update'));

CREATE POLICY "competency_levels_delete_policy" ON competency_levels
  FOR DELETE USING (has_permission('competency_levels.delete'));

-- Departments
DROP POLICY IF EXISTS "ref_departments_select" ON departments;

CREATE POLICY "departments_select_policy" ON departments
  FOR SELECT USING (true);

CREATE POLICY "departments_insert_policy" ON departments
  FOR INSERT WITH CHECK (has_permission('departments.create'));

CREATE POLICY "departments_update_policy" ON departments
  FOR UPDATE USING (has_permission('departments.update'))
  WITH CHECK (has_permission('departments.update'));

CREATE POLICY "departments_delete_policy" ON departments
  FOR DELETE USING (has_permission('departments.delete'));

-- Manufacturers
DROP POLICY IF EXISTS "ref_manufacturers_select" ON manufacturers;

CREATE POLICY "manufacturers_select_policy" ON manufacturers
  FOR SELECT USING (true);

CREATE POLICY "manufacturers_insert_policy" ON manufacturers
  FOR INSERT WITH CHECK (has_permission('manufacturers.create'));

CREATE POLICY "manufacturers_update_policy" ON manufacturers
  FOR UPDATE USING (has_permission('manufacturers.update'))
  WITH CHECK (has_permission('manufacturers.update'));

CREATE POLICY "manufacturers_delete_policy" ON manufacturers
  FOR DELETE USING (has_permission('manufacturers.delete'));

-- Position Categories
DROP POLICY IF EXISTS "ref_position_categories_select" ON position_categories;

CREATE POLICY "position_categories_select_policy" ON position_categories
  FOR SELECT USING (true);

CREATE POLICY "position_categories_insert_policy" ON position_categories
  FOR INSERT WITH CHECK (has_permission('positions.create'));

CREATE POLICY "position_categories_update_policy" ON position_categories
  FOR UPDATE USING (has_permission('positions.update'))
  WITH CHECK (has_permission('positions.update'));

CREATE POLICY "position_categories_delete_policy" ON position_categories
  FOR DELETE USING (has_permission('positions.delete'));

-- Positions
DROP POLICY IF EXISTS "Everyone can view positions" ON positions;

CREATE POLICY "positions_select_policy" ON positions
  FOR SELECT USING (true);

CREATE POLICY "positions_insert_policy" ON positions
  FOR INSERT WITH CHECK (has_permission('positions.create'));

CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (has_permission('positions.update'))
  WITH CHECK (has_permission('positions.update'));

CREATE POLICY "positions_delete_policy" ON positions
  FOR DELETE USING (has_permission('positions.delete'));

-- Grades
DROP POLICY IF EXISTS "Everyone can view grades" ON grades;

CREATE POLICY "grades_select_policy" ON grades
  FOR SELECT USING (true);

CREATE POLICY "grades_insert_policy" ON grades
  FOR INSERT WITH CHECK (has_permission('grades.create'));

CREATE POLICY "grades_update_policy" ON grades
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));

CREATE POLICY "grades_delete_policy" ON grades
  FOR DELETE USING (has_permission('grades.delete'));

-- Grade Skills
DROP POLICY IF EXISTS "Public can view grade skills" ON grade_skills;

CREATE POLICY "grade_skills_select_policy" ON grade_skills
  FOR SELECT USING (true);

CREATE POLICY "grade_skills_insert_policy" ON grade_skills
  FOR INSERT WITH CHECK (has_permission('grades.create'));

CREATE POLICY "grade_skills_update_policy" ON grade_skills
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));

CREATE POLICY "grade_skills_delete_policy" ON grade_skills
  FOR DELETE USING (has_permission('grades.delete'));

-- Grade Qualities
DROP POLICY IF EXISTS "Everyone can view grade_qualities" ON grade_qualities;

CREATE POLICY "grade_qualities_select_policy" ON grade_qualities
  FOR SELECT USING (true);

CREATE POLICY "grade_qualities_insert_policy" ON grade_qualities
  FOR INSERT WITH CHECK (has_permission('grades.create'));

CREATE POLICY "grade_qualities_update_policy" ON grade_qualities
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));

CREATE POLICY "grade_qualities_delete_policy" ON grade_qualities
  FOR DELETE USING (has_permission('grades.delete'));

-- Career Tracks
DROP POLICY IF EXISTS "Everyone can view career_tracks" ON career_tracks;

CREATE POLICY "career_tracks_select_policy" ON career_tracks
  FOR SELECT USING (true);

CREATE POLICY "career_tracks_insert_policy" ON career_tracks
  FOR INSERT WITH CHECK (has_permission('career.create'));

CREATE POLICY "career_tracks_update_policy" ON career_tracks
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));

CREATE POLICY "career_tracks_delete_policy" ON career_tracks
  FOR DELETE USING (has_permission('career.delete'));

-- Career Track Steps
DROP POLICY IF EXISTS "Everyone can view career_track_steps" ON career_track_steps;

CREATE POLICY "career_track_steps_select_policy" ON career_track_steps
  FOR SELECT USING (true);

CREATE POLICY "career_track_steps_insert_policy" ON career_track_steps
  FOR INSERT WITH CHECK (has_permission('career.create'));

CREATE POLICY "career_track_steps_update_policy" ON career_track_steps
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));

CREATE POLICY "career_track_steps_delete_policy" ON career_track_steps
  FOR DELETE USING (has_permission('career.delete'));

-- Trade Points
DROP POLICY IF EXISTS "Everyone can view trade_points" ON trade_points;

CREATE POLICY "trade_points_select_policy" ON trade_points
  FOR SELECT USING (true);

CREATE POLICY "trade_points_insert_policy" ON trade_points
  FOR INSERT WITH CHECK (has_permission('trade_points.create'));

CREATE POLICY "trade_points_update_policy" ON trade_points
  FOR UPDATE USING (has_permission('trade_points.update'))
  WITH CHECK (has_permission('trade_points.update'));

CREATE POLICY "trade_points_delete_policy" ON trade_points
  FOR DELETE USING (has_permission('trade_points.delete'));

-- Track Types
DROP POLICY IF EXISTS "Everyone can view track_types" ON track_types;
DROP POLICY IF EXISTS "ref_track_types_select" ON track_types;

CREATE POLICY "track_types_select_policy" ON track_types
  FOR SELECT USING (true);

CREATE POLICY "track_types_insert_policy" ON track_types
  FOR INSERT WITH CHECK (has_permission('track_types.create'));

CREATE POLICY "track_types_update_policy" ON track_types
  FOR UPDATE USING (has_permission('track_types.update'))
  WITH CHECK (has_permission('track_types.update'));

CREATE POLICY "track_types_delete_policy" ON track_types
  FOR DELETE USING (has_permission('track_types.delete'));

-- Development Tasks
DROP POLICY IF EXISTS "Everyone can view development_tasks" ON development_tasks;
DROP POLICY IF EXISTS "ref_dev_tasks_select" ON development_tasks;

CREATE POLICY "development_tasks_select_policy" ON development_tasks
  FOR SELECT USING (true);

CREATE POLICY "development_tasks_insert_policy" ON development_tasks
  FOR INSERT WITH CHECK (has_permission('development_tasks.create'));

CREATE POLICY "development_tasks_update_policy" ON development_tasks
  FOR UPDATE USING (has_permission('development_tasks.update'))
  WITH CHECK (has_permission('development_tasks.update'));

CREATE POLICY "development_tasks_delete_policy" ON development_tasks
  FOR DELETE USING (has_permission('development_tasks.delete'));

-- Hard Skill Questions
DROP POLICY IF EXISTS "Public can view skill survey questions" ON hard_skill_questions;

CREATE POLICY "hard_skill_questions_select_policy" ON hard_skill_questions
  FOR SELECT USING (true);

CREATE POLICY "hard_skill_questions_insert_policy" ON hard_skill_questions
  FOR INSERT WITH CHECK (has_permission('survey_questions.create'));

CREATE POLICY "hard_skill_questions_update_policy" ON hard_skill_questions
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));

CREATE POLICY "hard_skill_questions_delete_policy" ON hard_skill_questions
  FOR DELETE USING (has_permission('survey_questions.delete'));

-- Hard Skill Answer Options
DROP POLICY IF EXISTS "Public can view skill survey answer options" ON hard_skill_answer_options;

CREATE POLICY "hard_skill_answer_options_select_policy" ON hard_skill_answer_options
  FOR SELECT USING (true);

CREATE POLICY "hard_skill_answer_options_insert_policy" ON hard_skill_answer_options
  FOR INSERT WITH CHECK (has_permission('survey_questions.create'));

CREATE POLICY "hard_skill_answer_options_update_policy" ON hard_skill_answer_options
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));

CREATE POLICY "hard_skill_answer_options_delete_policy" ON hard_skill_answer_options
  FOR DELETE USING (has_permission('survey_questions.delete'));

-- Soft Skill Questions
DROP POLICY IF EXISTS "Public can view 360 questions" ON soft_skill_questions;

CREATE POLICY "soft_skill_questions_select_policy" ON soft_skill_questions
  FOR SELECT USING (true);

CREATE POLICY "soft_skill_questions_insert_policy" ON soft_skill_questions
  FOR INSERT WITH CHECK (has_permission('survey_questions.create'));

CREATE POLICY "soft_skill_questions_update_policy" ON soft_skill_questions
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));

CREATE POLICY "soft_skill_questions_delete_policy" ON soft_skill_questions
  FOR DELETE USING (has_permission('survey_questions.delete'));

-- Soft Skill Answer Options
DROP POLICY IF EXISTS "Public can view 360 answer options" ON soft_skill_answer_options;

CREATE POLICY "soft_skill_answer_options_select_policy" ON soft_skill_answer_options
  FOR SELECT USING (true);

CREATE POLICY "soft_skill_answer_options_insert_policy" ON soft_skill_answer_options
  FOR INSERT WITH CHECK (has_permission('survey_questions.create'));

CREATE POLICY "soft_skill_answer_options_update_policy" ON soft_skill_answer_options
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));

CREATE POLICY "soft_skill_answer_options_delete_policy" ON soft_skill_answer_options
  FOR DELETE USING (has_permission('survey_questions.delete'));

-- ============================================
-- ЧАСТЬ 4: Обновление таблиц user_*
-- ============================================

-- User Assessment Results
DROP POLICY IF EXISTS "System can insert assessment results" ON user_assessment_results;
DROP POLICY IF EXISTS "System can update assessment results" ON user_assessment_results;

CREATE POLICY "user_assessment_results_select_policy" ON user_assessment_results
  FOR SELECT USING (
    user_id = get_current_user_id() 
    OR has_permission('assessment_results.view_all')
    OR (has_permission('assessment_results.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_assessment_results_insert_policy" ON user_assessment_results
  FOR INSERT WITH CHECK (true); -- Система создаёт через триггеры

CREATE POLICY "user_assessment_results_update_policy" ON user_assessment_results
  FOR UPDATE USING (true) -- Система обновляет через триггеры
  WITH CHECK (true);

CREATE POLICY "user_assessment_results_delete_policy" ON user_assessment_results
  FOR DELETE USING (has_permission('assessment_results.view_all'));

-- User Skills
DROP POLICY IF EXISTS "Users can manage their skills" ON user_skills;

CREATE POLICY "user_skills_select_policy" ON user_skills
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('users.view_all')
    OR (has_permission('users.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_skills_insert_policy" ON user_skills
  FOR INSERT WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );

CREATE POLICY "user_skills_update_policy" ON user_skills
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );

CREATE POLICY "user_skills_delete_policy" ON user_skills
  FOR DELETE USING (
    user_id = get_current_user_id()
    OR has_permission('users.delete')
  );

-- User Qualities
DROP POLICY IF EXISTS "Allow all access to user_qualities" ON user_qualities;
DROP POLICY IF EXISTS "Users can insert qualities" ON user_qualities;
DROP POLICY IF EXISTS "Users can view qualities" ON user_qualities;
DROP POLICY IF EXISTS "Users can update qualities" ON user_qualities;

CREATE POLICY "user_qualities_select_policy" ON user_qualities
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('users.view_all')
    OR (has_permission('users.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_qualities_insert_policy" ON user_qualities
  FOR INSERT WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );

CREATE POLICY "user_qualities_update_policy" ON user_qualities
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );

CREATE POLICY "user_qualities_delete_policy" ON user_qualities
  FOR DELETE USING (
    user_id = get_current_user_id()
    OR has_permission('users.delete')
  );

-- User Roles
DROP POLICY IF EXISTS "Allow admin operations on user_roles" ON user_roles;
DROP POLICY IF EXISTS "Allow all read access to user_roles" ON user_roles;
DROP POLICY IF EXISTS "Everyone can view user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

CREATE POLICY "user_roles_select_policy" ON user_roles
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('security.view_users')
  );

CREATE POLICY "user_roles_insert_policy" ON user_roles
  FOR INSERT WITH CHECK (has_permission('users.manage_roles'));

CREATE POLICY "user_roles_update_policy" ON user_roles
  FOR UPDATE USING (has_permission('users.manage_roles'))
  WITH CHECK (has_permission('users.manage_roles'));

CREATE POLICY "user_roles_delete_policy" ON user_roles
  FOR DELETE USING (has_permission('users.manage_roles'));

-- User Career Progress
DROP POLICY IF EXISTS "Allow all access to user_career_progress" ON user_career_progress;
DROP POLICY IF EXISTS "Users can manage career progress" ON user_career_progress;
DROP POLICY IF EXISTS "Users can view career progress" ON user_career_progress;

CREATE POLICY "user_career_progress_select_policy" ON user_career_progress
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('career.view')
    OR (has_permission('users.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_career_progress_insert_policy" ON user_career_progress
  FOR INSERT WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('career.update')
  );

CREATE POLICY "user_career_progress_update_policy" ON user_career_progress
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('career.update')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('career.update')
  );

CREATE POLICY "user_career_progress_delete_policy" ON user_career_progress
  FOR DELETE USING (has_permission('career.delete'));

-- User Career Ratings
DROP POLICY IF EXISTS "Allow user_career_ratings operations for admin panel" ON user_career_ratings;
DROP POLICY IF EXISTS "Everyone can view career ratings" ON user_career_ratings;

CREATE POLICY "user_career_ratings_select_policy" ON user_career_ratings
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('career.view')
    OR (has_permission('users.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_career_ratings_insert_policy" ON user_career_ratings
  FOR INSERT WITH CHECK (has_permission('career.update'));

CREATE POLICY "user_career_ratings_update_policy" ON user_career_ratings
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));

CREATE POLICY "user_career_ratings_delete_policy" ON user_career_ratings
  FOR DELETE USING (has_permission('career.delete'));

-- User KPI Results
DROP POLICY IF EXISTS "Allow all access to user_kpi_results" ON user_kpi_results;
DROP POLICY IF EXISTS "Users can view KPI results" ON user_kpi_results;

CREATE POLICY "user_kpi_results_select_policy" ON user_kpi_results
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('analytics.view_all')
    OR (has_permission('analytics.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_kpi_results_insert_policy" ON user_kpi_results
  FOR INSERT WITH CHECK (has_permission('analytics.manage'));

CREATE POLICY "user_kpi_results_update_policy" ON user_kpi_results
  FOR UPDATE USING (has_permission('analytics.manage'))
  WITH CHECK (has_permission('analytics.manage'));

CREATE POLICY "user_kpi_results_delete_policy" ON user_kpi_results
  FOR DELETE USING (has_permission('analytics.manage'));

-- User Trade Points
DROP POLICY IF EXISTS "Allow all access to user_trade_points" ON user_trade_points;
DROP POLICY IF EXISTS "Users can view trade points" ON user_trade_points;

CREATE POLICY "user_trade_points_select_policy" ON user_trade_points
  FOR SELECT USING (
    user_id = get_current_user_id()
    OR has_permission('users.view_all')
    OR (has_permission('users.view_team') AND is_users_manager(user_id))
  );

CREATE POLICY "user_trade_points_insert_policy" ON user_trade_points
  FOR INSERT WITH CHECK (has_permission('users.update_all'));

CREATE POLICY "user_trade_points_update_policy" ON user_trade_points
  FOR UPDATE USING (has_permission('users.update_all'))
  WITH CHECK (has_permission('users.update_all'));

CREATE POLICY "user_trade_points_delete_policy" ON user_trade_points
  FOR DELETE USING (has_permission('users.delete'));

-- ============================================
-- ЧАСТЬ 5: Удаление устаревших функций
-- ============================================

-- Удаляем устаревшую функцию check_user_has_auth
DROP FUNCTION IF EXISTS check_user_has_auth(text);

-- ============================================
-- ФИНАЛ: Обновление кэша permissions
-- ============================================

-- Обновляем кэш эффективных прав для всех ролей
DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT DISTINCT role FROM user_roles LOOP
    PERFORM refresh_role_effective_permissions(role_record.role);
  END LOOP;
END $$;
