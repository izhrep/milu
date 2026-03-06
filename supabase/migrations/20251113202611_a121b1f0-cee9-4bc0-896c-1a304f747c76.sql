-- ============================================
-- КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Полное пересоздание has_permission с правильной сигнатурой
-- ============================================

-- Шаг 1: Удаляем ВСЕ версии функции has_permission
DROP FUNCTION IF EXISTS public.has_permission(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(text) CASCADE;

-- Шаг 2: Создаём функцию заново с правильной сигнатурой (только _permission_name)
CREATE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Проверяем кэш для текущего пользователя
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = get_current_user_id()
      AND permission_name = _permission_name
  )
  -- Если кэш пустой (новый пользователь), fallback на прямой запрос
  OR (
    NOT EXISTS (
      SELECT 1 FROM user_effective_permissions 
      WHERE user_id = get_current_user_id()
    )
    AND EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role = rp.role
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = get_current_user_id()
        AND p.name = _permission_name
    )
  );
$function$;