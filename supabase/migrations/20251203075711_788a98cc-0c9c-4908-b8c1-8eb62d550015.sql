-- Add cookie consent fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cookies_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cookies_consent_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.users.cookies_consent IS 'Whether user has accepted cookie policy';
COMMENT ON COLUMN public.users.cookies_consent_at IS 'Timestamp when user accepted cookie policy';