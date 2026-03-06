-- Разрешаем всем аутентифицированным пользователям читать свои роли
-- Это необходимо для работы функции has_role

-- Удаляем старую политику, если она есть
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Создаем новую политику для чтения своих ролей
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());