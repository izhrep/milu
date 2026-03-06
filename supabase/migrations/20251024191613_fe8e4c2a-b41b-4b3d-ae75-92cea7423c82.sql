-- Enable RLS on user_roles if not enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all user roles
CREATE POLICY "Admins can view all user roles"
ON user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow users to view their own role
CREATE POLICY "Users can view their own role"
ON user_roles
FOR SELECT
USING (user_id = auth.uid());