-- Удаляем старые политики для meeting_decisions
DROP POLICY IF EXISTS "Users can create decisions for their meetings" ON meeting_decisions;
DROP POLICY IF EXISTS "Users can update their own decisions" ON meeting_decisions;
DROP POLICY IF EXISTS "Users can view decisions for their meetings" ON meeting_decisions;

-- Политики для meeting_decisions
-- Admins могут все (уже есть)

-- Сотрудники могут создавать решения для своих встреч
CREATE POLICY "Employees can create decisions for their meetings"
ON meeting_decisions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND m.employee_id = auth.uid()
  )
);

-- Сотрудники могут редактировать решения в своих встречах
CREATE POLICY "Employees can update decisions in their meetings"
ON meeting_decisions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND m.employee_id = auth.uid()
  )
);

-- Руководители могут редактировать решения в встречах подчиненных
CREATE POLICY "Managers can update decisions in subordinate meetings"
ON meeting_decisions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND m.manager_id = auth.uid()
  )
);

-- Сотрудники и руководители могут просматривать решения в своих встречах
CREATE POLICY "Users can view decisions in their meetings"
ON meeting_decisions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id = auth.uid() OR m.manager_id = auth.uid())
  )
);

-- Удаляем старую политику для обновления руководителями
DROP POLICY IF EXISTS "Managers can update submitted meetings" ON one_on_one_meetings;

-- Руководители могут обновлять встречи подчиненных (submitted и approved)
CREATE POLICY "Managers can update subordinate meetings"
ON one_on_one_meetings
FOR UPDATE
TO authenticated
USING (
  manager_id = auth.uid()
  AND status IN ('submitted', 'approved', 'returned')
);