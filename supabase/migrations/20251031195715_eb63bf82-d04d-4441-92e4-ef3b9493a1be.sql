-- ===== МИГРАЦИЯ: ИСПРАВЛЕНИЕ ДИАГНОСТИЧЕСКОЙ СИСТЕМЫ =====

-- 1. Добавляем поле type в survey_360_assignments
ALTER TABLE public.survey_360_assignments 
ADD COLUMN IF NOT EXISTS assignment_type text CHECK (assignment_type IN ('self', 'manager', 'peer'));

-- Обновляем существующие записи на основе is_manager_participant и сравнения user_id
UPDATE public.survey_360_assignments
SET assignment_type = CASE
  WHEN evaluated_user_id = evaluating_user_id THEN 'self'
  WHEN is_manager_participant = true THEN 'manager'
  ELSE 'peer'
END
WHERE assignment_type IS NULL;

-- 2. Создаём триггер для валидации diagnostic_stage_id в tasks
CREATE OR REPLACE FUNCTION public.validate_task_diagnostic_stage_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Блокируем создание задач типа diagnostic_stage и survey_360_evaluation без diagnostic_stage_id
  IF NEW.task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey') 
     AND NEW.diagnostic_stage_id IS NULL THEN
    RAISE NOTICE 'diagnostic_stage_id is null — задача типа % не создаётся', NEW.task_type;
    RETURN NULL; -- Блокируем вставку
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_task_diagnostic_stage_id_trigger ON public.tasks;
CREATE TRIGGER validate_task_diagnostic_stage_id_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_diagnostic_stage_id();

-- 3. Улучшаем триггер создания задач для участников диагностики
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаём только одну задачу для участника: комплексная диагностика
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Комплексная диагностика (самооценка + выбор коллег)',
      'Необходимо пройти комплексную оценку компетенций. Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные будут расшифрованы на клиенте)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;
CREATE TRIGGER create_diagnostic_task_for_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

-- 4. Триггер для автоматического создания self и manager assignments
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  eval_period text;
  manager_user_id uuid;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем задание на самооценку 360 со статусом approved и типом self
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    assignment_type,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved',
    NEW.stage_id,
    'self',
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем задание на оценку 360 от руководителя (если есть) со статусом approved и типом manager
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      diagnostic_stage_id,
      assignment_type,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      'approved',
      NEW.stage_id,
      'manager',
      true,
      now(),
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_surveys_to_diagnostic_participant_trigger ON public.diagnostic_stage_participants;
CREATE TRIGGER assign_surveys_to_diagnostic_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_surveys_to_diagnostic_participant();

-- 5. Триггер удаления задач при удалении участника
CREATE OR REPLACE FUNCTION public.delete_diagnostic_tasks_on_participant_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Удаляем задачу участника
  DELETE FROM public.tasks
  WHERE user_id = OLD.user_id
    AND diagnostic_stage_id = OLD.stage_id
    AND task_type = 'diagnostic_stage';
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = OLD.user_id;
  
  IF manager_user_id IS NOT NULL THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
    INTO participant_full_name
    FROM public.users
    WHERE id = OLD.user_id;
    
    -- Удаляем задачу руководителя для этого участника
    DELETE FROM public.tasks
    WHERE user_id = manager_user_id
      AND diagnostic_stage_id = OLD.stage_id
      AND task_type = 'survey_360_evaluation'
      AND title ILIKE '%' || participant_full_name || '%';
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_diagnostic_tasks_on_participant_remove_trigger ON public.diagnostic_stage_participants;
CREATE TRIGGER delete_diagnostic_tasks_on_participant_remove_trigger
  BEFORE DELETE ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_diagnostic_tasks_on_participant_remove();