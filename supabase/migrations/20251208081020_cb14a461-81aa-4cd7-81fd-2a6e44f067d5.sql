-- Update existing peer_selection tasks with new title
UPDATE public.tasks 
SET title = 'Выбрать респондентов'
WHERE task_type = 'peer_selection' AND title = 'Выбрать оценивающих';

-- Update the database function to use new title
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deadline_date_value DATE;
BEGIN
  -- Get parent stage deadline
  SELECT ps.deadline_date INTO deadline_date_value
  FROM diagnostic_stages ds
  JOIN parent_stages ps ON ds.parent_id = ps.id
  WHERE ds.id = NEW.stage_id;

  -- Create peer_selection task if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE user_id = NEW.user_id 
      AND diagnostic_stage_id = NEW.stage_id 
      AND task_type = 'peer_selection'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      task_type,
      priority,
      category,
      deadline
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Выбрать респондентов',
      'Выберите коллег для проведения оценки 360',
      'pending',
      'peer_selection',
      'urgent',
      'assessment',
      deadline_date_value
    );
  END IF;

  RETURN NEW;
END;
$$;