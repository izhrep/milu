-- Исправляем RLS политики для diagnostic_stages
-- Используем существующие разрешения diagnostics.create, diagnostics.update, diagnostics.delete

-- Удаляем предыдущие политики
DROP POLICY IF EXISTS "Admin and HR BP can create diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Admin and HR BP can update diagnostic stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Admin can delete diagnostic stages" ON diagnostic_stages;

-- Создаём политику INSERT с правильными разрешениями
CREATE POLICY "Users with diagnostics.create can create stages"
  ON diagnostic_stages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.create'
    )
  );

-- Создаём политику UPDATE с правильными разрешениями
CREATE POLICY "Users with diagnostics.update can update stages"
  ON diagnostic_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.update'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.update'
    )
  );

-- Создаём политику DELETE с правильными разрешениями
CREATE POLICY "Users with diagnostics.delete can delete stages"
  ON diagnostic_stages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.delete'
    )
  );

-- Создаём политику SELECT для просмотра этапов
CREATE POLICY "Users with diagnostics.view can view stages"
  ON diagnostic_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.view', 'diagnostics.create', 'diagnostics.update')
    )
  );