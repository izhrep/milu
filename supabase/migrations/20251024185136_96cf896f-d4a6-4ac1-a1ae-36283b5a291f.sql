-- Update auth_user_id for admin user to link correctly
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com' AND auth_user_id IS NULL;