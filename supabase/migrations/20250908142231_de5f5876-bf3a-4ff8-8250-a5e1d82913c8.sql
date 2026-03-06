-- Включаем RLS для таблиц опроса 360 и добавляем политики доступа

-- Включаем RLS для survey_360_questions
ALTER TABLE public.survey_360_questions ENABLE ROW LEVEL SECURITY;

-- Включаем RLS для survey_360_answer_options  
ALTER TABLE public.survey_360_answer_options ENABLE ROW LEVEL SECURITY;

-- Включаем RLS для survey_360_results
ALTER TABLE public.survey_360_results ENABLE ROW LEVEL SECURITY;

-- Политики для survey_360_questions (все могут читать вопросы)
CREATE POLICY "Everyone can view survey questions" 
ON public.survey_360_questions 
FOR SELECT 
USING (true);

-- Политики для survey_360_answer_options (все могут читать варианты ответов)
CREATE POLICY "Everyone can view answer options" 
ON public.survey_360_answer_options 
FOR SELECT 
USING (true);

-- Политики для survey_360_results
CREATE POLICY "Users can insert their own survey results" 
ON public.survey_360_results 
FOR INSERT 
WITH CHECK (auth.uid()::text = evaluating_user_id::text);

CREATE POLICY "Users can view results where they are evaluated" 
ON public.survey_360_results 
FOR SELECT 
USING (auth.uid()::text = evaluated_user_id::text OR auth.uid()::text = evaluating_user_id::text);

CREATE POLICY "Admins can manage all survey results" 
ON public.survey_360_results 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));