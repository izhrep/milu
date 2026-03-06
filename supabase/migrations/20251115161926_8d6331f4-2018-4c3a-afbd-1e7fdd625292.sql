-- Add policy for users to view colleagues from same department for 360 evaluation
CREATE POLICY "users_can_view_department_colleagues" 
ON users FOR SELECT 
TO authenticated
USING (
  -- Users can view active colleagues from their own department
  status = true 
  AND department_id IN (
    SELECT department_id 
    FROM users 
    WHERE id = auth.uid()
  )
);