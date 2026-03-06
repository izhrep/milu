-- Исправляем RLS политики для diagnostic_stages
-- Удаляем старые политики с неработающей функцией has_any_role
DROP POLICY IF EXISTS "Admins and HR can manage diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Managers can view diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Participants can view their diagnostic stages" ON diagnostic_stages;

-- Создаем новые политики с использованием has_permission
-- SELECT: Пользователи с правом diagnostics.view могут просматривать этапы
CREATE POLICY "Users with diagnostics.view can view stages"
ON diagnostic_stages
FOR SELECT
TO authenticated
USING (
  has_permission(get_current_session_user(), 'diagnostics.view')
  OR EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants
    WHERE diagnostic_stage_participants.stage_id = diagnostic_stages.id
      AND diagnostic_stage_participants.user_id = get_current_session_user()
  )
  OR EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants dsp
    JOIN users u ON u.id = dsp.user_id
    WHERE dsp.stage_id = diagnostic_stages.id
      AND u.manager_id = get_current_session_user()
  )
);

-- INSERT/UPDATE/DELETE: Только пользователи с правом diagnostics.manage
CREATE POLICY "Users with diagnostics.manage can modify stages"
ON diagnostic_stages
FOR ALL
TO authenticated
USING (has_permission(get_current_session_user(), 'diagnostics.manage'))
WITH CHECK (has_permission(get_current_session_user(), 'diagnostics.manage'));