-- ====================================================================
-- Миграция: Исправление системы прав для роли manager
-- Цель: Ограничить доступ manager к админ-панели и всем пользователям
-- ====================================================================

-- 1. Создание нового разрешения для доступа к админ-панели
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.view_admin_panel', 'security', 'view_admin_panel', 'Доступ к административной панели')
ON CONFLICT (name) DO NOTHING;

-- 2. Создание разрешения для просмотра всех пользователей (отличается от users.view)
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_all', 'users', 'view_all', 'Просмотр всех пользователей системы')
ON CONFLICT (name) DO NOTHING;

-- 3. Создание разрешения для просмотра пользователей департамента (для HR BP)
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_department', 'users', 'view_department', 'Просмотр пользователей своего департамента')
ON CONFLICT (name) DO NOTHING;

-- 4. Назначение разрешения security.view_admin_panel ТОЛЬКО admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'security.view_admin_panel'
ON CONFLICT DO NOTHING;

-- 5. Назначение разрешения users.view_all ТОЛЬКО admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_all'
ON CONFLICT DO NOTHING;

-- 6. Назначение разрешения users.view_department для hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_department'
ON CONFLICT DO NOTHING;

-- 7. Удаление разрешения users.view у manager и hr_bp (оставляем только у admin)
DELETE FROM role_permissions
WHERE role IN ('manager', 'hr_bp')
  AND permission_id IN (SELECT id FROM permissions WHERE name = 'users.view');

-- 8. Обновление RLS политики для таблицы users
-- Удаляем старую политику SELECT
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- Создаём новую политику SELECT с правильной логикой
CREATE POLICY "users_select_policy" ON users
FOR SELECT
USING (
  -- Сам пользователь всегда видит свою запись
  id = auth.uid()
  OR
  -- Admin видит всех через разрешение users.view_all
  has_permission('users.view_all')
  OR
  -- Manager видит только своих подчинённых
  (
    has_permission('team.view') 
    AND id IN (
      SELECT u.id 
      FROM users u 
      WHERE u.manager_id = auth.uid()
    )
  )
  OR
  -- HR BP видит пользователей своего департамента
  (
    has_permission('users.view_department')
    AND department_id IN (
      SELECT u.department_id 
      FROM users u 
      WHERE u.id = auth.uid()
    )
  )
);

-- 9. Пересобрать user_effective_permissions для всех пользователей
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT u.id 
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
  LOOP
    PERFORM refresh_user_effective_permissions(user_record.id);
  END LOOP;
END $$;

-- 10. Комментарии для документирования изменений
COMMENT ON POLICY "users_select_policy" ON users IS 
'Ограниченный доступ к пользователям:
- Пользователь видит себя
- Admin видит всех (users.view_all)
- Manager видит только подчинённых (team.view)
- HR BP видит пользователей своего департамента (users.view_department)';
