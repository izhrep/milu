-- ====================================================================
-- ИСПРАВЛЕНИЕ РЕКУРСИИ В RLS: ФИНАЛЬНАЯ ВЕРСИЯ
-- ====================================================================

-- 1. Удаляем старую версию is_users_manager
DROP FUNCTION IF EXISTS public.is_users_manager(uuid) CASCADE;

-- 2. Создаём новые security definer функции для проверки менеджера
CREATE OR REPLACE FUNCTION public.is_users_manager(_manager_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = _user_id
      AND manager_id = _manager_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_manager_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_id
  FROM users
  WHERE id = _user_id;
$$;

-- 3. Пересоздаём все RLS политики на таблице users
DROP POLICY IF EXISTS "users_select_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_select_auth_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_insert_auth_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_insert_service_role_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_update_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_update_auth_policy" ON public.users CASCADE;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users CASCADE;

-- SELECT: пользователь видит себя, своих подчинённых или имеет права
CREATE POLICY "users_select_policy"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR has_permission('users.view')
  OR is_users_manager(auth.uid(), id)
  OR get_user_manager_id(auth.uid()) = get_user_manager_id(id)
);

-- INSERT: только с правами users.manage
CREATE POLICY "users_insert_policy"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (has_permission('users.manage'));

-- INSERT для service_role
CREATE POLICY "users_insert_service_role_policy"
ON public.users
FOR INSERT
TO service_role
WITH CHECK (true);

-- UPDATE: себя или с правами users.manage
CREATE POLICY "users_update_policy"
ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR has_permission('users.manage')
)
WITH CHECK (
  id = auth.uid()
  OR has_permission('users.manage')
);

-- DELETE: только с правами users.manage
CREATE POLICY "users_delete_policy"
ON public.users
FOR DELETE
TO authenticated
USING (has_permission('users.manage'));

-- 4. Пересоздаём политики на user_roles
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles CASCADE;

CREATE POLICY "user_roles_select_policy"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_permission('users.view')
);

-- 5. Обновляем политики на tasks (исправляем вызов is_users_manager)
DROP POLICY IF EXISTS "tasks_select_auth_policy" ON public.tasks CASCADE;
DROP POLICY IF EXISTS "tasks_update_auth_policy" ON public.tasks CASCADE;

CREATE POLICY "tasks_select_auth_policy"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_users_manager(auth.uid(), user_id)
  OR has_permission('tasks.view_all')
);

CREATE POLICY "tasks_update_auth_policy"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR is_users_manager(auth.uid(), user_id)
  OR has_permission('tasks.manage')
);

-- Комментарии
COMMENT ON FUNCTION public.is_users_manager IS 'Проверяет, является ли _manager_id менеджером _user_id (SECURITY DEFINER)';
COMMENT ON FUNCTION public.get_user_manager_id IS 'Возвращает ID менеджера пользователя (SECURITY DEFINER)';