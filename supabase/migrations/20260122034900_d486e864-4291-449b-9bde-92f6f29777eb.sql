-- Удаляем старый constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_status;

-- Создаём новый constraint с поддержкой 'expired'
ALTER TABLE public.tasks ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));