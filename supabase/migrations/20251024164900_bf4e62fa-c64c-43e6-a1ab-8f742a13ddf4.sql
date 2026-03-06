-- Step 2: Create permissions tables and helper functions
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, permission_id)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage permissions"
  ON public.permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role = ur.role
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.name = _permission_name
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_manager_id UUID, _employee_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = _employee_id
      AND manager_id = _manager_id
  );
$$;

INSERT INTO public.permissions (name, description, resource, action) VALUES
  ('view_own_data', 'Просмотр своих данных', 'user', 'read'),
  ('view_team_data', 'Просмотр данных команды', 'team', 'read'),
  ('view_all_users', 'Просмотр всех пользователей', 'users', 'read'),
  ('manage_users', 'Управление пользователями', 'users', 'write'),
  ('manage_surveys', 'Управление опросами', 'surveys', 'write'),
  ('view_surveys', 'Просмотр опросов', 'surveys', 'read'),
  ('manage_meetings', 'Управление встречами', 'meetings', 'write'),
  ('view_meetings', 'Просмотр встреч', 'meetings', 'read'),
  ('manage_tasks', 'Управление задачами', 'tasks', 'write'),
  ('view_tasks', 'Просмотр задач', 'tasks', 'read'),
  ('manage_career_tracks', 'Управление карьерными треками', 'career', 'write'),
  ('view_career_tracks', 'Просмотр карьерных треков', 'career', 'read'),
  ('manage_system', 'Администрирование системы', 'system', 'admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_team_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks', 'manage_meetings', 'manage_tasks')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions 
WHERE name IN ('view_all_users', 'manage_users', 'manage_surveys', 'view_surveys', 'manage_meetings', 'view_meetings', 'manage_tasks', 'view_tasks', 'manage_career_tracks', 'view_career_tracks')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions
ON CONFLICT DO NOTHING;

CREATE OR REPLACE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();