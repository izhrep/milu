-- =====================================================
-- ДОБАВЛЕНИЕ ПРАВ ДОСТУПА ДЛЯ ДИАГНОСТИКИ КОМПЕТЕНЦИЙ
-- =====================================================

-- Добавляем права для диагностики, если их ещё нет
INSERT INTO permissions (name, description, resource, action)
VALUES 
  -- Диагностика компетенций
  ('diagnostics.create', 'Создание этапов диагностики', 'diagnostics', 'create'),
  ('diagnostics.view', 'Просмотр этапов диагностики', 'diagnostics', 'view'),
  ('diagnostics.update', 'Редактирование этапов диагностики', 'diagnostics', 'update'),
  ('diagnostics.delete', 'Удаление этапов диагностики', 'diagnostics', 'delete'),
  ('diagnostics.manage_participants', 'Управление участниками диагностики', 'diagnostics', 'manage_participants'),
  ('diagnostics.view_results', 'Просмотр результатов диагностики', 'diagnostics', 'view_results'),
  ('diagnostics.export_results', 'Экспорт результатов диагностики', 'diagnostics', 'export_results'),
  
  -- Задачи
  ('tasks.create', 'Создание задач', 'tasks', 'create'),
  ('tasks.view', 'Просмотр задач', 'tasks', 'view'),
  ('tasks.update', 'Редактирование задач', 'tasks', 'update'),
  ('tasks.delete', 'Удаление задач', 'tasks', 'delete'),
  
  -- Карьерные треки
  ('career.create', 'Создание карьерных треков', 'career', 'create'),
  ('career.update', 'Редактирование карьерных треков', 'career', 'update'),
  ('career.delete', 'Удаление карьерных треков', 'career', 'delete'),
  
  -- Команда
  ('team.view', 'Просмотр команды', 'team', 'view'),
  ('team.manage', 'Управление командой', 'team', 'manage'),
  
  -- Развитие
  ('development.view', 'Просмотр планов развития', 'development', 'view'),
  ('development.create', 'Создание планов развития', 'development', 'create'),
  ('development.update', 'Редактирование планов развития', 'development', 'update')
ON CONFLICT (name) DO NOTHING;

-- Назначаем права администратору (он должен иметь все права)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'tasks.create', 'tasks.view', 'tasks.update', 'tasks.delete',
  'career.create', 'career.update', 'career.delete',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначаем права HR BP
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update',
  'reports.view', 'reports.export'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначаем права руководителю
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view', 'diagnostics.view_results',
  'team.view', 'team.manage',
  'meetings.create', 'meetings.view', 'meetings.update', 'meetings.approve',
  'tasks.view', 'tasks.create', 'tasks.update',
  'development.view', 'development.create', 'development.update',
  'reports.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Назначаем права сотруднику
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view',
  'surveys.view',
  'tasks.view',
  'development.view',
  'career.read',
  'meetings.create', 'meetings.view', 'meetings.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;

COMMENT ON TABLE permissions IS 'Таблица прав доступа для ролевой модели';
COMMENT ON TABLE role_permissions IS 'Связь ролей и прав доступа';