-- Исправляем триггер auto_assign_manager_for_360
-- Теперь явно устанавливаем assignment_type='manager'

CREATE OR REPLACE FUNCTION public.auto_assign_manager_for_360()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Get the manager of the evaluated user
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.evaluated_user_id;
  
  -- If manager exists and this is the first assignment (self-assessment)
  IF manager_user_id IS NOT NULL AND NEW.evaluating_user_id = NEW.evaluated_user_id THEN
    -- Create manager assignment with explicit assignment_type='manager'
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_by,
      approved_at
    ) VALUES (
      NEW.evaluated_user_id,
      manager_user_id,
      NEW.diagnostic_stage_id,  -- ✅ Передаём diagnostic_stage_id из самооценки
      'manager',                 -- ✅ ИСПРАВЛЕНО: явно устанавливаем assignment_type
      'approved',
      true,
      manager_user_id,           -- ✅ Утверждает руководитель
      now()
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type;
  END IF;
  
  RETURN NEW;
END;
$$;