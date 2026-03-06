-- Добавляем политику для анонимного чтения активных пользователей из auth_users
-- Это необходимо для формы авторизации
DROP POLICY IF EXISTS "auth_users_admin_only" ON auth_users;

-- Только активные пользователи видны всем (для формы логина)
CREATE POLICY "auth_users_select_active"
ON auth_users
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Администраторы могут видеть всех пользователей (включая неактивных)
CREATE POLICY "auth_users_select_admin"
ON auth_users
FOR SELECT
TO authenticated
USING (is_current_user_admin());