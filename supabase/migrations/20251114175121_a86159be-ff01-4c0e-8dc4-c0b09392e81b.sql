-- Добавляем RLS политики для UPDATE таблицы users
-- Политики позволяют admin и hr_bp обновлять данные пользователей

-- Политика для UPDATE от админов и HR BP
CREATE POLICY "Admins and HR BP can update users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Политика для UPDATE своих данных сотрудниками
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());