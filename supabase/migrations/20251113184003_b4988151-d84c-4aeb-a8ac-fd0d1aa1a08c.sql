-- ========================================
-- ОПТИМИЗАЦИЯ PERMISSION-BASED СИСТЕМЫ (БЕЗ ИЗМЕНЕНИЯ has_permission)
-- ========================================

-- 1. ДОБАВЛЕНИЕ ИНДЕКСОВ ДЛЯ ОПТИМИЗАЦИИ RLS
-- ========================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_diagnostic_stage_id ON tasks(diagnostic_stage_id);

-- 2. ТАБЛИЦА КЭШ-ПРАВ user_effective_permissions
-- ========================================

CREATE TABLE IF NOT EXISTS user_effective_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, permission_name)
);

CREATE INDEX IF NOT EXISTS idx_user_effective_permissions_user_id 
  ON user_effective_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_effective_permissions_lookup 
  ON user_effective_permissions(user_id, permission_name);

ALTER TABLE user_effective_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own effective permissions"
  ON user_effective_permissions
  FOR SELECT
  USING (user_id = get_current_user_id());

-- 3. ФУНКЦИИ ОБНОВЛЕНИЯ КЭШ-ПРАВ
-- ========================================

CREATE OR REPLACE FUNCTION refresh_user_effective_permissions(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_effective_permissions WHERE user_id = target_user_id;
  
  INSERT INTO user_effective_permissions (user_id, permission_name)
  SELECT DISTINCT
    target_user_id,
    p.name
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role = ur.role
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = target_user_id
  ON CONFLICT (user_id, permission_name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_role_effective_permissions(target_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT user_id FROM user_roles WHERE role = target_role
  LOOP
    PERFORM refresh_user_effective_permissions(user_record.user_id);
  END LOOP;
END;
$$;

-- 4. ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ КЭШ-ПРАВ
-- ========================================

CREATE OR REPLACE FUNCTION trigger_refresh_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_effective_permissions(NEW.user_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_user_effective_permissions(OLD.user_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_changed ON user_roles;
CREATE TRIGGER trg_user_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_permissions();

CREATE OR REPLACE FUNCTION trigger_refresh_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_role_effective_permissions(NEW.role);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_role_effective_permissions(OLD.role);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_role_permissions_changed ON role_permissions;
CREATE TRIGGER trg_role_permissions_changed
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_role_permissions();

-- 5. ТАБЛИЦЫ ДЛЯ ГРУППИРОВКИ PERMISSIONS
-- ========================================

CREATE TABLE IF NOT EXISTS permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permission_group_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(group_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_permission_group_permissions_group_id 
  ON permission_group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_permission_group_permissions_permission_id 
  ON permission_group_permissions(permission_id);

ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_group_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permission groups"
  ON permission_groups FOR SELECT USING (true);

CREATE POLICY "Anyone can view permission group mappings"
  ON permission_group_permissions FOR SELECT USING (true);

INSERT INTO permission_groups (name, label, description, icon, display_order) VALUES
  ('users', 'Пользователи', 'Управление пользователями и профилями', '👤', 1),
  ('diagnostics', 'Диагностика', 'Управление диагностическими этапами и результатами', '📊', 2),
  ('surveys', 'Опросы', 'Управление опросами навыков и 360', '📝', 3),
  ('meetings', 'Встречи 1:1', 'Управление встречами один на один', '🤝', 4),
  ('development', 'Развитие', 'Управление планами развития и задачами', '🎯', 5),
  ('tasks', 'Задачи', 'Управление задачами', '✅', 6),
  ('team', 'Команда', 'Просмотр и управление командой', '👥', 7),
  ('analytics', 'Аналитика', 'Доступ к аналитике и отчётам', '📈', 8),
  ('security', 'Безопасность', 'Управление безопасностью и правами доступа', '🔒', 9),
  ('profile', 'Профиль', 'Управление профилями', '👨‍💼', 10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permission_group_permissions (group_id, permission_id)
SELECT pg.id, p.id
FROM permissions p
CROSS JOIN permission_groups pg
WHERE 
  (pg.name = 'users' AND p.resource = 'users') OR
  (pg.name = 'diagnostics' AND p.resource = 'diagnostics') OR
  (pg.name = 'surveys' AND p.resource = 'surveys') OR
  (pg.name = 'meetings' AND p.resource = 'meetings') OR
  (pg.name = 'development' AND p.resource = 'development') OR
  (pg.name = 'tasks' AND p.resource = 'tasks') OR
  (pg.name = 'team' AND p.resource = 'team') OR
  (pg.name = 'analytics' AND p.resource = 'analytics') OR
  (pg.name = 'security' AND p.resource = 'security') OR
  (pg.name = 'profile' AND p.resource = 'profile')
ON CONFLICT DO NOTHING;

-- 6. ТАБЛИЦА ЛОГИРОВАНИЯ ОТКАЗОВ ДОСТУПА
-- ========================================

CREATE TABLE IF NOT EXISTS access_denied_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  permission_name text,
  resource_type text,
  resource_id uuid,
  action_attempted text,
  user_role app_role,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_denied_logs_user_id 
  ON access_denied_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_denied_logs_created_at 
  ON access_denied_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_denied_logs_permission 
  ON access_denied_logs(permission_name);

ALTER TABLE access_denied_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only security managers can view access denied logs"
  ON access_denied_logs
  FOR SELECT
  USING (has_permission('security.view_audit'));

CREATE OR REPLACE FUNCTION log_access_denied(
  _permission_name text,
  _resource_type text DEFAULT NULL,
  _resource_id uuid DEFAULT NULL,
  _action_attempted text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_user_role app_role;
BEGIN
  current_user_id := get_current_user_id();
  
  IF current_user_id IS NOT NULL THEN
    SELECT role INTO current_user_role
    FROM user_roles
    WHERE user_id = current_user_id
    LIMIT 1;
    
    INSERT INTO access_denied_logs (
      user_id,
      permission_name,
      resource_type,
      resource_id,
      action_attempted,
      user_role
    ) VALUES (
      current_user_id,
      _permission_name,
      _resource_type,
      _resource_id,
      _action_attempted,
      current_user_role
    );
  END IF;
END;
$$;

-- 7. ЗАПОЛНЕНИЕ НАЧАЛЬНОГО КЭШ-ПРАВ
-- ========================================

DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM user_roles
  LOOP
    PERFORM refresh_user_effective_permissions(user_record.user_id);
  END LOOP;
END;
$$;