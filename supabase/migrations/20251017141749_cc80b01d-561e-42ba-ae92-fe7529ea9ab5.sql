-- Обновляем RLS политики для таблицы meeting_stages
-- Удаляем старые политики
DROP POLICY IF EXISTS "Admins can manage meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Users can view active meeting stages" ON public.meeting_stages;

-- Создаем новые политики
-- Админы могут управлять этапами
CREATE POLICY "Admins can manage meeting stages"
ON public.meeting_stages
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Все пользователи могут просматривать активные этапы
CREATE POLICY "Users can view active meeting stages"
ON public.meeting_stages
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));