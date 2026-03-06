-- =====================================================
-- ФАЗА 3: Ограничение доступа к персональным данным
-- =====================================================

-- Шаг 1: Создаём функцию для проверки, является ли пользователь руководителем целевого пользователя
CREATE OR REPLACE FUNCTION is_users_manager(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = target_user_id AND manager_id = auth.uid()
  )
$$;

-- Шаг 2: Удаляем старые политики доступа для users
DROP POLICY IF EXISTS "users_can_view_department_colleagues" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "Users can view all active users" ON users;

-- Шаг 3: Создаём новые более строгие политики для users
-- Пользователь видит: себя, своих подчинённых, своего руководителя
-- Админы и HR видят всех
CREATE POLICY "users_select_restricted" ON users
FOR SELECT TO authenticated
USING (
  id = auth.uid() -- Свои данные
  OR manager_id = auth.uid() -- Подчинённые
  OR id = (SELECT manager_id FROM users WHERE id = auth.uid()) -- Руководитель
  OR EXISTS ( -- Админы и HR видят всех
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- Шаг 4: Проверяем существование таблицы user_profiles и создаём политики если есть
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
    -- Удаляем старые политики
    DROP POLICY IF EXISTS "users.view" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
    
    -- Создаём новую ограниченную политику
    EXECUTE 'CREATE POLICY "user_profiles_select_restricted" ON user_profiles
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN (''admin'', ''hr_bp'')
      )
    )';
  END IF;
END
$$;

-- Шаг 5: Даём права на выполнение функции
GRANT EXECUTE ON FUNCTION is_users_manager(uuid) TO authenticated;