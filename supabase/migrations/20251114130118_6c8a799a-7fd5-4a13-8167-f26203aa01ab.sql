-- Исправление рекурсивных политик на user_roles
-- Проблема: политики используют has_permission(), который зависит от user_effective_permissions,
-- а user_roles нужен для базовой авторизации

-- Удаляем старые политики
DROP POLICY IF EXISTS "admins_can_view_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "users_can_view_own_role" ON public.user_roles;

-- Создаём простые политики без зависимостей
-- Пользователи могут видеть только свою роль
CREATE POLICY "users_can_view_own_role_simple"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role может делать всё
CREATE POLICY "service_role_full_access"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Проверяем дублирующиеся политики на user_effective_permissions
DROP POLICY IF EXISTS "Users can view their own effective permissions" ON public.user_effective_permissions;

-- Оставляем только политику user_effective_permissions_select_policy
COMMENT ON POLICY "user_effective_permissions_select_policy" ON public.user_effective_permissions 
IS 'Users can view only their own effective permissions';

COMMENT ON POLICY "user_effective_permissions_system_only" ON public.user_effective_permissions 
IS 'Prevents direct user modifications - only triggers can modify';

-- Проверяем функции can_view_users и can_manage_users
CREATE OR REPLACE FUNCTION public.can_view_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = _user_id
      AND permission_name IN ('users.view', 'security.manage_users')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = _user_id
      AND permission_name = 'security.manage_users'
  );
$$;