-- Fix raw_app_meta_data for admin user
UPDATE auth.users 
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND raw_app_meta_data IS NULL;