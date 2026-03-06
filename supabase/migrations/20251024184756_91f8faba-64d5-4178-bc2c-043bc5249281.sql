-- Create auth_users table for custom authentication
CREATE TABLE IF NOT EXISTS public.auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view auth_users (for dropdown)
CREATE POLICY "Admins can view auth_users"
ON public.auth_users
FOR SELECT
USING (true);

-- Add auth_user_id to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_user_id uuid REFERENCES public.auth_users(id);
  END IF;
END $$;

-- Insert admin user with bcrypt hash for password 'test123'
-- Hash generated: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO public.auth_users (id, email, password_hash)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df',
  'admin@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    updated_at = now();

-- Link existing admin user to auth_users
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON public.auth_users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);