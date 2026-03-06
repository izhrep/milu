-- Добавляем enum для типов этапов
CREATE TYPE stage_type AS ENUM ('parent', 'diagnostic', 'meetings');

-- Добавляем поля в diagnostic_stages для поддержки иерархии
ALTER TABLE diagnostic_stages 
  ADD COLUMN stage_type stage_type DEFAULT 'parent',
  ADD COLUMN parent_stage_id uuid REFERENCES diagnostic_stages(id) ON DELETE CASCADE;

-- Добавляем связь meeting_stages с родительским diagnostic_stage
ALTER TABLE meeting_stages 
  ADD COLUMN parent_diagnostic_stage_id uuid REFERENCES diagnostic_stages(id) ON DELETE CASCADE;

-- Создаём функцию для вычисления статуса этапа на основе дат
CREATE OR REPLACE FUNCTION get_stage_status_by_dates(start_date date, end_date date)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF CURRENT_DATE < start_date THEN
    RETURN 'upcoming';
  ELSIF CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date THEN
    RETURN 'active';
  ELSE
    RETURN 'completed';
  END IF;
END;
$$;

-- Создаём view для этапов с вычисляемым статусом
CREATE OR REPLACE VIEW stages_with_status AS
SELECT 
  ds.*,
  get_stage_status_by_dates(ds.start_date, ds.end_date) as computed_status,
  (SELECT COUNT(*) FROM diagnostic_stage_participants WHERE stage_id = ds.id) as participants_count,
  (SELECT json_agg(json_build_object(
    'id', sub.id,
    'stage_type', sub.stage_type,
    'start_date', sub.start_date,
    'end_date', sub.end_date,
    'deadline_date', sub.deadline_date,
    'status', get_stage_status_by_dates(sub.start_date, sub.end_date)
  )) FROM diagnostic_stages sub WHERE sub.parent_stage_id = ds.id) as substages,
  (SELECT json_agg(json_build_object(
    'id', ms.id,
    'period', ms.period,
    'start_date', ms.start_date,
    'end_date', ms.end_date,
    'deadline_date', ms.deadline_date,
    'status', get_stage_status_by_dates(ms.start_date, ms.end_date)
  )) FROM meeting_stages ms WHERE ms.parent_diagnostic_stage_id = ds.id) as meeting_substages
FROM diagnostic_stages ds
WHERE ds.parent_stage_id IS NULL;

-- Обновляем RLS для view
ALTER VIEW stages_with_status OWNER TO postgres;
GRANT SELECT ON stages_with_status TO authenticated;

-- Функция для автоматического наследования участников от родительского этапа
CREATE OR REPLACE FUNCTION inherit_participants_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Если это подэтап (diagnostic), копируем участников от родителя
  IF NEW.parent_stage_id IS NOT NULL THEN
    INSERT INTO diagnostic_stage_participants (stage_id, user_id)
    SELECT NEW.id, user_id 
    FROM diagnostic_stage_participants 
    WHERE stage_id = NEW.parent_stage_id
    ON CONFLICT (stage_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер для автоматического наследования участников
CREATE TRIGGER trigger_inherit_participants
AFTER INSERT ON diagnostic_stages
FOR EACH ROW
WHEN (NEW.parent_stage_id IS NOT NULL AND NEW.stage_type = 'diagnostic')
EXECUTE FUNCTION inherit_participants_from_parent();

-- Функция для синхронизации участников meeting_stages с родительским этапом
CREATE OR REPLACE FUNCTION sync_meeting_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Если у meeting_stage есть родительский diagnostic_stage, синхронизируем участников
  IF NEW.parent_diagnostic_stage_id IS NOT NULL THEN
    -- Копируем участников из diagnostic_stage_participants в meeting_stage_participants
    INSERT INTO meeting_stage_participants (stage_id, user_id)
    SELECT NEW.id, user_id 
    FROM diagnostic_stage_participants 
    WHERE stage_id = NEW.parent_diagnostic_stage_id
    ON CONFLICT (stage_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер для синхронизации участников встреч
CREATE TRIGGER trigger_sync_meeting_participants
AFTER INSERT ON meeting_stages
FOR EACH ROW
WHEN (NEW.parent_diagnostic_stage_id IS NOT NULL)
EXECUTE FUNCTION sync_meeting_participants();

-- Создаём индексы для производительности
CREATE INDEX idx_diagnostic_stages_parent ON diagnostic_stages(parent_stage_id);
CREATE INDEX idx_diagnostic_stages_type ON diagnostic_stages(stage_type);
CREATE INDEX idx_meeting_stages_parent ON meeting_stages(parent_diagnostic_stage_id);

-- Добавляем комментарии для документации
COMMENT ON COLUMN diagnostic_stages.stage_type IS 'Тип этапа: parent (родительский), diagnostic (подэтап диагностики), meetings (подэтап встреч - deprecated, используйте meeting_stages)';
COMMENT ON COLUMN diagnostic_stages.parent_stage_id IS 'ID родительского этапа для создания иерархии';
COMMENT ON COLUMN meeting_stages.parent_diagnostic_stage_id IS 'ID родительского diagnostic_stage для подэтапа встреч';
COMMENT ON FUNCTION get_stage_status_by_dates IS 'Вычисляет статус этапа: upcoming (предстоящий), active (активный), completed (завершённый)';
COMMENT ON VIEW stages_with_status IS 'View с вычисляемым статусом и подэтапами для родительских этапов';