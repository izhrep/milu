-- Create audit_log table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view and insert audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX idx_audit_log_admin_id ON public.audit_log(admin_id);
CREATE INDEX idx_audit_log_target_user_id ON public.audit_log(target_user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_id UUID,
  _target_user_id UUID,
  _action_type TEXT,
  _field TEXT DEFAULT NULL,
  _old_value TEXT DEFAULT NULL,
  _new_value TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_log (admin_id, target_user_id, action_type, field, old_value, new_value, details)
  VALUES (_admin_id, _target_user_id, _action_type, _field, _old_value, _new_value, _details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Add last_login_at to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_at') THEN
    ALTER TABLE public.users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;