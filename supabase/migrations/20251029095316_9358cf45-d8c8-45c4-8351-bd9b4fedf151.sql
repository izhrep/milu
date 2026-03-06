-- Enable Row Level Security for all diagnostic tables

-- 1. skill_survey_assignments
ALTER TABLE public.skill_survey_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow deleting skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Allow updating skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Anyone can create skill survey assignments" ON public.skill_survey_assignments;
DROP POLICY IF EXISTS "Users can view related skill survey assignments" ON public.skill_survey_assignments;

-- Create new policies based on custom auth
CREATE POLICY "Users can view their skill survey assignments"
ON public.skill_survey_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = skill_survey_assignments.evaluated_user_id
      OR admin_sessions.user_id = skill_survey_assignments.evaluating_user_id
  )
);

CREATE POLICY "Users can create skill survey assignments"
ON public.skill_survey_assignments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their skill survey assignments"
ON public.skill_survey_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = skill_survey_assignments.evaluated_user_id
      OR admin_sessions.user_id = skill_survey_assignments.evaluating_user_id
  )
);

CREATE POLICY "Users can delete their skill survey assignments"
ON public.skill_survey_assignments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = skill_survey_assignments.evaluated_user_id
      OR admin_sessions.user_id = skill_survey_assignments.evaluating_user_id
  )
);

-- 2. skill_survey_results
ALTER TABLE public.skill_survey_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view skill survey results"
ON public.skill_survey_results FOR SELECT
USING (true);

CREATE POLICY "Users can insert skill survey results"
ON public.skill_survey_results FOR INSERT
WITH CHECK (true);

-- 3. skill_survey_questions
ALTER TABLE public.skill_survey_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow skill_survey_questions operations for admin panel" ON public.skill_survey_questions;

CREATE POLICY "Everyone can view skill survey questions"
ON public.skill_survey_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skill survey questions"
ON public.skill_survey_questions FOR ALL
USING (true)
WITH CHECK (true);

-- 4. skill_survey_answer_options
ALTER TABLE public.skill_survey_answer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view skill survey answer options"
ON public.skill_survey_answer_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skill survey answer options"
ON public.skill_survey_answer_options FOR ALL
USING (true)
WITH CHECK (true);

-- 5. survey_360_assignments
ALTER TABLE public.survey_360_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow all access to survey_360_assignments" ON public.survey_360_assignments;

CREATE POLICY "Users can view their 360 assignments"
ON public.survey_360_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_assignments.evaluated_user_id
      OR admin_sessions.user_id = survey_360_assignments.evaluating_user_id
  )
);

CREATE POLICY "Users can create 360 assignments"
ON public.survey_360_assignments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their 360 assignments"
ON public.survey_360_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_assignments.evaluated_user_id
      OR admin_sessions.user_id = survey_360_assignments.evaluating_user_id
  )
);

CREATE POLICY "Users can delete their 360 assignments"
ON public.survey_360_assignments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_assignments.evaluated_user_id
      OR admin_sessions.user_id = survey_360_assignments.evaluating_user_id
  )
);

-- 6. survey_360_results
ALTER TABLE public.survey_360_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage survey_360_results" ON public.survey_360_results;
DROP POLICY IF EXISTS "Allow all survey result deletes for testing" ON public.survey_360_results;
DROP POLICY IF EXISTS "Allow all survey result inserts for testing" ON public.survey_360_results;
DROP POLICY IF EXISTS "Allow all survey result reads for testing" ON public.survey_360_results;

CREATE POLICY "Users can view 360 results"
ON public.survey_360_results FOR SELECT
USING (true);

CREATE POLICY "Users can insert 360 results"
ON public.survey_360_results FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their 360 results"
ON public.survey_360_results FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_results.evaluated_user_id
      OR admin_sessions.user_id = survey_360_results.evaluating_user_id
  )
);

-- 7. survey_360_questions
ALTER TABLE public.survey_360_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow survey_360_questions operations for admin panel" ON public.survey_360_questions;

CREATE POLICY "Everyone can view 360 questions"
ON public.survey_360_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage 360 questions"
ON public.survey_360_questions FOR ALL
USING (true)
WITH CHECK (true);

-- 8. survey_360_answer_options
ALTER TABLE public.survey_360_answer_options ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow survey_360_answer_options operations for admin panel" ON public.survey_360_answer_options;

CREATE POLICY "Everyone can view 360 answer options"
ON public.survey_360_answer_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage 360 answer options"
ON public.survey_360_answer_options FOR ALL
USING (true)
WITH CHECK (true);

-- 9. survey_360_selections
ALTER TABLE public.survey_360_selections ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow all access to survey_360_selections" ON public.survey_360_selections;

CREATE POLICY "Users can view their 360 selections"
ON public.survey_360_selections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_selections.selector_user_id
      OR admin_sessions.user_id = survey_360_selections.selected_user_id
  )
);

CREATE POLICY "Users can manage their 360 selections"
ON public.survey_360_selections FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_selections.selector_user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_selections.selector_user_id
  )
);

-- 10. skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow skills operations for admin panel" ON public.skills;

CREATE POLICY "Everyone can view skills"
ON public.skills FOR SELECT
USING (true);

CREATE POLICY "Admins can manage skills"
ON public.skills FOR ALL
USING (true)
WITH CHECK (true);

-- 11. user_skills
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow all access to user_skills" ON public.user_skills;

CREATE POLICY "Users can view their skills"
ON public.user_skills FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = user_skills.user_id
  )
);

CREATE POLICY "Users can manage their skills"
ON public.user_skills FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = user_skills.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = user_skills.user_id
  )
);

-- 12. grade_skills
ALTER TABLE public.grade_skills ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Allow grade_skills operations for admin panel" ON public.grade_skills;

CREATE POLICY "Everyone can view grade skills"
ON public.grade_skills FOR SELECT
USING (true);

CREATE POLICY "Admins can manage grade skills"
ON public.grade_skills FOR ALL
USING (true)
WITH CHECK (true);