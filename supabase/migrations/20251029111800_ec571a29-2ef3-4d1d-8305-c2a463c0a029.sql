-- =====================================================
-- RLS POLICIES FOR DIAGNOSTIC MODULE
-- Based on custom auth (admin_sessions), not auth.uid()
-- =====================================================

-- Security definer function to get current session user
CREATE OR REPLACE FUNCTION public.get_current_session_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM admin_sessions 
  WHERE id IN (
    SELECT id FROM admin_sessions 
    WHERE expires_at > now() 
    ORDER BY created_at DESC 
    LIMIT 1
  )
  LIMIT 1;
$$;

-- Security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = get_current_session_user()
      AND ur.role = 'admin'
  );
$$;

-- Security definer function to check if user is manager of another user
CREATE OR REPLACE FUNCTION public.is_manager_of_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = target_user_id
      AND manager_id = get_current_session_user()
  );
$$;

-- =====================================================
-- 1. SKILLS TABLE
-- =====================================================

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
DROP POLICY IF EXISTS "Admins can manage skills" ON public.skills;
DROP POLICY IF EXISTS "Everyone can view skills" ON public.skills;

CREATE POLICY "Public can view skills"
ON public.skills FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skills"
ON public.skills FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 2. SUB_SKILLS TABLE
-- =====================================================

ALTER TABLE public.sub_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sub_skills" ON public.sub_skills;
DROP POLICY IF EXISTS "Admins can manage sub_skills" ON public.sub_skills;
DROP POLICY IF EXISTS "Everyone can view sub_skills" ON public.sub_skills;

CREATE POLICY "Public can view sub_skills"
ON public.sub_skills FOR SELECT
USING (true);

CREATE POLICY "Admins can manage sub_skills"
ON public.sub_skills FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 3. SKILL_SURVEY_QUESTIONS TABLE
-- =====================================================

ALTER TABLE public.skill_survey_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view skill survey questions" ON public.skill_survey_questions;
DROP POLICY IF EXISTS "Admins can manage skill survey questions" ON public.skill_survey_questions;
DROP POLICY IF EXISTS "Everyone can view skill survey questions" ON public.skill_survey_questions;

CREATE POLICY "Public can view skill survey questions"
ON public.skill_survey_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skill survey questions"
ON public.skill_survey_questions FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 4. SKILL_SURVEY_ANSWER_OPTIONS TABLE
-- =====================================================

ALTER TABLE public.skill_survey_answer_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view skill survey answer options" ON public.skill_survey_answer_options;
DROP POLICY IF EXISTS "Admins can manage skill survey answer options" ON public.skill_survey_answer_options;
DROP POLICY IF EXISTS "Everyone can view skill survey answer options" ON public.skill_survey_answer_options;
DROP POLICY IF EXISTS "Allow skill_survey_answer_options operations for admin panel" ON public.skill_survey_answer_options;

CREATE POLICY "Public can view skill survey answer options"
ON public.skill_survey_answer_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skill survey answer options"
ON public.skill_survey_answer_options FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 5. SKILL_SURVEY_ASSIGNMENTS TABLE
-- =====================================================

ALTER TABLE public.skill_survey_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Users can create skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Users can update their skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Users can delete their skill survey assignments" ON public.skill_survey_assignments;

-- Users can view assignments where they are evaluated or evaluating
CREATE POLICY "Users can view their skill survey assignments"
ON public.skill_survey_assignments FOR SELECT
USING (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Users can create assignments for themselves or their subordinates
CREATE POLICY "Users can create skill survey assignments"
ON public.skill_survey_assignments FOR INSERT
WITH CHECK (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Users can update their own assignments
CREATE POLICY "Users can update their skill survey assignments"
ON public.skill_survey_assignments FOR UPDATE
USING (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
)
WITH CHECK (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- Users can delete their own assignments
CREATE POLICY "Users can delete their skill survey assignments"
ON public.skill_survey_assignments FOR DELETE
USING (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- =====================================================
-- 6. SKILL_SURVEY_RESULTS TABLE
-- =====================================================

ALTER TABLE public.skill_survey_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view skill survey results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Users can insert skill survey results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Allow inserting skill survey results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Allow reading skill survey results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Admins manage skill_survey_results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Users can view their skill survey results" ON public.skill_survey_results;
DROP POLICY IF EXISTS "Users can insert their skill survey results" ON public.skill_survey_results;

-- Users can view results where they are evaluated, evaluating, or manager
CREATE POLICY "Users can view their skill survey results"
ON public.skill_survey_results FOR SELECT
USING (
  user_id = get_current_session_user()
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(user_id)
);

-- Users can insert results where they are the evaluator
CREATE POLICY "Users can insert their skill survey results"
ON public.skill_survey_results FOR INSERT
WITH CHECK (
  evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- =====================================================
-- 7. SURVEY_360_QUESTIONS TABLE
-- =====================================================

ALTER TABLE public.survey_360_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view 360 questions" ON public.survey_360_questions;
DROP POLICY IF EXISTS "Admins can manage 360 questions" ON public.survey_360_questions;
DROP POLICY IF EXISTS "Everyone can view 360 questions" ON public.survey_360_questions;

CREATE POLICY "Public can view 360 questions"
ON public.survey_360_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage 360 questions"
ON public.survey_360_questions FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 8. SURVEY_360_ANSWER_OPTIONS TABLE
-- =====================================================

ALTER TABLE public.survey_360_answer_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view 360 answer options" ON public.survey_360_answer_options;
DROP POLICY IF EXISTS "Admins can manage 360 answer options" ON public.survey_360_answer_options;
DROP POLICY IF EXISTS "Everyone can view 360 answer options" ON public.survey_360_answer_options;

CREATE POLICY "Public can view 360 answer options"
ON public.survey_360_answer_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage 360 answer options"
ON public.survey_360_answer_options FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 9. SURVEY_360_ASSIGNMENTS TABLE
-- =====================================================

ALTER TABLE public.survey_360_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their 360 assignments" ON public.survey_360_assignments;
DROP POLICY IF EXISTS "Users can create 360 assignments" ON public.survey_360_assignments;
DROP POLICY IF EXISTS "Users can delete their 360 assignments" ON public.survey_360_assignments;

-- Users can view assignments where they are evaluated or evaluating
CREATE POLICY "Users can view their 360 assignments"
ON public.survey_360_assignments FOR SELECT
USING (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Users can create assignments for themselves
CREATE POLICY "Users can create 360 assignments"
ON public.survey_360_assignments FOR INSERT
WITH CHECK (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- Users can delete their own assignments
CREATE POLICY "Users can delete their 360 assignments"
ON public.survey_360_assignments FOR DELETE
USING (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- =====================================================
-- 10. SURVEY_360_RESULTS TABLE
-- =====================================================

ALTER TABLE public.survey_360_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view 360 results" ON public.survey_360_results;
DROP POLICY IF EXISTS "Users can insert 360 results" ON public.survey_360_results;
DROP POLICY IF EXISTS "Users can view their 360 results" ON public.survey_360_results;
DROP POLICY IF EXISTS "Users can insert their 360 results" ON public.survey_360_results;

-- Users can view results where they are evaluated, evaluating, or manager
CREATE POLICY "Users can view their 360 results"
ON public.survey_360_results FOR SELECT
USING (
  evaluated_user_id = get_current_session_user()
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Users can insert results where they are the evaluator
CREATE POLICY "Users can insert their 360 results"
ON public.survey_360_results FOR INSERT
WITH CHECK (
  evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- =====================================================
-- 11. SURVEY_360_SELECTIONS TABLE
-- =====================================================

ALTER TABLE public.survey_360_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their 360 selections" ON public.survey_360_selections;
DROP POLICY IF EXISTS "Users can manage their 360 selections" ON public.survey_360_selections;

-- Users can view their selections (using correct column names)
CREATE POLICY "Users can view their 360 selections"
ON public.survey_360_selections FOR SELECT
USING (
  selector_user_id = get_current_session_user()
  OR selected_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- Users can manage their selections
CREATE POLICY "Users can manage their 360 selections"
ON public.survey_360_selections FOR ALL
USING (
  selector_user_id = get_current_session_user()
  OR is_current_user_admin()
)
WITH CHECK (
  selector_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- =====================================================
-- 12. USER_SKILLS TABLE
-- =====================================================

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their skills" ON public.user_skills;
DROP POLICY IF EXISTS "System can manage user skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users can view user skills" ON public.user_skills;
DROP POLICY IF EXISTS "Admins can manage user skills" ON public.user_skills;

-- Users can view their own skills or if they're a manager
CREATE POLICY "Users can view user skills"
ON public.user_skills FOR SELECT
USING (
  user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(user_id)
);

-- System/admins can manage user skills
CREATE POLICY "Admins can manage user skills"
ON public.user_skills FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- 13. GRADE_SKILLS TABLE
-- =====================================================

ALTER TABLE public.grade_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view grade skills" ON public.grade_skills;
DROP POLICY IF EXISTS "Admins can manage grade skills" ON public.grade_skills;
DROP POLICY IF EXISTS "Public can view grade skills" ON public.grade_skills;

CREATE POLICY "Public can view grade skills"
ON public.grade_skills FOR SELECT
USING (true);

CREATE POLICY "Admins can manage grade skills"
ON public.grade_skills FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_current_session_user() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_of_user(UUID) TO authenticated, anon;