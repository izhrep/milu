-- Пересоздаем RLS политики для meeting_stages с правильными ролями и через функцию has_role

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Admins can insert meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Admins can update meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Admins can delete meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Users can view meeting stages" ON public.meeting_stages;

-- Создаем политики для роли authenticated (не public)
-- Админы могут создавать этапы
CREATE POLICY "Admins can insert meeting stages"
ON public.meeting_stages
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Админы могут обновлять этапы
CREATE POLICY "Admins can update meeting stages"
ON public.meeting_stages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Админы могут удалять этапы
CREATE POLICY "Admins can delete meeting stages"
ON public.meeting_stages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Все аутентифицированные пользователи могут просматривать активные этапы
-- Админы могут видеть все этапы
CREATE POLICY "Users can view meeting stages"
ON public.meeting_stages
FOR SELECT
TO authenticated
USING (
  is_active = true OR 
  has_role(auth.uid(), 'admin')
);