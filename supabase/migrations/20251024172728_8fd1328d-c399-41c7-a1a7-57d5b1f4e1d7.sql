-- Change user_roles foreign key to reference public.users instead of auth.users
-- This allows us to assign roles to users managed through external API

-- Drop existing foreign key constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Add new foreign key referencing public.users
ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Now add employee role for all active users who don't have a role yet
INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  'employee'::app_role
FROM public.users u
WHERE u.status = true  -- Only active users
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;