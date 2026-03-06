-- ============================================================================
-- FIX user_profiles RLS AND POLICIES
-- ============================================================================
-- Enable RLS and update policies to use custom auth system
-- ============================================================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies using auth.uid()
DROP POLICY IF EXISTS "Allow all access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage user_profiles" ON user_profiles;

-- Admins can manage all profiles
CREATE POLICY "Admins can manage user_profiles"
ON user_profiles
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON user_profiles
FOR SELECT
USING (user_id = get_current_session_user());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON user_profiles
FOR INSERT
WITH CHECK (user_id = get_current_session_user());

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ RLS enabled on user_profiles
-- ✅ Policies use get_current_session_user() instead of auth.uid()
-- ✅ Users can manage only their own profiles
-- ✅ Admins can manage all profiles
-- ============================================================================