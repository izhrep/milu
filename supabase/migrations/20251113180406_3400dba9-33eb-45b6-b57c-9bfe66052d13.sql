-- ============================================
-- МИГРАЦИЯ: Переход на новую систему авторизации
-- Без использования DROP CASCADE
-- ============================================

-- ШАГ 1: Временно отключаем RLS политики, которые используют старые функции
-- ============================================

-- Удаляем политики, использующие get_current_session_user() или is_current_user_admin()
DROP POLICY IF EXISTS "activity_logs_insert_system" ON admin_activity_logs;
DROP POLICY IF EXISTS "audit_log_insert_system" ON audit_log;

-- ШАГ 2: Удаляем старые функции (теперь безопасно, без CASCADE)
-- ============================================

DROP FUNCTION IF EXISTS get_current_session_user();
DROP FUNCTION IF EXISTS has_role(uuid, app_role);
DROP FUNCTION IF EXISTS is_current_user_admin();
DROP FUNCTION IF EXISTS is_manager_of(uuid, uuid);

-- ШАГ 3: Создаем новые функции
-- ============================================

-- Функция получения текущего user_id из auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Функция проверки владельца записи
CREATE OR REPLACE FUNCTION public.is_owner(user_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = user_id_to_check;
$$;

-- Функция проверки, является ли текущий пользователь руководителем указанного сотрудника
CREATE OR REPLACE FUNCTION public.is_users_manager(employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = employee_id 
      AND manager_id = auth.uid()
  );
$$;

-- Обновляем функцию has_permission для использования auth.uid()
CREATE OR REPLACE FUNCTION public.has_permission(permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.name = permission_name
  );
$$;

-- ШАГ 4: Восстанавливаем RLS политики с новыми функциями
-- ============================================

-- Политики для системных операций (используют SECURITY DEFINER функции)
CREATE POLICY "activity_logs_insert_system"
ON admin_activity_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "audit_log_insert_system"
ON audit_log
FOR INSERT
WITH CHECK (true);

-- ШАГ 5: Обновляем DEFAULT для created_by в diagnostic_stages
-- ============================================

ALTER TABLE diagnostic_stages ALTER COLUMN created_by DROP DEFAULT;
ALTER TABLE diagnostic_stages ALTER COLUMN created_by SET DEFAULT get_current_user_id();

-- ШАГ 6: Добавляем комментарии и индексы для оптимизации
-- ============================================

COMMENT ON TABLE admin_sessions IS 'ВНИМАНИЕ: Эта таблица используется ТОЛЬКО для режима разработки с custom-login. В продакшене используется стандартная Supabase Auth через auth.users.';

-- Индексы для оптимизации проверки прав
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

-- ШАГ 7: Проверка, что все таблицы с RLS остались защищенными
-- ============================================

-- Проверяем, что RLS включен на всех критических таблицах
DO $$
DECLARE
  tables_without_rls text[];
BEGIN
  SELECT array_agg(tablename)
  INTO tables_without_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'users', 'user_roles', 'user_profiles', 
      'diagnostic_stages', 'diagnostic_stage_participants',
      'tasks', 'survey_360_assignments',
      'hard_skill_results', 'soft_skill_results',
      'user_assessment_results', 'meeting_stages',
      'one_on_one_meetings', 'meeting_decisions'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relname = pg_tables.tablename
        AND c.relrowsecurity = true
    );

  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING 'ВНИМАНИЕ: Следующие таблицы не имеют RLS: %', tables_without_rls;
  END IF;
END $$;