-- Исправляем функцию create_meeting_task_for_participant
-- Проблема: priority 'high' не проходит валидацию check constraint

DROP FUNCTION IF EXISTS create_meeting_task_for_participant() CASCADE;

CREATE OR REPLACE FUNCTION create_meeting_task_for_participant()
RETURNS TRIGGER AS $$
DECLARE
  stage_period TEXT;
  stage_deadline DATE;
  manager_user_id UUID;
  existing_task_count INT;
BEGIN
  -- Получаем информацию об этапе через parent_stages
  SELECT ps.period, ps.deadline_date
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
  
  -- Создаём задачу только если её ещё нет (без поля priority)
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
      'Необходимо провести встречу 1:1 с руководителем и заполнить форму. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Пересоздаём триггер
DROP TRIGGER IF EXISTS trigger_create_meeting_task_for_participant ON meeting_stage_participants;

CREATE TRIGGER trigger_create_meeting_task_for_participant
  AFTER INSERT ON meeting_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_meeting_task_for_participant();