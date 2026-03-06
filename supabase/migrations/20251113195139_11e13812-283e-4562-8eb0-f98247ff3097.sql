-- =====================================================
-- FULL RLS AUDIT: FIX ALL POTENTIAL RECURSIVE POLICIES
-- =====================================================
-- Date: 2025-11-13
-- Issue: Potential infinite recursion in policies with EXISTS subqueries
-- Solution: Replace with security definer helper functions
-- =====================================================

-- =====================================================
-- STEP 1: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is participant of diagnostic stage
CREATE OR REPLACE FUNCTION public.is_diagnostic_stage_participant(_stage_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM diagnostic_stage_participants
    WHERE stage_id = _stage_id 
      AND user_id = _user_id
  );
$$;

-- Function to check if user is participant of meeting stage
CREATE OR REPLACE FUNCTION public.is_meeting_stage_participant(_stage_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM meeting_stage_participants
    WHERE stage_id = _stage_id 
      AND user_id = _user_id
  );
$$;

-- Function to check if user is involved in meeting (employee or manager)
CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM one_on_one_meetings
    WHERE id = _meeting_id 
      AND (employee_id = _user_id OR manager_id = _user_id)
  );
$$;

-- =====================================================
-- STEP 2: FIX diagnostic_stages POLICIES
-- =====================================================

DROP POLICY IF EXISTS "diagnostic_stages_select_policy" ON public.diagnostic_stages;

-- NEW NON-RECURSIVE SELECT POLICY
CREATE POLICY "diagnostic_stages_select_policy" 
ON public.diagnostic_stages
FOR SELECT
USING (
  has_permission('diagnostics.view_all') 
  OR is_diagnostic_stage_participant(id, get_current_user_id())
);

COMMENT ON POLICY "diagnostic_stages_select_policy" ON public.diagnostic_stages IS 
'Users can see stages if they have global view permission OR are participants. Uses security definer function to avoid recursion.';

-- =====================================================
-- STEP 3: FIX meeting_stages POLICIES
-- =====================================================

DROP POLICY IF EXISTS "meeting_stages_select_policy" ON public.meeting_stages;

-- NEW NON-RECURSIVE SELECT POLICY
CREATE POLICY "meeting_stages_select_policy" 
ON public.meeting_stages
FOR SELECT
USING (
  has_permission('meetings.view_all') 
  OR is_meeting_stage_participant(id, get_current_user_id())
);

COMMENT ON POLICY "meeting_stages_select_policy" ON public.meeting_stages IS 
'Users can see meeting stages if they have global view permission OR are participants. Uses security definer function to avoid recursion.';

-- =====================================================
-- STEP 4: FIX meeting_decisions POLICIES
-- =====================================================

DROP POLICY IF EXISTS "meeting_decisions_select_policy" ON public.meeting_decisions;

-- NEW NON-RECURSIVE SELECT POLICY
CREATE POLICY "meeting_decisions_select_policy" 
ON public.meeting_decisions
FOR SELECT
USING (
  has_permission('meetings.view_all') 
  OR is_meeting_participant(meeting_id, get_current_user_id())
);

COMMENT ON POLICY "meeting_decisions_select_policy" ON public.meeting_decisions IS 
'Users can see meeting decisions if they have global view permission OR are participants in the meeting. Uses security definer function to avoid recursion.';

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

-- All policies now use security definer helper functions instead of direct EXISTS queries
-- This prevents infinite recursion by breaking the chain:
--   Policy → Function (SECURITY DEFINER) → Table → RLS (bypassed due to SECURITY DEFINER)
--
-- Security definer functions execute with the permissions of their owner,
-- bypassing RLS policies on the tables they query.
--
-- Functions created:
-- 1. is_diagnostic_stage_participant(stage_id, user_id) - checks diagnostic_stage_participants
-- 2. is_meeting_stage_participant(stage_id, user_id) - checks meeting_stage_participants
-- 3. is_meeting_participant(meeting_id, user_id) - checks one_on_one_meetings
--
-- Tables fixed:
-- 1. diagnostic_stages - SELECT policy now uses is_diagnostic_stage_participant()
-- 2. meeting_stages - SELECT policy now uses is_meeting_stage_participant()
-- 3. meeting_decisions - SELECT policy now uses is_meeting_participant()
--
-- All other policies remain unchanged as they don't have recursion risks.
-- =====================================================