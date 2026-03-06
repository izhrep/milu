-- Add check constraint for task_type
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;

ALTER TABLE public.tasks
ADD CONSTRAINT check_task_type 
CHECK (task_type IN ('assessment', 'diagnostic_stage', 'meeting', 'development'));