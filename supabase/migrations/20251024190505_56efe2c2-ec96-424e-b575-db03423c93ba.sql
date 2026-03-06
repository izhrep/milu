-- Назначение прав для ролей (только добавление недостающих)
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions WHERE name IN (
  'view_all_users', 'manage_users', 'permissions.view', 'permissions.manage', 
  'view_surveys', 'manage_surveys', 'view_meetings', 'manage_meetings',
  'view_tasks', 'manage_tasks', 'view_career_tracks', 'manage_career_tracks',
  'view_own_data', 'view_team_data', 'manage_system', 'audit.view',
  'departments.view', 'departments.create', 'departments.update', 'departments.delete',
  'grades.view', 'grades.create', 'grades.update', 'grades.delete',
  'users.create', 'users.update', 'users.delete', 'users.view',
  'roles.view', 'roles.manage', 'surveys.view', 'surveys.create',
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  'reports.view', 'positions.create'
)
ON CONFLICT DO NOTHING;

-- Назначение базовых прав для роли manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'manage_meetings', 'view_meetings',
  'meetings.create', 'meetings.update', 'meetings.approve', 'reports.view', 'view_surveys'
)
ON CONFLICT DO NOTHING;

-- Назначение базовых прав для роли employee
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'meetings.create', 'view_meetings',
  'surveys.view', 'view_surveys', 'view_tasks', 'view_own_data'
)
ON CONFLICT DO NOTHING;