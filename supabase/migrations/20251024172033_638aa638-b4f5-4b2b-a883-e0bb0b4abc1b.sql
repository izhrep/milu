-- Migrate existing roles from public.users to user_roles
-- user_roles references auth.users, so we need to link public.users.id to auth.users

-- First check if there's a link between public.users and auth.users
-- Typically public.users.id should match auth.users.id

INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN r.name ILIKE '%admin%' THEN 'admin'::app_role
    WHEN r.name ILIKE '%hr%' OR r.name ILIKE '%бизнес-партнер%' THEN 'hr_bp'::app_role
    WHEN r.name ILIKE '%manager%' OR r.name ILIKE '%руководитель%' THEN 'manager'::app_role
    ELSE 'employee'::app_role
  END
FROM public.users u
LEFT JOIN roles r ON u.role_id = r.id
INNER JOIN auth.users au ON au.id = u.id  -- Only migrate users that exist in auth
WHERE u.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove the role_id column from public.users table
ALTER TABLE public.users DROP COLUMN IF EXISTS role_id;