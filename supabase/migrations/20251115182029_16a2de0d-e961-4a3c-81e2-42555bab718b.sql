-- Удаляем старые триггеры, которые пытаются работать с удаленными полями
DROP TRIGGER IF EXISTS trigger_auto_populate_diagnostic_stage ON diagnostic_stages;
DROP FUNCTION IF EXISTS auto_populate_diagnostic_stage_from_parent();

DROP TRIGGER IF EXISTS trigger_auto_populate_meeting_stage ON meeting_stages;
DROP FUNCTION IF EXISTS auto_populate_meeting_stage_from_parent();

-- Создаем новый триггер для diagnostic_stages, который только вычисляет статус
CREATE OR REPLACE FUNCTION set_diagnostic_stage_status()
RETURNS TRIGGER AS $$
DECLARE
  parent_record RECORD;
BEGIN
  -- Получаем данные из parent_stages для вычисления статуса
  SELECT start_date, end_date INTO parent_record
  FROM parent_stages
  WHERE id = NEW.parent_id;
  
  IF parent_record IS NOT NULL THEN
    -- Вычисляем статус на основе дат родительского этапа
    NEW.status := get_stage_status_by_dates(parent_record.start_date::date, parent_record.end_date::date);
  ELSE
    -- Если родителя нет, ставим статус 'upcoming'
    NEW.status := COALESCE(NEW.status, 'upcoming');
  END IF;
  
  -- Устанавливаем is_active, если не задан
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_set_diagnostic_stage_status
  BEFORE INSERT ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION set_diagnostic_stage_status();