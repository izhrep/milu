-- Добавление полей в таблицу qualities
ALTER TABLE public.qualities 
  ADD COLUMN IF NOT EXISTS behavioral_indicators TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Удаление ненужной колонки is_universal если она есть
ALTER TABLE public.qualities 
  DROP COLUMN IF EXISTS is_universal;