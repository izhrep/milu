-- Добавляем политику для просмотра пользователей, которых текущий пользователь должен оценивать
CREATE POLICY "users_can_view_evaluated_peers" ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM survey_360_assignments sa
    WHERE sa.evaluating_user_id = auth.uid()
      AND sa.evaluated_user_id = users.id
      AND sa.status IN ('approved', 'pending', 'completed')
  )
);