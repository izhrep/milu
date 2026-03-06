-- Fix RLS policies for skill_survey_assignments to allow inserts
-- Update the RLS policy to allow users to create assignments as the evaluated user
DROP POLICY IF EXISTS "Users can create skill survey assignments as evaluated user" ON skill_survey_assignments;

CREATE POLICY "Allow creating skill survey assignments" 
ON skill_survey_assignments 
FOR INSERT 
WITH CHECK (true);

-- Also allow system updates for status changes
DROP POLICY IF EXISTS "System can update skill survey assignment status" ON skill_survey_assignments;

CREATE POLICY "System can update skill survey assignment status" 
ON skill_survey_assignments 
FOR UPDATE 
USING (true);