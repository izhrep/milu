
-- ============================================
-- КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: has_permission должна использовать кэш
-- ============================================

-- Переписываем функцию has_permission для использования кэша user_effective_permissions
CREATE OR REPLACE FUNCTION public.has_permission(permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Сначала проверяем кэш для текущего пользователя
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = get_current_user_id()
      AND permission_name = has_permission.permission_name
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
        AND p.name = has_permission.permission_name
    )
  );
$function$;

-- Создаём триггеры для автообновления кэша
CREATE OR REPLACE FUNCTION public.trigger_refresh_user_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_effective_permissions(NEW.user_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_user_effective_permissions(OLD.user_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Триггер на изменение user_roles
DROP TRIGGER IF EXISTS trigger_user_roles_changed ON user_roles;
CREATE TRIGGER trigger_user_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_permissions();

-- Создаём функцию для обновления кэша всех пользователей с конкретной ролью
CREATE OR REPLACE FUNCTION public.trigger_refresh_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_role_effective_permissions(NEW.role);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_role_effective_permissions(OLD.role);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Триггер на изменение role_permissions
DROP TRIGGER IF EXISTS trigger_role_permissions_changed ON role_permissions;
CREATE TRIGGER trigger_role_permissions_changed
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_role_permissions();

-- Обновляем кэш для всех существующих пользователей
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM user_roles LOOP
    PERFORM refresh_user_effective_permissions(user_record.user_id);
  END LOOP;
END $$;
