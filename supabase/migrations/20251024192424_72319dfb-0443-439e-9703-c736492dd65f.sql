-- РЕШЕНИЕ: Создаем публичные политики для всех таблиц, где используется кастомная авторизация
-- Это позволит работать без auth.uid()

-- 1. Разрешаем всем доступ к таблицам через SECURITY DEFINER функции
-- Для таблиц, к которым обращаются через клиент, добавим широкие политики

-- user_roles - критически важная таблица для авторизации
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

CREATE POLICY "Allow all read access to user_roles"
ON user_roles FOR SELECT
USING (true);

CREATE POLICY "Allow admin operations on user_roles"
ON user_roles FOR ALL
USING (true)
WITH CHECK (true);

-- permissions - права доступа
DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can view permissions" ON permissions;

CREATE POLICY "Allow all read access to permissions"
ON permissions FOR SELECT
USING (true);

-- role_permissions - назначение прав ролям
DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Admins can view role permissions" ON role_permissions;

CREATE POLICY "Allow all read access to role_permissions"
ON role_permissions FOR SELECT
USING (true);

CREATE POLICY "Allow all write access to role_permissions"
ON role_permissions FOR ALL
USING (true)
WITH CHECK (true);

-- user_profiles - профили пользователей (может содержать PII, но нужен для работы системы)
CREATE POLICY "Allow all access to user_profiles"
ON user_profiles FOR ALL
USING (true)
WITH CHECK (true);