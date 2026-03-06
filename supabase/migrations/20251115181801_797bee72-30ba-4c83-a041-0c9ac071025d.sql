-- Создаем триггер для автоматического заполнения обязательных полей в diagnostic_stages из parent_stages
CREATE OR REPLACE FUNCTION auto_populate_diagnostic_stage_from_parent()
RETURNS TRIGGER AS $$
DECLARE
  parent_record RECORD;
BEGIN
  -- Получаем данные из parent_stages
  SELECT * INTO parent_record
  FROM parent_stages
  WHERE id = NEW.parent_id;
  
  IF parent_record IS NULL THEN
    RAISE EXCEPTION 'Parent stage not found for parent_id: %', NEW.parent_id;
  END IF;
  
  -- Заполняем недостающие поля из parent_stages
  NEW.is_active := COALESCE(NEW.is_active, parent_record.is_active);
  
  -- Вычисляем статус на основе дат родительского этапа
  NEW.status := get_stage_status_by_dates(parent_record.start_date::date, parent_record.end_date::date);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Создаем триггер BEFORE INSERT на diagnostic_stages
DROP TRIGGER IF EXISTS trigger_auto_populate_diagnostic_stage ON diagnostic_stages;
CREATE TRIGGER trigger_auto_populate_diagnostic_stage
  BEFORE INSERT ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_diagnostic_stage_from_parent();

-- Создаем аналогичный триггер для meeting_stages
CREATE OR REPLACE FUNCTION auto_populate_meeting_stage_from_parent()
RETURNS TRIGGER AS $$
DECLARE
  parent_record RECORD;
BEGIN
  -- Получаем данные из parent_stages
  SELECT * INTO parent_record
  FROM parent_stages
  WHERE id = NEW.parent_id;
  
  IF parent_record IS NULL THEN
    RAISE EXCEPTION 'Parent stage not found for parent_id: %', NEW.parent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Создаем триггер BEFORE INSERT на meeting_stages
DROP TRIGGER IF EXISTS trigger_auto_populate_meeting_stage ON meeting_stages;
CREATE TRIGGER trigger_auto_populate_meeting_stage
  BEFORE INSERT ON meeting_stages
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_meeting_stage_from_parent();