-- Удаляем старые политики SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON survey_360_assignments;
DROP POLICY IF EXISTS "survey_360_assignments_insert_auth_policy" ON survey_360_assignments;
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;

-- Создаём новую политику SELECT
CREATE POLICY "survey_360_assignments_select_policy" 
ON survey_360_assignments 
FOR SELECT 
USING (
  -- Оцениваемый видит свои назначения
  evaluated_user_id = auth.uid()
  OR
  -- Оценивающий видит свои задания
  evaluating_user_id = auth.uid()
  OR
  -- Руководитель видит назначения своих подчинённых
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  ))
  OR
  -- HR и админы видят всё
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);

-- Создаём новую политику INSERT
CREATE POLICY "survey_360_assignments_insert_policy" 
ON survey_360_assignments 
FOR INSERT 
WITH CHECK (
  -- Только для своих peer assignments
  evaluated_user_id = auth.uid() 
  AND assignment_type = 'peer'
  AND status = 'pending'
);

-- Создаём новую политику UPDATE
CREATE POLICY "survey_360_assignments_update_policy" 
ON survey_360_assignments 
FOR UPDATE 
USING (
  -- Сотрудник может обновлять только свои peer assignments в статусе pending или rejected
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status IN ('pending', 'rejected')
  )
  OR
  -- Руководитель может обновлять статусы своих подчинённых
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = auth.uid()
    )
    AND assignment_type = 'peer'
  )
  OR
  -- Админы и HR могут всё
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
)
WITH CHECK (
  -- При обновлении проверяем те же условия
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status IN ('pending', 'rejected')
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = auth.uid()
    )
    AND assignment_type = 'peer'
  )
  OR
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);