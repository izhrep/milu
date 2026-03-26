-- Grant meetings.delete permission to hr_bp role
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions WHERE name = 'meetings.delete'
ON CONFLICT DO NOTHING;