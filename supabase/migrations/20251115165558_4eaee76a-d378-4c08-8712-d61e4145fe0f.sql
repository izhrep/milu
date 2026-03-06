-- Удаляем старую политику UPDATE
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;

-- Создаём новую политику UPDATE с правом для evaluated_user_id обновлять свои peer assignments
CREATE POLICY "survey_360_assignments_update_auth_policy" 
ON survey_360_assignments 
FOR UPDATE 
USING (
  -- Оценивающий может обновлять свои назначения
  evaluating_user_id = auth.uid() 
  OR 
  -- Оцениваемый может обновлять статус своих peer assignments (для отзыва списка)
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer')
  OR
  -- Руководитель оцениваемого может обновлять
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  ))
  OR
  -- Админы и HR BP могут обновлять
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);