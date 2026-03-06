-- Временно делаем политику более открытой для администраторов
DROP POLICY IF EXISTS "Admins can manage meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Users can view active meeting stages" ON public.meeting_stages;

-- Админы могут создавать этапы (временно упрощенная проверка)
CREATE POLICY "Admins can insert meeting stages"
ON public.meeting_stages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Админы могут обновлять и удалять этапы
CREATE POLICY "Admins can update meeting stages"
ON public.meeting_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete meeting stages"
ON public.meeting_stages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Все пользователи могут просматривать активные этапы
CREATE POLICY "Users can view meeting stages"
ON public.meeting_stages
FOR SELECT
USING (
  is_active = true OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);