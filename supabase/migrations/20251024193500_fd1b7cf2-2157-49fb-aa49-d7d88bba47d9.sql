-- Исправляем RLS политики для meeting_stages для работы с кастомной авторизацией
-- Без auth.uid() эти политики блокируют доступ

-- Удаляем старые политики
DROP POLICY IF EXISTS "Admins can manage meeting stages" ON meeting_stages;
DROP POLICY IF EXISTS "Users can view meeting stages" ON meeting_stages;

-- Создаем публичные политики для админ-панели
-- Все операции доступны всем (контроль через клиентскую логику)
CREATE POLICY "Allow all read access to meeting_stages"
ON meeting_stages FOR SELECT
USING (true);

CREATE POLICY "Allow all write access to meeting_stages"
ON meeting_stages FOR ALL
USING (true)
WITH CHECK (true);