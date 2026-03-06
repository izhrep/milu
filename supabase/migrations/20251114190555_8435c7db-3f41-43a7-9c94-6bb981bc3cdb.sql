-- Исправляем RLS политики для diagnostic_stage_participants
-- Используем правильное разрешение diagnostics.manage_participants

-- Удаляем старые политики
DROP POLICY IF EXISTS "diagnostic_stage_participants_insert_auth_policy" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_update_auth_policy" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_delete_auth_policy" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "diagnostic_stage_participants_select_auth_policy" ON diagnostic_stage_participants;

-- Создаём политику INSERT с правильным разрешением
CREATE POLICY "Users with manage_participants can add participants"
  ON diagnostic_stage_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.manage_participants'
    )
  );

-- Создаём политику UPDATE с правильным разрешением
CREATE POLICY "Users with manage_participants can update participants"
  ON diagnostic_stage_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.manage_participants'
    )
  );

-- Создаём политику DELETE с правильным разрешением
CREATE POLICY "Users with manage_participants can delete participants"
  ON diagnostic_stage_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.manage_participants'
    )
  );

-- Создаём политику SELECT для просмотра участников
CREATE POLICY "Users can view diagnostic participants"
  ON diagnostic_stage_participants
  FOR SELECT
  USING (
    -- Сам участник
    user_id = auth.uid()
    OR
    -- Пользователи с правами на управление участниками
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage_participants', 'diagnostics.view')
    )
  );