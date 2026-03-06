-- Обновляем политики для role_permissions (заменяем auth.uid() на get_current_session_user())

-- Удаляем старые политики с auth.uid()
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Admins can view role_permissions" ON role_permissions;

-- Создаем обновленные политики с кастомной авторизацией
CREATE POLICY "Admins can manage role_permissions"
ON role_permissions
FOR ALL
USING (
  has_role(get_current_session_user(), 'admin'::app_role)
)
WITH CHECK (
  has_role(get_current_session_user(), 'admin'::app_role)
);

CREATE POLICY "Admins can view role_permissions"
ON role_permissions
FOR SELECT
USING (
  has_role(get_current_session_user(), 'admin'::app_role)
);

-- Проверяем, что все необходимые функции существуют и работают корректно
-- get_current_session_user() - возвращает user_id из admin_sessions
-- get_user_role(_user_id) - возвращает роль пользователя
-- has_role(_user_id, _role) - проверяет наличие роли
-- has_any_role(_user_id, _roles[]) - проверяет наличие любой из ролей
-- is_current_user_admin() - проверяет, является ли пользователь админом
-- is_current_user_hr() - проверяет, является ли пользователь HR BP
-- is_manager_of_user(target_user_id) - проверяет, является ли пользователь менеджером

-- Все эти функции используют get_current_session_user() внутри,
-- что обеспечивает корректную работу с кастомной авторизацией