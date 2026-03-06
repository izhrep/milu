-- Создаем функцию для проверки наличия любой из указанных ролей у пользователя
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Обновляем политику для создания этапов диагностики
-- Разрешаем admin и hr_bp создавать этапы
DROP POLICY IF EXISTS "Admins can manage diagnostic stages" ON diagnostic_stages;

CREATE POLICY "Admins and HR can manage diagnostic stages"
ON diagnostic_stages
FOR ALL
USING (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
)
WITH CHECK (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
);