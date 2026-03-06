-- =====================================================
-- FIX: Restrict INSERT policies on log tables
-- Problem: access_denied_logs, admin_activity_logs, audit_log 
-- have INSERT WITH CHECK (true) - anyone can spoof logs
-- Solution: Only authenticated users can insert, and only their own ID
-- =====================================================

-- 1. Drop existing overly permissive INSERT policies
DROP POLICY IF EXISTS "access_denied_logs_insert_system" ON access_denied_logs;
DROP POLICY IF EXISTS "admin_activity_logs_insert_system" ON admin_activity_logs;
DROP POLICY IF EXISTS "audit_log_insert_system" ON audit_log;

-- 2. Create restricted INSERT policies
-- For access_denied_logs: user can only log their own denied access
CREATE POLICY "access_denied_logs_insert_own"
ON access_denied_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- For admin_activity_logs: only admins can insert, and must use their own user_id
CREATE POLICY "admin_activity_logs_insert_admin_only"
ON admin_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- For audit_log: only admins can insert, and must use their own admin_id
CREATE POLICY "audit_log_insert_admin_only"
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);