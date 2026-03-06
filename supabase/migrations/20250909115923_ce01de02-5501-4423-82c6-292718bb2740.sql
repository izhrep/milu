-- Add SELECT policy for positions table so all users can read position names
CREATE POLICY "Everyone can view positions" 
ON positions 
FOR SELECT 
USING (true);

-- Add SELECT policy for departments table so all users can read department names
CREATE POLICY "Everyone can view departments" 
ON departments 
FOR SELECT 
USING (true);