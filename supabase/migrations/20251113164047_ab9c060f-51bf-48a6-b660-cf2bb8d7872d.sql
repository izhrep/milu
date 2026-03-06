
-- =====================================================
-- ПОЛНАЯ ПЕРЕСТРОЙКА АРХИТЕКТУРЫ ПРАВ ДОСТУПА
-- Permission-Based Access Control System v2
-- =====================================================

-- =====================================================
-- ЭТАП 1: Обновление функции has_permission() с CASCADE
-- =====================================================

-- Удаляем старую версию с CASCADE для удаления зависимых политик
DROP FUNCTION IF EXISTS public.has_permission(uuid, text) CASCADE;

-- Создаём новую улучшенную версию с автоматическими правами для admin
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Получаем роль пользователя
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  -- Если роль не найдена, возвращаем false
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Администратор имеет ВСЕ права автоматически
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Для остальных ролей проверяем наличие конкретного разрешения
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role = ur.role
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.name = _permission_name
  );
END;
$$;

COMMENT ON FUNCTION public.has_permission(uuid, text) IS 
'Проверяет наличие разрешения у пользователя. Администраторы имеют все права автоматически.';

-- =====================================================
-- ЭТАП 2: Обновление и синхронизация таблицы permissions
-- =====================================================

-- Удаляем устаревшие разрешения (дубликаты с разными форматами)
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE name IN (
    'view_career_tracks', 'manage_career_tracks', 
    'view_meetings', 'manage_meetings',
    'view_surveys', 'manage_surveys',
    'view_tasks', 'manage_tasks',
    'view_all_users', 'manage_users', 'manage_system',
    'view_own_data', 'view_team_data'
  )
);

DELETE FROM permissions WHERE name IN (
  'view_career_tracks', 'manage_career_tracks', 
  'view_meetings', 'manage_meetings',
  'view_surveys', 'manage_surveys',
  'view_tasks', 'manage_tasks',
  'view_all_users', 'manage_users', 'manage_system',
  'view_own_data', 'view_team_data'
);

-- Добавляем недостающие разрешения
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Пользователи
  ('users.manage_roles', 'users', 'manage_roles', 'Управление ролями пользователей'),
  
  -- Встречи
  ('meetings.delete', 'meetings', 'delete', 'Удаление встреч'),
  ('meetings.return', 'meetings', 'return', 'Возврат встреч на доработку'),
  
  -- Опросы
  ('surveys.delete', 'surveys', 'delete', 'Удаление опросов'),
  ('surveys.update', 'surveys', 'update', 'Редактирование опросов'),
  ('surveys.manage', 'surveys', 'manage', 'Управление всеми опросами'),
  
  -- Навыки
  ('skills.create', 'skills', 'create', 'Создание навыков'),
  ('skills.update', 'skills', 'update', 'Редактирование навыков'),
  ('skills.delete', 'skills', 'delete', 'Удаление навыков'),
  ('skills.view', 'skills', 'view', 'Просмотр навыков'),
  
  -- Качества
  ('qualities.create', 'qualities', 'create', 'Создание качеств'),
  ('qualities.update', 'qualities', 'update', 'Редактирование качеств'),
  ('qualities.delete', 'qualities', 'delete', 'Удаление качеств'),
  ('qualities.view', 'qualities', 'view', 'Просмотр качеств'),
  
  -- Должности
  ('positions.update', 'positions', 'update', 'Редактирование должностей'),
  ('positions.delete', 'positions', 'delete', 'Удаление должностей'),
  
  -- Отчёты
  ('reports.create', 'reports', 'create', 'Создание отчётов'),
  ('reports.update', 'reports', 'update', 'Редактирование отчётов'),
  ('reports.delete', 'reports', 'delete', 'Удаление отчётов'),
  
  -- Развитие
  ('development.delete', 'development', 'delete', 'Удаление планов развития'),
  
  -- Задачи
  ('tasks.view_all', 'tasks', 'view_all', 'Просмотр всех задач'),
  ('tasks.view_team', 'tasks', 'view_team', 'Просмотр задач команды')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ЭТАП 3: Обновление role_permissions для всех ролей
-- =====================================================

-- Очищаем все связи для пересоздания
DELETE FROM role_permissions;

-- Роль: admin (автоматически получает все права через has_permission, но заполним для UI)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions;

-- Роль: hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи
  'users.view', 'users.create', 'users.update',
  -- Диагностика
  'diagnostics.view', 'diagnostics.create', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.view_results', 'diagnostics.export_results', 'diagnostics.manage_participants',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update', 'development.delete',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.assign', 'surveys.results', 'surveys.manage',
  -- Карьера
  'career.update', 'career.create', 'career.delete',
  -- Отчёты
  'reports.view', 'reports.export',
  -- Подразделения
  'departments.view',
  -- Должности
  'positions.view'
);

-- Роль: manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи (только просмотр)
  'users.view',
  -- Диагностика
  'diagnostics.view', 'diagnostics.view_results',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.results',
  -- Карьера
  'career.update',
  -- Отчёты
  'reports.view'
);

-- Роль: employee
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions WHERE name IN (
  -- Диагностика
  'diagnostics.view',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update',
  -- Развитие
  'development.view',
  -- Задачи
  'tasks.view',
  -- Опросы
  'surveys.view',
  -- Карьера (просмотр)
  'career.update'
);

-- =====================================================
-- ЭТАП 4: Переписываем ВСЕ RLS политики на has_permission
-- =====================================================

-- Восстанавливаем политики для diagnostic_stages
CREATE POLICY "Users with diagnostics.view can view stages"
  ON diagnostic_stages FOR SELECT
  TO authenticated
  USING (
    has_permission(get_current_session_user(), 'diagnostics.view')
    OR EXISTS (
      SELECT 1 FROM diagnostic_stage_participants
      WHERE stage_id = diagnostic_stages.id 
        AND user_id = get_current_session_user()
    )
    OR EXISTS (
      SELECT 1 FROM diagnostic_stage_participants dsp
      JOIN users u ON u.id = dsp.user_id
      WHERE dsp.stage_id = diagnostic_stages.id 
        AND u.manager_id = get_current_session_user()
    )
  );

CREATE POLICY "Users with diagnostics.manage can modify stages"
  ON diagnostic_stages FOR ALL
  TO authenticated
  USING (has_permission(get_current_session_user(), 'diagnostics.manage'))
  WITH CHECK (has_permission(get_current_session_user(), 'diagnostics.manage'));

-- --- ТАБЛИЦА: users ---
DROP POLICY IF EXISTS "Allow users to view their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Admin access to users" ON users;

CREATE POLICY "Users with users.view can view users"
  ON users FOR SELECT
  TO authenticated
  USING (
    has_permission(get_current_session_user(), 'users.view')
    OR id = get_current_session_user()
  );

CREATE POLICY "Users with users.update can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'users.update'));

CREATE POLICY "Users with users.create can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(get_current_session_user(), 'users.create'));

CREATE POLICY "Users with users.delete can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.delete'));

-- --- ТАБЛИЦА: user_profiles ---
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "HR can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "HR can update all profiles" ON user_profiles;

CREATE POLICY "Users with users.view can view profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    has_permission(get_current_session_user(), 'users.view')
    OR user_id = get_current_session_user()
  );

CREATE POLICY "Users with users.update can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'users.update'));

CREATE POLICY "Users with users.create can create profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(get_current_session_user(), 'users.create'));

-- --- ТАБЛИЦА: user_roles ---
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "HR can view user roles" ON user_roles;
DROP POLICY IF EXISTS "HR can manage user roles" ON user_roles;

CREATE POLICY "Users with users.view can view roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    has_permission(get_current_session_user(), 'users.view')
    OR user_id = get_current_session_user()
  );

CREATE POLICY "Users with users.manage_roles can manage roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.manage_roles'))
  WITH CHECK (has_permission(get_current_session_user(), 'users.manage_roles'));

-- --- ТАБЛИЦА: tasks ---
DROP POLICY IF EXISTS "Users can manage their tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;

CREATE POLICY "Users can view their own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.view_all')
    OR (has_permission(get_current_session_user(), 'tasks.view_team') AND EXISTS (
      SELECT 1 FROM users WHERE id = tasks.user_id AND manager_id = get_current_session_user()
    ))
  );

CREATE POLICY "Users with tasks.create can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.create')
  );

CREATE POLICY "Users with tasks.update can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.update')
  )
  WITH CHECK (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.update')
  );

CREATE POLICY "Users with tasks.delete can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'tasks.delete'));

-- --- ТАБЛИЦА: development_plans ---
DROP POLICY IF EXISTS "Everyone can view development_plans" ON development_plans;
DROP POLICY IF EXISTS "dev_plans_all_hr" ON development_plans;
DROP POLICY IF EXISTS "dev_plans_select_manager" ON development_plans;
DROP POLICY IF EXISTS "dev_plans_select_own" ON development_plans;

CREATE POLICY "Users can view development plans"
  ON development_plans FOR SELECT
  TO authenticated
  USING (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'development.view')
    OR (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users WHERE id = development_plans.user_id AND manager_id = get_current_session_user()
    ))
  );

CREATE POLICY "Users with development.create can create plans"
  ON development_plans FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(get_current_session_user(), 'development.create'));

CREATE POLICY "Users with development.update can update plans"
  ON development_plans FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'development.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'development.update'));

CREATE POLICY "Users with development.delete can delete plans"
  ON development_plans FOR DELETE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'development.delete'));

-- ... (продолжение см. в следующей части из-за ограничения размера)
