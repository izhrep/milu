CREATE OR REPLACE FUNCTION public.create_meeting_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_period TEXT;
  stage_deadline DATE;
  manager_user_id UUID;
  existing_task_count INT;
BEGIN
  -- Получаем информацию об этапе через parent_stages
  SELECT ps.period, ps.end_date
  INTO stage_period, stage_deadline
  FROM meeting_stages ms
  LEFT JOIN parent_stages ps ON ps.id = ms.parent_id
  WHERE ms.id = NEW.stage_id;
  
  IF stage_period IS NULL THEN
    RAISE NOTICE 'Meeting stage % not found or has no parent', NEW.stage_id;
    RETURN NEW;
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Проверяем, есть ли уже задача для этого участника и этапа
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE user_id = NEW.user_id
    AND task_type = 'meeting'
    AND category = 'Встречи 1:1'
    AND title LIKE '%' || stage_period || '%';
  
  -- Создаём задачу только если её ещё нет
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      'Встреча 1:1 - ' || stage_period,
      'Необходимо провести встречу 1:1 с руководителем и заполнить форму',
      'pending',
      stage_deadline,
      'meeting',
      'Встречи 1:1'
    );
    
    RAISE NOTICE 'Создана задача встречи для пользователя % в этапе %', NEW.user_id, NEW.stage_id;
  ELSE
    RAISE NOTICE 'Задача встречи для пользователя % в этапе % уже существует', NEW.user_id, NEW.stage_id;
  END IF;
  
  RETURN NEW;
END;
$$;