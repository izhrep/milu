
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name = 'meetings.manage'
ON CONFLICT DO NOTHING;
