-- Временно отключаем требование аутентификации для тестирования опроса 360
-- Заменяем политики на более простые без auth.uid()

-- Удаляем существующие политики для survey_360_results
DROP POLICY IF EXISTS "Users can insert their own survey results" ON public.survey_360_results;
DROP POLICY IF EXISTS "Users can view results where they are evaluated" ON public.survey_360_results;
DROP POLICY IF EXISTS "Admins can manage all survey results" ON public.survey_360_results;

-- Создаем простые политики для тестирования
CREATE POLICY "Allow all survey result inserts for testing" 
ON public.survey_360_results 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all survey result reads for testing" 
ON public.survey_360_results 
FOR SELECT 
USING (true);

-- Также убедимся, что пользователи могут читать таблицу users
CREATE POLICY "Allow all users to be read for surveys" 
ON public.users 
FOR SELECT 
USING (true);