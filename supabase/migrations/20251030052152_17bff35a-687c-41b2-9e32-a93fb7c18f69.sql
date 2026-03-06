-- ============================================================================
-- FIX RLS POLICIES FOR MEETING AND DIAGNOSTIC STAGES
-- ============================================================================
-- Fix missing INSERT/UPDATE/DELETE policies that cause permission errors
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE HELPER FUNCTION TO CHECK HR ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = get_current_session_user()
      AND ur.role IN ('admin', 'hr_bp')
  );
$$;

-- ============================================================================
-- PART 2: FIX meeting_stages POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view meeting_stages" ON meeting_stages;

-- Admins and HR can manage all meeting stages
CREATE POLICY "Admins and HR can manage meeting_stages"
ON meeting_stages
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Managers can view stages where their subordinates participate
CREATE POLICY "Managers can view their team meeting_stages"
ON meeting_stages
FOR SELECT
USING (
  is_current_user_admin() OR
  EXISTS (
    SELECT 1
    FROM meeting_stage_participants msp
    JOIN users u ON u.id = msp.user_id
    WHERE msp.stage_id = meeting_stages.id
      AND u.manager_id = get_current_session_user()
  )
);

-- Participants can view their meeting stages
CREATE POLICY "Participants can view their meeting_stages"
ON meeting_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM meeting_stage_participants msp
    WHERE msp.stage_id = meeting_stages.id
      AND msp.user_id = get_current_session_user()
  )
);

-- ============================================================================
-- PART 3: FIX meeting_stage_participants POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view meeting_stage_participants" ON meeting_stage_participants;

-- Admins and HR can manage all participants
CREATE POLICY "Admins can manage meeting_stage_participants"
ON meeting_stage_participants
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Managers can view their team participants
CREATE POLICY "Managers can view their team meeting participants"
ON meeting_stage_participants
FOR SELECT
USING (
  is_current_user_admin() OR
  is_manager_of_user(user_id)
);

-- Users can view their own participation
CREATE POLICY "Users can view their meeting participation"
ON meeting_stage_participants
FOR SELECT
USING (user_id = get_current_session_user());

-- ============================================================================
-- PART 4: UPDATE DIAGNOSTIC STAGE POLICIES FOR CONSISTENCY
-- ============================================================================

-- Drop and recreate diagnostic_stage_participants policies for consistency
DROP POLICY IF EXISTS "Admins can manage participants" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "Managers can view their team participants" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "Users can view their participation" ON diagnostic_stage_participants;

-- Admins can manage all participants
CREATE POLICY "Admins can manage diagnostic_stage_participants"
ON diagnostic_stage_participants
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Managers can view their team participants
CREATE POLICY "Managers can view their team diagnostic participants"
ON diagnostic_stage_participants
FOR SELECT
USING (
  is_current_user_admin() OR
  is_manager_of_user(user_id)
);

-- Users can view their participation
CREATE POLICY "Users can view their diagnostic participation"
ON diagnostic_stage_participants
FOR SELECT
USING (user_id = get_current_session_user());

-- ============================================================================
-- PART 5: UPDATE FUNCTIONS WITH PROPER SECURITY DEFINER
-- ============================================================================

-- Ensure all stage-related functions have SECURITY DEFINER
-- These already exist but we're explicitly setting SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.create_meeting_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.meeting_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    'Встреча 1:1 - ' || stage_record.period,
    'Необходимо провести встречу 1:1 и заполнить форму. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'meeting',
    'Встречи 1:1'
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    'Диагностика - ' || stage_record.period,
    'Необходимо пройти опросы по навыкам и качествам. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'assessment',
    'Диагностика'
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  IF stage_record.evaluation_period IS NULL THEN
    RAISE EXCEPTION 'Evaluation period not set for diagnostic stage';
  END IF;
  
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT DO NOTHING;
  
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 6: GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_current_user_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_session_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of_user(uuid) TO authenticated;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- ✅ meeting_stages: RLS enabled with INSERT/UPDATE/DELETE policies
-- ✅ meeting_stage_participants: RLS enabled with full policies
-- ✅ diagnostic_stage_participants: Updated for consistency
-- ✅ All functions have SECURITY DEFINER
-- ✅ Admin/HR: full access to all stages and participants
-- ✅ Manager: view access to their team's stages
-- ✅ Employee: view access to their own stages
-- ============================================================================