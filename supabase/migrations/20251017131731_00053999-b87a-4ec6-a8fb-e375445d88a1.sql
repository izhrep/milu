-- Создание таблицы этапов встреч 1:1
CREATE TABLE public.meeting_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period TEXT NOT NULL, -- H1_2025, H2_2025
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создание таблицы участников этапа
CREATE TABLE public.meeting_stage_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.meeting_stages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage_id, user_id)
);

-- Создание таблицы встреч 1:1
CREATE TABLE public.one_on_one_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.meeting_stages(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, returned, approved
  meeting_date TIMESTAMP WITH TIME ZONE,
  
  -- Поля формы сотрудника
  goal_and_agenda TEXT,
  energy_gained TEXT,
  energy_lost TEXT,
  previous_decisions_debrief TEXT,
  stoppers TEXT,
  
  -- Поле руководителя
  manager_comment TEXT,
  
  -- Метаданные
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  return_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создание таблицы решений после встречи
CREATE TABLE public.meeting_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  decision_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Индексы для производительности
CREATE INDEX idx_meeting_stages_period ON public.meeting_stages(period);
CREATE INDEX idx_meeting_stages_active ON public.meeting_stages(is_active);
CREATE INDEX idx_one_on_one_meetings_employee ON public.one_on_one_meetings(employee_id);
CREATE INDEX idx_one_on_one_meetings_manager ON public.one_on_one_meetings(manager_id);
CREATE INDEX idx_one_on_one_meetings_stage ON public.one_on_one_meetings(stage_id);
CREATE INDEX idx_one_on_one_meetings_status ON public.one_on_one_meetings(status);
CREATE INDEX idx_meeting_decisions_meeting ON public.meeting_decisions(meeting_id);

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_meeting_stages_updated_at
  BEFORE UPDATE ON public.meeting_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_one_on_one_meetings_updated_at
  BEFORE UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_decisions_updated_at
  BEFORE UPDATE ON public.meeting_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS политики для meeting_stages
ALTER TABLE public.meeting_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meeting stages"
  ON public.meeting_stages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active meeting stages"
  ON public.meeting_stages
  FOR SELECT
  USING (is_active = true);

-- RLS политики для meeting_stage_participants
ALTER TABLE public.meeting_stage_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stage participants"
  ON public.meeting_stage_participants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their participation"
  ON public.meeting_stage_participants
  FOR SELECT
  USING (user_id::text = auth.uid()::text);

-- RLS политики для one_on_one_meetings
ALTER TABLE public.one_on_one_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view their own meetings"
  ON public.one_on_one_meetings
  FOR SELECT
  USING (employee_id::text = auth.uid()::text);

CREATE POLICY "Managers can view their subordinates' meetings"
  ON public.one_on_one_meetings
  FOR SELECT
  USING (manager_id::text = auth.uid()::text);

CREATE POLICY "Admins can view all meetings"
  ON public.one_on_one_meetings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can create their own meetings"
  ON public.one_on_one_meetings
  FOR INSERT
  WITH CHECK (employee_id::text = auth.uid()::text);

CREATE POLICY "Employees can update their draft or returned meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    employee_id::text = auth.uid()::text 
    AND status IN ('draft', 'returned')
  );

CREATE POLICY "Managers can update submitted meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    manager_id::text = auth.uid()::text 
    AND status = 'submitted'
  );

CREATE POLICY "Admins can update all meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- RLS политики для meeting_decisions
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions for their meetings"
  ON public.meeting_decisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id::text = auth.uid()::text OR m.manager_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Users can create decisions for their meetings"
  ON public.meeting_decisions
  FOR INSERT
  WITH CHECK (
    created_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id::text = auth.uid()::text OR m.manager_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Users can update their own decisions"
  ON public.meeting_decisions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id::text = auth.uid()::text OR m.manager_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Admins can manage all decisions"
  ON public.meeting_decisions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Функция для создания задачи при запуске этапа встреч
CREATE OR REPLACE FUNCTION public.create_meeting_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.meeting_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
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
    'Встреча 1:1 - ' || stage_record.period,
    'Необходимо провести встречу 1:1 и заполнить форму. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'meeting',
    'Встречи 1:1'
  );
  
  RETURN NEW;
END;
$$;

-- Триггер для автоматического создания задач
CREATE TRIGGER create_task_on_participant_add
  AFTER INSERT ON public.meeting_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_meeting_task_for_participant();

-- Функция для обновления задачи при изменении статуса встречи
CREATE OR REPLACE FUNCTION public.update_meeting_task_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем статус задачи при утверждении встречи
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = NEW.employee_id
      AND task_type = 'meeting'
      AND category = 'Встречи 1:1'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер для автоматического обновления статуса задач
CREATE TRIGGER update_task_on_meeting_approval
  AFTER UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.update_meeting_task_status();