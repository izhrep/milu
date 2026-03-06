-- Принудительное удаление функций с CASCADE
DROP FUNCTION IF EXISTS get_current_session_user() CASCADE;
DROP FUNCTION IF EXISTS has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS is_current_user_admin() CASCADE;
DROP FUNCTION IF EXISTS is_manager_of(uuid, uuid) CASCADE;

-- Удаляем DEFAULT для created_by если еще не удалили
ALTER TABLE diagnostic_stages ALTER COLUMN created_by DROP DEFAULT;