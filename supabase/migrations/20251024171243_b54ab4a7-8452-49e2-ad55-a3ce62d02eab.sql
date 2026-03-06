-- Добавляем базовые права доступа для системы
INSERT INTO permissions (name, description, resource, action) VALUES
  -- Права на пользователей
  ('users.view', 'Просмотр пользователей', 'users', 'view'),
  ('users.create', 'Создание пользователей', 'users', 'create'),
  ('users.update', 'Редактирование пользователей', 'users', 'update'),
  ('users.delete', 'Удаление пользователей', 'users', 'delete'),
  ('users.manage_roles', 'Управление ролями пользователей', 'users', 'manage_roles'),
  
  -- Права на роли
  ('roles.view', 'Просмотр ролей', 'roles', 'view'),
  ('roles.create', 'Создание ролей', 'roles', 'create'),
  ('roles.update', 'Редактирование ролей', 'roles', 'update'),
  ('roles.delete', 'Удаление ролей', 'roles', 'delete'),
  
  -- Права на подразделения
  ('departments.view', 'Просмотр подразделений', 'departments', 'view'),
  ('departments.create', 'Создание подразделений', 'departments', 'create'),
  ('departments.update', 'Редактирование подразделений', 'departments', 'update'),
  ('departments.delete', 'Удаление подразделений', 'departments', 'delete'),
  
  -- Права на должности
  ('positions.view', 'Просмотр должностей', 'positions', 'view'),
  ('positions.create', 'Создание должностей', 'positions', 'create'),
  ('positions.update', 'Редактирование должностей', 'positions', 'update'),
  ('positions.delete', 'Удаление должностей', 'positions', 'delete'),
  
  -- Права на грейды
  ('grades.view', 'Просмотр грейдов', 'grades', 'view'),
  ('grades.create', 'Создание грейдов', 'grades', 'create'),
  ('grades.update', 'Редактирование грейдов', 'grades', 'update'),
  ('grades.delete', 'Удаление грейдов', 'grades', 'delete'),
  
  -- Права на навыки
  ('skills.view', 'Просмотр навыков', 'skills', 'view'),
  ('skills.create', 'Создание навыков', 'skills', 'create'),
  ('skills.update', 'Редактирование навыков', 'skills', 'update'),
  ('skills.delete', 'Удаление навыков', 'skills', 'delete'),
  
  -- Права на качества
  ('qualities.view', 'Просмотр качеств', 'qualities', 'view'),
  ('qualities.create', 'Создание качеств', 'qualities', 'create'),
  ('qualities.update', 'Редактирование качеств', 'qualities', 'update'),
  ('qualities.delete', 'Удаление качеств', 'qualities', 'delete'),
  
  -- Права на опросы
  ('surveys.view', 'Просмотр опросов', 'surveys', 'view'),
  ('surveys.create', 'Создание опросов', 'surveys', 'create'),
  ('surveys.assign', 'Назначение опросов', 'surveys', 'assign'),
  ('surveys.results', 'Просмотр результатов опросов', 'surveys', 'results'),
  
  -- Права на встречи
  ('meetings.view', 'Просмотр встреч', 'meetings', 'view'),
  ('meetings.create', 'Создание встреч', 'meetings', 'create'),
  ('meetings.update', 'Редактирование встреч', 'meetings', 'update'),
  ('meetings.approve', 'Утверждение встреч', 'meetings', 'approve'),
  
  -- Права на отчёты
  ('reports.view', 'Просмотр отчётов', 'reports', 'view'),
  ('reports.export', 'Экспорт отчётов', 'reports', 'export'),
  
  -- Права на настройки
  ('settings.view', 'Просмотр настроек', 'settings', 'view'),
  ('settings.update', 'Изменение настроек', 'settings', 'update'),
  
  -- Права на сессии
  ('sessions.view', 'Просмотр сессий', 'sessions', 'view'),
  ('sessions.revoke', 'Завершение сессий', 'sessions', 'revoke'),
  
  -- Права на аудит
  ('audit.view', 'Просмотр журнала аудита', 'audit', 'view'),
  
  -- Права на управление правами
  ('permissions.view', 'Просмотр прав доступа', 'permissions', 'view'),
  ('permissions.manage', 'Управление правами доступа', 'permissions', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Назначаем базовые права для роли HR BP
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'users.view',
  'users.create', 
  'users.update',
  'departments.view',
  'positions.view',
  'surveys.view',
  'surveys.assign',
  'surveys.results',
  'reports.view',
  'reports.export'
)
ON CONFLICT DO NOTHING;

-- Назначаем базовые права для роли Manager (Руководитель)
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'users.view',
  'surveys.view',
  'surveys.results',
  'meetings.view',
  'meetings.create',
  'meetings.update',
  'meetings.approve',
  'reports.view'
)
ON CONFLICT DO NOTHING;

-- Назначаем базовые права для роли Employee (Сотрудник)
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'surveys.view',
  'meetings.view',
  'meetings.create'
)
ON CONFLICT DO NOTHING;