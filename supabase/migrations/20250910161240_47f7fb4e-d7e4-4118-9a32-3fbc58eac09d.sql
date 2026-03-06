-- Добавляем RLS политику для skill_survey_results чтобы разрешить вставку результатов
CREATE POLICY "Allow inserting skill survey results" 
ON skill_survey_results 
FOR INSERT 
WITH CHECK (true);

-- Разрешаем чтение результатов пользователям
CREATE POLICY "Allow reading skill survey results" 
ON skill_survey_results 
FOR SELECT 
USING (true);