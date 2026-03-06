-- Создание таблицы для поднавыков
CREATE TABLE IF NOT EXISTS public.sub_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включаем RLS для sub_skills
ALTER TABLE public.sub_skills ENABLE ROW LEVEL SECURITY;

-- Политики для sub_skills (используем DO для проверки существования)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_skills' AND policyname = 'Everyone can view sub_skills') THEN
    CREATE POLICY "Everyone can view sub_skills"
      ON public.sub_skills
      FOR SELECT
      USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_skills' AND policyname = 'Admins can manage sub_skills') THEN
    CREATE POLICY "Admins can manage sub_skills"
      ON public.sub_skills
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Триггер для автообновления updated_at
DROP TRIGGER IF EXISTS update_sub_skills_updated_at ON public.sub_skills;
CREATE TRIGGER update_sub_skills_updated_at
  BEFORE UPDATE ON public.sub_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Добавление индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_sub_skills_skill_id ON public.sub_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_sub_skills_order ON public.sub_skills(skill_id, order_index);

-- Обновление таблицы survey_360_questions для добавления behavioral_indicators
ALTER TABLE public.survey_360_questions 
  ADD COLUMN IF NOT EXISTS behavioral_indicators TEXT;

-- Обновление таблицы skill_survey_questions для связи с sub_skills
ALTER TABLE public.skill_survey_questions 
  ADD COLUMN IF NOT EXISTS sub_skill_id UUID REFERENCES public.sub_skills(id) ON DELETE SET NULL;

-- Добавление evaluation_period в diagnostic_stages если его нет
ALTER TABLE public.diagnostic_stages 
  ADD COLUMN IF NOT EXISTS evaluation_period TEXT;

-- Создание представления для детализации заданий
CREATE OR REPLACE VIEW public.assignment_details AS
SELECT 
  sa.id,
  sa.evaluated_user_id,
  sa.evaluating_user_id,
  sa.status,
  sa.assigned_date,
  sa.updated_at,
  'survey_360' as assignment_type,
  COALESCE(eu.first_name || ' ' || eu.last_name, eu.email) as evaluated_user_name,
  COALESCE(ev.first_name || ' ' || ev.last_name, ev.email) as evaluating_user_name,
  eu.email as evaluated_email,
  ev.email as evaluating_email,
  ep.name as evaluated_position,
  evp.name as evaluating_position
FROM public.survey_360_assignments sa
LEFT JOIN public.users eu ON sa.evaluated_user_id = eu.id
LEFT JOIN public.users ev ON sa.evaluating_user_id = ev.id
LEFT JOIN public.positions ep ON eu.position_id = ep.id
LEFT JOIN public.positions evp ON ev.position_id = evp.id

UNION ALL

SELECT 
  sa.id,
  sa.evaluated_user_id,
  sa.evaluating_user_id,
  sa.status,
  sa.assigned_date,
  sa.updated_at,
  'skill_survey' as assignment_type,
  COALESCE(eu.first_name || ' ' || eu.last_name, eu.email) as evaluated_user_name,
  COALESCE(ev.first_name || ' ' || ev.last_name, ev.email) as evaluating_user_name,
  eu.email as evaluated_email,
  ev.email as evaluating_email,
  ep.name as evaluated_position,
  evp.name as evaluating_position
FROM public.skill_survey_assignments sa
LEFT JOIN public.users eu ON sa.evaluated_user_id = eu.id
LEFT JOIN public.users ev ON sa.evaluating_user_id = ev.id
LEFT JOIN public.positions ep ON eu.position_id = ep.id
LEFT JOIN public.positions evp ON ev.position_id = evp.id;

-- Политика для просмотра assignment_details
GRANT SELECT ON public.assignment_details TO authenticated;