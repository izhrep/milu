
-- Добавляем политику для просмотра коллег из своего подразделения для оценки 360
CREATE POLICY "Users can view same department colleagues for 360"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- Пользователь может видеть активных коллег из своего подразделения
  status = true 
  AND department_id = get_user_department_id(auth.uid())
  AND id != auth.uid()  -- Исключаем самого себя
);
