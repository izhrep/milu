-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or update admin user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@example.com',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token;

-- Ensure user exists in public.users
INSERT INTO public.users (id, employee_number, email, last_name, first_name, status)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'ADMIN001',
  'admin@example.com',
  'User',
  'Admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET
  employee_number = EXCLUDED.employee_number,
  email = EXCLUDED.email,
  last_name = EXCLUDED.last_name,
  first_name = EXCLUDED.first_name,
  status = EXCLUDED.status;

-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;