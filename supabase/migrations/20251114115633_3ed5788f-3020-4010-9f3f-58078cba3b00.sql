-- Добавляем RLS политику на user_roles для чтения своей роли
CREATE POLICY "users_can_view_own_role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Админы могут видеть все роли
CREATE POLICY "admins_can_view_all_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_permission('security.view_roles'));

-- Проверка
DO $$ 
BEGIN
  RAISE NOTICE 'RLS policies for user_roles created successfully';
END $$;