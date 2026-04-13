
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions WHERE name = 'meetings.edit_summary_date'
ON CONFLICT DO NOTHING;
