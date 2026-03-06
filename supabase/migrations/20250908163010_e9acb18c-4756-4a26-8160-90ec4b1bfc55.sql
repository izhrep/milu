-- Создаем enum для типов выбора участников опроса 360
CREATE TYPE public.survey_selection_type AS ENUM ('colleague', 'supervisor', 'department');

-- Создаем таблицу для хранения выборки участников опроса 360
CREATE TABLE public.survey_360_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  selector_user_id UUID NOT NULL,
  selected_user_id UUID NOT NULL,
  selection_type survey_selection_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ограничение: один пользователь не может выбрать одного и того же человека дважды для одного типа
  UNIQUE(selector_user_id, selected_user_id, selection_type)
);

-- Включаем RLS
ALTER TABLE public.survey_360_selections ENABLE ROW LEVEL SECURITY;

-- Политики RLS
CREATE POLICY "Users can manage their own selections" 
ON public.survey_360_selections 
FOR ALL 
USING (auth.uid()::text = selector_user_id::text)
WITH CHECK (auth.uid()::text = selector_user_id::text);

CREATE POLICY "Admins can manage all selections" 
ON public.survey_360_selections 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Создаем функцию для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_survey_360_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER update_survey_360_selections_updated_at
  BEFORE UPDATE ON public.survey_360_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_survey_360_selections_updated_at();

-- Создаем индексы для производительности
CREATE INDEX idx_survey_360_selections_selector ON public.survey_360_selections(selector_user_id);
CREATE INDEX idx_survey_360_selections_selected ON public.survey_360_selections(selected_user_id);
CREATE INDEX idx_survey_360_selections_active ON public.survey_360_selections(is_active);