-- =====================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ RLS ПОЛИТИК - v2
-- Аудит безопасности и устранение уязвимостей
-- =====================================

-- =====================================================
-- ЭТАП 1: УДАЛЕНИЕ ВСЕХ СУЩЕСТВУЮЩИХ ПОЛИТИК
-- =====================================================

-- admin_sessions
DROP POLICY IF EXISTS "Allow admin session operations for testing" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Admins can delete any session" ON public.admin_sessions;

-- auth_users
DROP POLICY IF EXISTS "Admins can view auth_users" ON public.auth_users;
DROP POLICY IF EXISTS "Only admins can view auth_users" ON public.auth_users;

-- users
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Managers can view team data" ON public.users;
DROP POLICY IF EXISTS "HR and Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- user_roles
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "HR can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.user_profiles;

-- user_achievements
DROP POLICY IF EXISTS "Allow all access to user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can view their achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Admins and HR can view all achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Admins can manage achievements" ON public.user_achievements;

-- user_career_progress
DROP POLICY IF EXISTS "Users can view own career progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Managers can view team career progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "HR and Admins can view all career progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Admins can manage career progress" ON public.user_career_progress;

-- user_skills
DROP POLICY IF EXISTS "Users can view own skills" ON public.user_skills;
DROP POLICY IF EXISTS "Managers can view team skills" ON public.user_skills;
DROP POLICY IF EXISTS "HR and Admins can view all skills" ON public.user_skills;
DROP POLICY IF EXISTS "System can update skills" ON public.user_skills;

-- user_qualities
DROP POLICY IF EXISTS "Users can view own qualities" ON public.user_qualities;
DROP POLICY IF EXISTS "Managers can view team qualities" ON public.user_qualities;
DROP POLICY IF EXISTS "HR and Admins can view all qualities" ON public.user_qualities;
DROP POLICY IF EXISTS "System can update qualities" ON public.user_qualities;

-- user_trade_points
DROP POLICY IF EXISTS "Users can view own trade points" ON public.user_trade_points;
DROP POLICY IF EXISTS "Managers can view team trade points" ON public.user_trade_points;
DROP POLICY IF EXISTS "HR and Admins can view all trade points" ON public.user_trade_points;
DROP POLICY IF EXISTS "Admins can manage trade points" ON public.user_trade_points;

-- Логи
DROP POLICY IF EXISTS "Allow all read access to admin_activity_logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Allow all insert access to admin_activity_logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins can view admin activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "System can insert admin activity logs" ON public.admin_activity_logs;

DROP POLICY IF EXISTS "Allow all read access to audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Allow all insert access to audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

-- Справочники
DROP POLICY IF EXISTS "Allow certifications operations for admin panel" ON public.certifications;
DROP POLICY IF EXISTS "Everyone can view certifications" ON public.certifications;
DROP POLICY IF EXISTS "Admins can manage certifications" ON public.certifications;

DROP POLICY IF EXISTS "Allow competency_levels operations for admin panel" ON public.competency_levels;
DROP POLICY IF EXISTS "Everyone can view competency levels" ON public.competency_levels;
DROP POLICY IF EXISTS "Admins can manage competency levels" ON public.competency_levels;

DROP POLICY IF EXISTS "Allow departments operations for admin panel" ON public.departments;
DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

DROP POLICY IF EXISTS "Allow manufacturers operations for admin panel" ON public.manufacturers;
DROP POLICY IF EXISTS "Everyone can view manufacturers" ON public.manufacturers;
DROP POLICY IF EXISTS "Admins can manage manufacturers" ON public.manufacturers;

DROP POLICY IF EXISTS "Allow position_categories operations for admin panel" ON public.position_categories;
DROP POLICY IF EXISTS "Everyone can view position categories" ON public.position_categories;
DROP POLICY IF EXISTS "Admins can manage position categories" ON public.position_categories;

DROP POLICY IF EXISTS "Allow positions operations for admin panel" ON public.positions;
DROP POLICY IF EXISTS "Admins can manage positions" ON public.positions;

DROP POLICY IF EXISTS "Allow grades operations for admin panel" ON public.grades;
DROP POLICY IF EXISTS "Admins can manage grades" ON public.grades;

DROP POLICY IF EXISTS "Allow track_types operations for admin panel" ON public.track_types;
DROP POLICY IF EXISTS "Everyone can view track types" ON public.track_types;
DROP POLICY IF EXISTS "Admins can manage track types" ON public.track_types;

DROP POLICY IF EXISTS "Allow trade_points operations for admin panel" ON public.trade_points;
DROP POLICY IF EXISTS "Admins can manage trade points" ON public.trade_points;

-- Development
DROP POLICY IF EXISTS "Allow development_plans operations for admin panel" ON public.development_plans;
DROP POLICY IF EXISTS "Users can view own development plans" ON public.development_plans;
DROP POLICY IF EXISTS "Managers can view team development plans" ON public.development_plans;
DROP POLICY IF EXISTS "HR and Admins can manage all development plans" ON public.development_plans;

DROP POLICY IF EXISTS "Allow development_tasks operations for admin panel" ON public.development_tasks;
DROP POLICY IF EXISTS "Everyone can view development tasks" ON public.development_tasks;
DROP POLICY IF EXISTS "Admins can manage development tasks" ON public.development_tasks;

-- Survey assignments
DROP POLICY IF EXISTS "Allow survey_assignments operations for admin panel" ON public.survey_assignments;
DROP POLICY IF EXISTS "Users can view own survey assignments" ON public.survey_assignments;
DROP POLICY IF EXISTS "Admins and HR can manage survey assignments" ON public.survey_assignments;

-- =====================================================
-- ЭТАП 2: ВКЛЮЧЕНИЕ RLS НА ВСЕХ ТАБЛИЦАХ
-- =====================================================

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_career_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trade_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ЭТАП 3: СОЗДАНИЕ БЕЗОПАСНЫХ ПОЛИТИК
-- =====================================================

-- =========================================
-- ADMIN_SESSIONS - Критичная таблица
-- =========================================

CREATE POLICY "session_select_own"
ON public.admin_sessions FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "session_insert_own"
ON public.admin_sessions FOR INSERT
WITH CHECK (user_id = get_current_session_user());

CREATE POLICY "session_delete_own"
ON public.admin_sessions FOR DELETE
USING (user_id = get_current_session_user());

CREATE POLICY "session_select_admin"
ON public.admin_sessions FOR SELECT
USING (is_current_user_admin());

CREATE POLICY "session_delete_admin"
ON public.admin_sessions FOR DELETE
USING (is_current_user_admin());

-- =========================================
-- AUTH_USERS - Только администраторы
-- =========================================

CREATE POLICY "auth_users_admin_only"
ON public.auth_users FOR SELECT
USING (is_current_user_admin());

-- =========================================
-- USERS - Персональные данные
-- =========================================

CREATE POLICY "users_select_own"
ON public.users FOR SELECT
USING (id = get_current_session_user());

CREATE POLICY "users_select_team"
ON public.users FOR SELECT
USING (manager_id = get_current_session_user());

CREATE POLICY "users_select_hr_admin"
ON public.users FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "users_all_admin"
ON public.users FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_ROLES - Критичная таблица ролей
-- =========================================

CREATE POLICY "roles_select_own"
ON public.user_roles FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "roles_select_admin"
ON public.user_roles FOR SELECT
USING (is_current_user_admin());

CREATE POLICY "roles_all_admin"
ON public.user_roles FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_PROFILES - Личные данные
-- =========================================

CREATE POLICY "profiles_select_own"
ON public.user_profiles FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "profiles_update_own"
ON public.user_profiles FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());

CREATE POLICY "profiles_select_hr"
ON public.user_profiles FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "profiles_all_admin"
ON public.user_profiles FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_ACHIEVEMENTS
-- =========================================

CREATE POLICY "achievements_select_own"
ON public.user_achievements FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "achievements_select_hr"
ON public.user_achievements FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "achievements_all_admin"
ON public.user_achievements FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_CAREER_PROGRESS
-- =========================================

CREATE POLICY "career_select_own"
ON public.user_career_progress FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "career_select_manager"
ON public.user_career_progress FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = user_career_progress.user_id 
  AND users.manager_id = get_current_session_user()
));

CREATE POLICY "career_select_hr"
ON public.user_career_progress FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "career_all_admin"
ON public.user_career_progress FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_SKILLS
-- =========================================

CREATE POLICY "skills_select_own"
ON public.user_skills FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "skills_select_manager"
ON public.user_skills FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = user_skills.user_id 
  AND users.manager_id = get_current_session_user()
));

CREATE POLICY "skills_select_hr"
ON public.user_skills FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "skills_all_admin"
ON public.user_skills FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_QUALITIES
-- =========================================

CREATE POLICY "qualities_select_own"
ON public.user_qualities FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "qualities_select_manager"
ON public.user_qualities FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = user_qualities.user_id 
  AND users.manager_id = get_current_session_user()
));

CREATE POLICY "qualities_select_hr"
ON public.user_qualities FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "qualities_all_admin"
ON public.user_qualities FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- USER_TRADE_POINTS
-- =========================================

CREATE POLICY "trade_points_select_own"
ON public.user_trade_points FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "trade_points_select_manager"
ON public.user_trade_points FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = user_trade_points.user_id 
  AND users.manager_id = get_current_session_user()
));

CREATE POLICY "trade_points_select_hr"
ON public.user_trade_points FOR SELECT
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "trade_points_all_admin"
ON public.user_trade_points FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- ЛОГИ - Только администраторы
-- =========================================

CREATE POLICY "activity_logs_select_admin"
ON public.admin_activity_logs FOR SELECT
USING (is_current_user_admin());

CREATE POLICY "activity_logs_insert_system"
ON public.admin_activity_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "audit_log_select_admin"
ON public.audit_log FOR SELECT
USING (is_current_user_admin());

CREATE POLICY "audit_log_insert_system"
ON public.audit_log FOR INSERT
WITH CHECK (true);

-- =========================================
-- СПРАВОЧНИКИ - Админы пишут, все читают
-- =========================================

CREATE POLICY "ref_certifications_select"
ON public.certifications FOR SELECT
USING (true);

CREATE POLICY "ref_certifications_all_admin"
ON public.certifications FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_competency_levels_select"
ON public.competency_levels FOR SELECT
USING (true);

CREATE POLICY "ref_competency_levels_all_admin"
ON public.competency_levels FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_departments_select"
ON public.departments FOR SELECT
USING (true);

CREATE POLICY "ref_departments_all_admin"
ON public.departments FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_manufacturers_select"
ON public.manufacturers FOR SELECT
USING (true);

CREATE POLICY "ref_manufacturers_all_admin"
ON public.manufacturers FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_position_categories_select"
ON public.position_categories FOR SELECT
USING (true);

CREATE POLICY "ref_position_categories_all_admin"
ON public.position_categories FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_positions_all_admin"
ON public.positions FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_grades_all_admin"
ON public.grades FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_track_types_select"
ON public.track_types FOR SELECT
USING (true);

CREATE POLICY "ref_track_types_all_admin"
ON public.track_types FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "ref_trade_points_all_admin"
ON public.trade_points FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- DEVELOPMENT PLANS & TASKS
-- =========================================

CREATE POLICY "dev_plans_select_own"
ON public.development_plans FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "dev_plans_select_manager"
ON public.development_plans FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = development_plans.user_id 
  AND users.manager_id = get_current_session_user()
));

CREATE POLICY "dev_plans_all_hr"
ON public.development_plans FOR ALL
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]))
WITH CHECK (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

CREATE POLICY "ref_dev_tasks_select"
ON public.development_tasks FOR SELECT
USING (true);

CREATE POLICY "ref_dev_tasks_all_admin"
ON public.development_tasks FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =========================================
-- SURVEY ASSIGNMENTS
-- =========================================

CREATE POLICY "survey_assignments_select_own"
ON public.survey_assignments FOR SELECT
USING (user_id = get_current_session_user());

CREATE POLICY "survey_assignments_all_hr"
ON public.survey_assignments FOR ALL
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]))
WITH CHECK (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));