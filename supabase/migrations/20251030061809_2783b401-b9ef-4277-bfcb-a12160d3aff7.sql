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

-- Удаляем все существующие политики для diagnostic_stages
DROP POLICY IF EXISTS "Admins can manage diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Admins and HR can manage diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Managers can view diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Participants can view their diagnostic stages" ON diagnostic_stages;

-- Создаем новую политику для управления этапами (admin и hr_bp)
CREATE POLICY "Admins and HR can manage diagnostic stages"
ON diagnostic_stages
FOR ALL
USING (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
)
WITH CHECK (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
);

-- Восстанавливаем политики просмотра для менеджеров и участников
CREATE POLICY "Managers can view diagnostic stages"
ON diagnostic_stages
FOR SELECT
USING (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
  OR (EXISTS ( 
    SELECT 1
    FROM (diagnostic_stage_participants dsp
      JOIN users u ON ((u.id = dsp.user_id)))
    WHERE ((dsp.stage_id = diagnostic_stages.id) AND (u.manager_id = get_current_session_user()))
  ))
);

CREATE POLICY "Participants can view their diagnostic stages"
ON diagnostic_stages
FOR SELECT
USING (
  EXISTS ( 
    SELECT 1
    FROM diagnostic_stage_participants
    WHERE ((diagnostic_stage_participants.stage_id = diagnostic_stages.id) 
      AND (diagnostic_stage_participants.user_id = get_current_session_user()))
  )
);