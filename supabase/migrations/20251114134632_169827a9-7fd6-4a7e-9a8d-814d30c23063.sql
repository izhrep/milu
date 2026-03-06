
-- Добавляем разрешение security.manage с указанием resource и action
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.manage', 'security', 'manage', 'Управление безопасностью и пользователями')
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

-- Связываем разрешение с ролью admin через role_permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 
  'admin'::app_role,
  p.id
FROM permissions p
WHERE p.name = 'security.manage'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Обновляем кэш разрешений для всех администраторов
SELECT refresh_role_effective_permissions('admin'::app_role);
