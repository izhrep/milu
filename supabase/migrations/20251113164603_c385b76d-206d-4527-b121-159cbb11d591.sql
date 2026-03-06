
-- Финальная миграция v2: завершаем permission-based архитектуру

-- Удаляем has_any_role с CASCADE
DROP FUNCTION IF EXISTS public.has_any_role(uuid, app_role[]) CASCADE;

-- Создаём новый файл документации
COMMENT ON DATABASE postgres IS 'Permission-based архитектура доступа полностью внедрена. Используйте has_permission() для всех проверок прав.';
