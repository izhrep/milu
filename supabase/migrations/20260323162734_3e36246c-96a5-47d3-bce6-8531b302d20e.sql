INSERT INTO permissions (name, description, resource, action)
VALUES ('system.admin', 'Full system administrator access including diagnostic snapshots', 'system', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name = 'system.admin'
ON CONFLICT DO NOTHING;