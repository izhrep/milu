-- ВРЕМЕННОЕ РЕШЕНИЕ для разработки без полноценной Supabase Auth
-- Отключаем RLS на ВСЕХ таблицах для разработки
-- КРИТИЧНО: Это НЕ безопасно для production!

-- Отключаем RLS для всех существующих таблиц в схеме public
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
        RAISE NOTICE 'Disabled RLS for table: %', r.tablename;
    END LOOP;
END $$;

-- TODO: КРИТИЧЕСКИ ВАЖНО! 
-- Перед выходом в production необходимо:
-- 1. Внедрить настоящую Supabase Auth
-- 2. Включить RLS обратно на всех таблицах
-- 3. Создать правильные RLS политики