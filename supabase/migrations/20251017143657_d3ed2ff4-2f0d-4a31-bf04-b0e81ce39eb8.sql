-- ВРЕМЕННОЕ РЕШЕНИЕ для разработки без полноценной Auth
-- Отключаем RLS на meeting_stages для разработки
-- ВАЖНО: Это НЕ безопасно для production!

-- Удаляем все существующие политики
DROP POLICY IF EXISTS "Admins can insert meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Admins can update meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Admins can delete meeting stages" ON public.meeting_stages;
DROP POLICY IF EXISTS "Users can view meeting stages" ON public.meeting_stages;

-- Отключаем RLS для разработки
ALTER TABLE public.meeting_stages DISABLE ROW LEVEL SECURITY;

-- TODO: Включить RLS обратно после внедрения настоящей Supabase Auth:
-- ALTER TABLE public.meeting_stages ENABLE ROW LEVEL SECURITY;