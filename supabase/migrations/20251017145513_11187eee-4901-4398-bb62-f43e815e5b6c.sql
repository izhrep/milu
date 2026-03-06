-- Исправляем CHECK constraint для поддержки task_type = 'meeting'
-- Удаляем старый constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;

-- Создаем новый constraint с добавлением типа 'meeting'
ALTER TABLE public.tasks ADD CONSTRAINT check_task_type 
CHECK (task_type IN ('assessment', 'development', 'kpi', 'survey_360', 'skill_survey', 'meeting'));