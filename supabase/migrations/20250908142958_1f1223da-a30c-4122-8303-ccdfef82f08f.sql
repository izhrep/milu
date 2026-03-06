-- Добавляем политику DELETE для тестирования удаления существующих результатов
CREATE POLICY "Allow all survey result deletes for testing" 
ON public.survey_360_results 
FOR DELETE 
USING (true);