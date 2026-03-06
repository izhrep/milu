-- Добавляем уникальные ограничения для таблицы user_assessment_results
-- Это необходимо для корректной работы ON CONFLICT в триггерах агрегации

-- Для записей с skill_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_assessment_skill_period 
ON user_assessment_results (user_id, skill_id, assessment_period) 
WHERE skill_id IS NOT NULL;

-- Для записей с quality_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_assessment_quality_period 
ON user_assessment_results (user_id, quality_id, assessment_period) 
WHERE quality_id IS NOT NULL;