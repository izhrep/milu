-- Временная политика для тестирования функциональности выборки участников опроса 360
-- Позволяет всем пользователям добавлять, изменять и удалять записи в survey_360_selections

CREATE POLICY "Allow all operations for testing survey selections" 
ON public.survey_360_selections 
FOR ALL 
USING (true) 
WITH CHECK (true);