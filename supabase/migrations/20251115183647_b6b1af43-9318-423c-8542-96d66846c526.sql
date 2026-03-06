-- Исправляем функцию create_meeting_task_for_participant
-- Проблема: пытаемся получить period напрямую из meeting_stages, а он находится в parent_stages

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
  
  -- Создаём задачу только если её ещё нет
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category,
      priority
    ) VALUES (
      NEW.user_id,
      'Встреча 1:1 - ' || stage_period,
      'Необходимо провести встречу 1:1 с руководителем и заполнить форму. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'meeting',
      'Встречи 1:1',
      'high'
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


-- Также исправляем функцию update_meeting_task_status
DROP FUNCTION IF EXISTS update_meeting_task_status() CASCADE;

CREATE OR REPLACE FUNCTION update_meeting_task_status()
RETURNS TRIGGER AS $$
DECLARE
  stage_period TEXT;
BEGIN
  -- Получаем период этапа через parent_stages
  SELECT ps.period INTO stage_period
  FROM meeting_stages ms
  LEFT JOIN parent_stages ps ON ps.id = ms.parent_id
  WHERE ms.id = NEW.stage_id;
  
  -- При утверждении встречи обновляем задачу на completed
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = NEW.employee_id
      AND task_type = 'meeting'
      AND category = 'Встречи 1:1'
      AND title LIKE '%' || COALESCE(stage_period, '') || '%'
      AND status != 'completed';
      
    RAISE NOTICE 'Задача встречи для сотрудника % помечена как completed', NEW.employee_id;
  END IF;
  
  -- При возврате встречи на доработку задача остаётся pending
  IF NEW.status = 'returned' AND (OLD IS NULL OR OLD.status != 'returned') THEN
    UPDATE tasks
    SET status = 'pending',
        updated_at = now()
    WHERE user_id = NEW.employee_id
      AND task_type = 'meeting'
      AND category = 'Встречи 1:1'
      AND title LIKE '%' || COALESCE(stage_period, '') || '%'
      AND status = 'completed';
      
    RAISE NOTICE 'Задача встречи для сотрудника % возвращена в pending после возврата', NEW.employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Пересоздаём триггер
DROP TRIGGER IF EXISTS trigger_update_meeting_task_status ON one_on_one_meetings;

CREATE TRIGGER trigger_update_meeting_task_status
  AFTER INSERT OR UPDATE ON one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_task_status();


-- Исправляем функцию create_meeting_for_participant
DROP FUNCTION IF EXISTS create_meeting_for_participant() CASCADE;

CREATE OR REPLACE FUNCTION create_meeting_for_participant()
RETURNS TRIGGER AS $$
DECLARE
  manager_user_id UUID;
  existing_meeting_count INT;
BEGIN
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Если у участника нет руководителя, не создаём встречу
  IF manager_user_id IS NULL THEN
    RAISE NOTICE 'У пользователя % нет руководителя, встреча 1:1 не создана', NEW.user_id;
    RETURN NEW;
  END IF;
  
  -- Проверяем, есть ли уже встреча для этого участника и этапа
  SELECT COUNT(*) INTO existing_meeting_count
  FROM one_on_one_meetings
  WHERE employee_id = NEW.user_id
    AND stage_id = NEW.stage_id;
  
  -- Создаём встречу только если её ещё нет
  IF existing_meeting_count = 0 THEN
    INSERT INTO one_on_one_meetings (
      stage_id,
      employee_id,
      manager_id,
      status
    ) VALUES (
      NEW.stage_id,
      NEW.user_id,
      manager_user_id,
      'draft'
    );
    
    RAISE NOTICE 'Создана встреча 1:1 для сотрудника % с руководителем % в этапе %', 
      NEW.user_id, manager_user_id, NEW.stage_id;
  ELSE
    RAISE NOTICE 'Встреча 1:1 для сотрудника % в этапе % уже существует', NEW.user_id, NEW.stage_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Пересоздаём триггер
DROP TRIGGER IF EXISTS trigger_create_meeting_for_participant ON meeting_stage_participants;

CREATE TRIGGER trigger_create_meeting_for_participant
  AFTER INSERT ON meeting_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_meeting_for_participant();