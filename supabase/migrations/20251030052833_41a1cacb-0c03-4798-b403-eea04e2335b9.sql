-- ============================================================================
-- FIX DIAGNOSTIC_STAGES INSERT POLICY
-- ============================================================================
-- Allow admins to create diagnostic stages with created_by field
-- ============================================================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admins can manage diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Managers can view diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Participants can view their diagnostic stages" ON diagnostic_stages;

-- Admins and HR can fully manage diagnostic stages (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage diagnostic stages"
ON diagnostic_stages
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Managers can view stages where their subordinates participate
CREATE POLICY "Managers can view diagnostic stages"
ON diagnostic_stages
FOR SELECT
USING (
  is_current_user_admin() OR
  EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants dsp
    JOIN users u ON u.id = dsp.user_id
    WHERE dsp.stage_id = diagnostic_stages.id
      AND u.manager_id = get_current_session_user()
  )
);

-- Participants can view their diagnostic stages
CREATE POLICY "Participants can view their diagnostic stages"
ON diagnostic_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants
    WHERE diagnostic_stage_participants.stage_id = diagnostic_stages.id
      AND diagnostic_stage_participants.user_id = get_current_session_user()
  )
);

-- ============================================================================
-- ENSURE created_by HAS DEFAULT VALUE
-- ============================================================================

-- Update the column to have a default value for created_by
ALTER TABLE diagnostic_stages 
ALTER COLUMN created_by SET DEFAULT get_current_session_user();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ Admins can INSERT diagnostic stages
-- ✅ created_by will be automatically filled with current user
-- ✅ All policies properly use is_current_user_admin()
-- ============================================================================