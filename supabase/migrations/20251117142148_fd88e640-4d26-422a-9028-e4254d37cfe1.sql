-- Добавить поле is_anonymous_comment в таблицу hard_skill_results
ALTER TABLE hard_skill_results 
ADD COLUMN IF NOT EXISTS is_anonymous_comment boolean DEFAULT true;

COMMENT ON COLUMN hard_skill_results.is_anonymous_comment IS 'Флаг анонимности комментария (аналогично soft_skill_results)';