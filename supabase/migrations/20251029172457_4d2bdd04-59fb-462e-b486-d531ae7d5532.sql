-- Удаляем триггер update_diagnostic_stage_status с diagnostic_stage_participants если он есть
DROP TRIGGER IF EXISTS update_diagnostic_stage_status_trigger ON diagnostic_stage_participants;

-- Создаем отдельную функцию для обновления статуса при добавлении участника диагностики
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  -- Calculate new progress for this stage
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  -- Determine new status
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  -- Update the stage
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$$;

-- Создаем триггер для diagnostic_stage_participants
CREATE TRIGGER update_diagnostic_stage_on_participant_add_trigger
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION update_diagnostic_stage_on_participant_add();