-- Изменяем функцию создания задачи для участника диагностики
-- Теперь создаётся только одна задача типа "diagnostic_stage"
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем только одну задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    stage_record.period,
    'Необходимо пройти комплексную оценку компетенций (профессиональные навыки и личные качества). Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'diagnostic_stage',
    'Диагностика'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;