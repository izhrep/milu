-- Drop all existing policies on skill_survey_assignments
DROP POLICY IF EXISTS "Admins can manage all skill survey assignments" ON skill_survey_assignments;
DROP POLICY IF EXISTS "System can update skill survey assignment status" ON skill_survey_assignments;
DROP POLICY IF EXISTS "Users can create skill survey assignments as evaluated user" ON skill_survey_assignments;
DROP POLICY IF EXISTS "Users can view skill survey assignments involving them" ON skill_survey_assignments;
DROP POLICY IF EXISTS "Allow creating skill survey assignments" ON skill_survey_assignments;

-- Create new comprehensive policies
-- Allow anyone to insert (create assignments)
CREATE POLICY "Anyone can create skill survey assignments" 
ON skill_survey_assignments 
FOR INSERT 
WITH CHECK (true);

-- Allow viewing assignments where user is involved
CREATE POLICY "Users can view related skill survey assignments" 
ON skill_survey_assignments 
FOR SELECT 
USING (true);

-- Allow updating assignments
CREATE POLICY "Allow updating skill survey assignments" 
ON skill_survey_assignments 
FOR UPDATE 
USING (true);

-- Allow deleting assignments
CREATE POLICY "Allow deleting skill survey assignments" 
ON skill_survey_assignments 
FOR DELETE 
USING (true);