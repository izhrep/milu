-- Enable RLS on user_career_progress
ALTER TABLE public.user_career_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own career progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Users can manage their own career progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Admins can manage all career progress" ON public.user_career_progress;

-- Users can view their own career progress
CREATE POLICY "Users can view their own career progress"
ON public.user_career_progress
FOR SELECT
USING (user_id = get_current_session_user() OR is_current_user_admin());

-- Users can insert their own career progress
CREATE POLICY "Users can insert their own career progress"
ON public.user_career_progress
FOR INSERT
WITH CHECK (user_id = get_current_session_user() OR is_current_user_admin());

-- Users can update their own career progress
CREATE POLICY "Users can update their own career progress"
ON public.user_career_progress
FOR UPDATE
USING (user_id = get_current_session_user() OR is_current_user_admin());

-- Users can delete their own career progress
CREATE POLICY "Users can delete their own career progress"
ON public.user_career_progress
FOR DELETE
USING (user_id = get_current_session_user() OR is_current_user_admin());