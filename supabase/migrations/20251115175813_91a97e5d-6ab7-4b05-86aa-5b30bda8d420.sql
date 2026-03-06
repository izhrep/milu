-- Удаляем зависимости перед изменением структуры таблиц

-- 1. Удаляем триггер inherit_participants_from_parent (зависит от parent_stage_id)
DROP TRIGGER IF EXISTS trigger_inherit_participants ON diagnostic_stages;
DROP FUNCTION IF EXISTS inherit_participants_from_parent();

-- 2. Удаляем триггер sync_meeting_participants (зависит от parent_diagnostic_stage_id)
DROP TRIGGER IF EXISTS trigger_sync_meeting_participants ON meeting_stages;
DROP FUNCTION IF EXISTS sync_meeting_participants();

-- 3. Удаляем view stages_with_status (зависит от parent_stage_id)
DROP VIEW IF EXISTS stages_with_status;

-- 4. Создаем отдельную таблицу для родительских этапов
CREATE TABLE IF NOT EXISTS public.parent_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Включаем RLS
ALTER TABLE public.parent_stages ENABLE ROW LEVEL SECURITY;

-- 6. Политики для parent_stages
CREATE POLICY "parent_stages_insert_auth_policy" 
ON parent_stages 
FOR INSERT 
TO authenticated
WITH CHECK (has_permission('diagnostics.create'));

CREATE POLICY "parent_stages_select_auth_policy" 
ON parent_stages 
FOR SELECT 
TO authenticated
USING (has_permission('diagnostics.view'));

CREATE POLICY "parent_stages_update_auth_policy" 
ON parent_stages 
FOR UPDATE 
TO authenticated
USING (has_permission('diagnostics.update'));

CREATE POLICY "parent_stages_delete_auth_policy" 
ON parent_stages 
FOR DELETE 
TO authenticated
USING (has_permission('diagnostics.delete'));

-- 7. Удаляем старые поля и добавляем parent_id
ALTER TABLE public.diagnostic_stages 
DROP COLUMN IF EXISTS parent_stage_id CASCADE,
DROP COLUMN IF EXISTS stage_type CASCADE,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.parent_stages(id) ON DELETE CASCADE;

ALTER TABLE public.meeting_stages 
DROP COLUMN IF EXISTS parent_diagnostic_stage_id CASCADE,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.parent_stages(id) ON DELETE CASCADE;

-- 8. Триггер для обновления updated_at
CREATE TRIGGER update_parent_stages_updated_at
BEFORE UPDATE ON public.parent_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();