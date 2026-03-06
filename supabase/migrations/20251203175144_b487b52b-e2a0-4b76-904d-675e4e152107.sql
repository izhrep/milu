-- Добавляем политику для просмотра всех активных сотрудников/руководителей для выбора респондентов 360
CREATE POLICY "users_can_view_for_peer_selection"
ON public.users
FOR SELECT
USING (
  status = true 
  AND EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = users.id 
    AND ur.role IN ('employee', 'manager')
  )
  AND EXISTS (
    SELECT 1 FROM diagnostic_stage_participants dsp
    WHERE dsp.user_id = auth.uid()
  )
);