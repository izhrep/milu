-- Обновляем триггерную функцию для пересчета прогресса
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$function$;

-- Создаем триггер для обновления прогресса при изменении результатов
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_results_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id_val uuid;
  new_progress numeric;
  new_status text;
BEGIN
  -- Получаем stage_id из NEW или OLD
  IF TG_OP = 'DELETE' THEN
    stage_id_val := OLD.diagnostic_stage_id;
  ELSE
    stage_id_val := NEW.diagnostic_stage_id;
  END IF;
  
  -- Пересчитываем прогресс только если есть stage_id
  IF stage_id_val IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_id_val);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_id_val;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Удаляем старые триггеры если есть
DROP TRIGGER IF EXISTS update_stage_on_hard_skill_result ON hard_skill_results;
DROP TRIGGER IF EXISTS update_stage_on_soft_skill_result ON soft_skill_results;

-- Создаем новые триггеры
CREATE TRIGGER update_stage_on_hard_skill_result
  AFTER INSERT OR UPDATE OR DELETE ON hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_on_results_change();

CREATE TRIGGER update_stage_on_soft_skill_result
  AFTER INSERT OR UPDATE OR DELETE ON soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_on_results_change();

-- Принудительно обновляем прогресс для всех активных этапов
DO $$
DECLARE
  stage_rec RECORD;
  new_progress numeric;
  new_status text;
BEGIN
  FOR stage_rec IN SELECT id FROM diagnostic_stages WHERE is_active = true LOOP
    new_progress := calculate_diagnostic_stage_progress(stage_rec.id);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_rec.id;
  END LOOP;
END $$;