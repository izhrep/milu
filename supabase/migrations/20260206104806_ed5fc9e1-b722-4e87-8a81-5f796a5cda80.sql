-- =====================================================
-- ДОПОЛНЕНИЕ: Политика для peer selection
-- Участники диагностики должны видеть коллег для выбора респондентов
-- =====================================================

-- Добавляем политику для peer selection (выбор респондентов 360)
CREATE POLICY "users_select_for_peer_selection" ON users
FOR SELECT TO authenticated
USING (
  -- Участники диагностики могут видеть активных сотрудников
  EXISTS (
    SELECT 1 FROM diagnostic_stage_participants dsp
    WHERE dsp.user_id = auth.uid()
  )
  AND status = true
);