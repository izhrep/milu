-- Добавляем RLS политику для создания этапов диагностики
-- Разрешаем создание этапов администраторам и HR BP

-- Сначала проверим существующие политики
DO $$ 
BEGIN
  -- Удаляем старые политики, если есть
  DROP POLICY IF EXISTS "Admin and HR BP can create diagnostic stages" ON diagnostic_stages;
  DROP POLICY IF EXISTS "Admins can create diagnostic stages" ON diagnostic_stages;
END $$;

-- Создаём политику INSERT для администраторов и HR BP
CREATE POLICY "Admin and HR BP can create diagnostic stages"
  ON diagnostic_stages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  );

-- Также добавим политику UPDATE для администраторов и HR BP
DROP POLICY IF EXISTS "Admin and HR BP can update diagnostic stages" ON diagnostic_stages;

CREATE POLICY "Admin and HR BP can update diagnostic stages"
  ON diagnostic_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  );

-- Добавим политику DELETE для администраторов
DROP POLICY IF EXISTS "Admin can delete diagnostic stages" ON diagnostic_stages;

CREATE POLICY "Admin can delete diagnostic stages"
  ON diagnostic_stages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  );