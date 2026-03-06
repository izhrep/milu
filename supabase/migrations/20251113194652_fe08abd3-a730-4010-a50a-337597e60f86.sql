-- =====================================================
-- FIX: Infinite Recursion in diagnostic_stage_participants RLS
-- =====================================================
-- Problem: SELECT policy contains EXISTS subquery referencing the same table
-- Solution: Replace with flat, non-recursive checks

-- Drop existing recursive policies
DROP POLICY IF EXISTS "diagnostic_stage_participants_select_policy" ON public.diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_insert_policy" ON public.diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_update_policy" ON public.diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_delete_policy" ON public.diagnostic_stage_participants;

-- =====================================================
-- NEW NON-RECURSIVE POLICIES
-- =====================================================

-- SELECT: User can see their own participation OR has global view permission
CREATE POLICY "diagnostic_stage_participants_select_policy" 
ON public.diagnostic_stage_participants
FOR SELECT
USING (
  user_id = get_current_user_id() 
  OR has_permission('diagnostics.view_all')
);

-- INSERT: Only users with diagnostics.manage permission
CREATE POLICY "diagnostic_stage_participants_insert_policy" 
ON public.diagnostic_stage_participants
FOR INSERT
WITH CHECK (
  has_permission('diagnostics.manage')
);

-- UPDATE: Only users with diagnostics.manage permission
CREATE POLICY "diagnostic_stage_participants_update_policy" 
ON public.diagnostic_stage_participants
FOR UPDATE
USING (has_permission('diagnostics.manage'))
WITH CHECK (has_permission('diagnostics.manage'));

-- DELETE: Only users with diagnostics.manage permission
CREATE POLICY "diagnostic_stage_participants_delete_policy" 
ON public.diagnostic_stage_participants
FOR DELETE
USING (
  has_permission('diagnostics.manage')
);

-- =====================================================
-- SIMILAR FIX FOR meeting_stage_participants
-- =====================================================
-- This table has the same pattern and likely has the same issue

DROP POLICY IF EXISTS "meeting_stage_participants_select_policy" ON public.meeting_stage_participants;
DROP POLICY IF EXISTS "meeting_stage_participants_insert_policy" ON public.meeting_stage_participants;
DROP POLICY IF EXISTS "meeting_stage_participants_update_policy" ON public.meeting_stage_participants;
DROP POLICY IF EXISTS "meeting_stage_participants_delete_policy" ON public.meeting_stage_participants;

-- SELECT: User can see their own participation OR has global view permission
CREATE POLICY "meeting_stage_participants_select_policy" 
ON public.meeting_stage_participants
FOR SELECT
USING (
  user_id = get_current_user_id() 
  OR has_permission('meetings.view_all')
);

-- INSERT: Only users with meetings.manage permission
CREATE POLICY "meeting_stage_participants_insert_policy" 
ON public.meeting_stage_participants
FOR INSERT
WITH CHECK (
  has_permission('meetings.manage')
);

-- UPDATE: Only users with meetings.manage permission
CREATE POLICY "meeting_stage_participants_update_policy" 
ON public.meeting_stage_participants
FOR UPDATE
USING (has_permission('meetings.manage'))
WITH CHECK (has_permission('meetings.manage'));

-- DELETE: Only users with meetings.manage permission
CREATE POLICY "meeting_stage_participants_delete_policy" 
ON public.meeting_stage_participants
FOR DELETE
USING (
  has_permission('meetings.manage')
);

-- =====================================================
-- VERIFICATION COMMENT
-- =====================================================
-- These policies are now completely flat and non-recursive:
-- 1. No subqueries to the same table
-- 2. Only use: get_current_user_id(), has_permission()
-- 3. No JOIN, no EXISTS, no SELECT from same table
-- 4. Simple column comparison (user_id = get_current_user_id())
--
-- Security model:
-- - Users can see only their own participation records
-- - Users with diagnostics.view_all can see all participation records
-- - Only diagnostics.manage permission holders can modify participation
-- =====================================================