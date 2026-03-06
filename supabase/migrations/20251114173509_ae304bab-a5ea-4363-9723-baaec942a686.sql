-- Добавляем политику SELECT для таблицы user_roles
-- Все аутентифицированные пользователи должны иметь возможность видеть роли
-- Это необходимо для корректного отображения ролей в интерфейсе

CREATE POLICY "Authenticated users can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);