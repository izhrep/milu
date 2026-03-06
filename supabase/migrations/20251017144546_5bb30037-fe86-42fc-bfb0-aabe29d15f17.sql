-- ВРЕМЕННОЕ РЕШЕНИЕ для разработки без полноценной Auth
-- Отключаем RLS на meeting_stage_participants для разработки
-- ВАЖНО: Это НЕ безопасно для production!

-- Удаляем все существующие политики
DROP POLICY IF EXISTS "Admins can manage stage participants" ON public.meeting_stage_participants;
DROP POLICY IF EXISTS "Users can view their participation" ON public.meeting_stage_participants;

-- Отключаем RLS для разработки
ALTER TABLE public.meeting_stage_participants DISABLE ROW LEVEL SECURITY;

-- TODO: Включить RLS обратно после внедрения настоящей Supabase Auth:
-- ALTER TABLE public.meeting_stage_participants ENABLE ROW LEVEL SECURITY;