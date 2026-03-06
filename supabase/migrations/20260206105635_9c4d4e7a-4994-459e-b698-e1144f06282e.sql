-- =====================================================
-- ФАЗА 1: Добавление недостающих permissions
-- =====================================================

-- 1. security.manage_users
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'security.manage_users', 'security', 'manage_users', 
        'Полное управление пользователями системы')
ON CONFLICT (name) DO NOTHING;

-- 2. development.manage
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.manage', 'development', 'manage', 
        'Полное управление планами развития')
ON CONFLICT (name) DO NOTHING;

-- 3. development.view_all
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.view_all', 'development', 'view_all', 
        'Просмотр всех планов развития')
ON CONFLICT (name) DO NOTHING;

-- 4. meetings.view_all
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.view_all', 'meetings', 'view_all', 
        'Просмотр всех встреч 1:1')
ON CONFLICT (name) DO NOTHING;

-- 5. meetings.manage
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.manage', 'meetings', 'manage', 
        'Полное управление встречами 1:1')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ФАЗА 2: Назначение разрешений ролям
-- =====================================================

-- Назначение новых permissions для admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', p.id FROM permissions p 
WHERE p.name IN (
  'security.manage_users',
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначение permissions для hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', p.id FROM permissions p 
WHERE p.name IN (
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage',
  'users.view',
  'security.view_admin_panel'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначение permissions для manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', p.id FROM permissions p 
WHERE p.name IN (
  'diagnostics.export_results',
  'development.view_all'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначение grades.view для всех ролей
INSERT INTO role_permissions (role, permission_id)
SELECT role_name::app_role, p.id 
FROM permissions p, 
     unnest(ARRAY['hr_bp', 'manager', 'employee']) as role_name
WHERE p.name = 'grades.view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- ФАЗА 3: Обновление кэша
-- =====================================================
SELECT refresh_role_effective_permissions('admin');
SELECT refresh_role_effective_permissions('hr_bp');
SELECT refresh_role_effective_permissions('manager');
SELECT refresh_role_effective_permissions('employee');