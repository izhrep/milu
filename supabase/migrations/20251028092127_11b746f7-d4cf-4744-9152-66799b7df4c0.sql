-- Create diagnostic_stages table for managing assessment periods
CREATE TABLE IF NOT EXISTS public.diagnostic_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diagnostic_stage_participants table
CREATE TABLE IF NOT EXISTS public.diagnostic_stage_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.diagnostic_stages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage_id, user_id)
);

-- Enable RLS on diagnostic_stages
ALTER TABLE public.diagnostic_stages ENABLE ROW LEVEL SECURITY;

-- RLS policies for diagnostic_stages
CREATE POLICY "Allow all read access to diagnostic_stages"
ON public.diagnostic_stages
FOR SELECT
USING (true);

CREATE POLICY "Allow all write access to diagnostic_stages"
ON public.diagnostic_stages
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable RLS on diagnostic_stage_participants
ALTER TABLE public.diagnostic_stage_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for diagnostic_stage_participants
CREATE POLICY "Allow all access to diagnostic_stage_participants"
ON public.diagnostic_stage_participants
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at
CREATE TRIGGER update_diagnostic_stages_updated_at
BEFORE UPDATE ON public.diagnostic_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to create diagnostic task for participant
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
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
    'Диагностика - ' || stage_record.period,
    'Необходимо пройти опросы по навыкам и качествам. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'assessment',
    'Диагностика'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for creating diagnostic tasks
CREATE TRIGGER create_diagnostic_task_trigger
AFTER INSERT ON public.diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_diagnostic_task_for_participant();