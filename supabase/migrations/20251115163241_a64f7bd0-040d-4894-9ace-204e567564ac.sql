-- Fix DELETE policy for survey_360_assignments to allow users to delete pending peer assignments

DROP POLICY IF EXISTS "survey_360_assignments_delete_policy" ON public.survey_360_assignments;

CREATE POLICY "survey_360_assignments_delete_policy" 
ON public.survey_360_assignments 
FOR DELETE 
TO authenticated
USING (
  -- Пользователь может удалять свои pending peer assignments (те, где он evaluated_user)
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer' AND status = 'pending')
  OR
  -- Пользователи с правами могут удалять любые assignments
  has_permission('diagnostics.manage')
);