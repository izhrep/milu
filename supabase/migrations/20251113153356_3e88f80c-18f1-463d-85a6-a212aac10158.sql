-- ============================================================================
-- МИГРАЦИЯ: Удаление неиспользуемых таблиц
-- Дата: 2025-11-13
-- Описание: Удаление таблиц survey_assignments и user_achievements
-- ============================================================================

-- 1. Удаляем таблицу survey_assignments (0 записей, не используется в коде)
DROP TABLE IF EXISTS public.survey_assignments CASCADE;

-- 2. Удаляем таблицу user_achievements (0 записей, функционал не реализован)
DROP TABLE IF EXISTS public.user_achievements CASCADE;

-- Комментарий для истории
COMMENT ON SCHEMA public IS 'Удалены неиспользуемые таблицы: survey_assignments, user_achievements';
