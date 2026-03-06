-- Добавляем колонку diagnostic_stage_id в таблицу tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS diagnostic_stage_id UUID;

-- Добавляем внешний ключ с каскадным удалением
ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_diagnostic_stage
FOREIGN KEY (diagnostic_stage_id) 
REFERENCES public.diagnostic_stages(id) 
ON DELETE CASCADE;

-- Создаем индекс для производительности
CREATE INDEX IF NOT EXISTS idx_tasks_diagnostic_stage_id 
ON public.tasks(diagnostic_stage_id);

-- Проверяем, что в diagnostic_stage_participants есть правильный foreign key
-- (обычно он уже есть, но проверим)
ALTER TABLE public.diagnostic_stage_participants
DROP CONSTRAINT IF EXISTS fk_participant_stage;

ALTER TABLE public.diagnostic_stage_participants
ADD CONSTRAINT fk_participant_stage
FOREIGN KEY (stage_id) 
REFERENCES public.diagnostic_stages(id) 
ON DELETE CASCADE;