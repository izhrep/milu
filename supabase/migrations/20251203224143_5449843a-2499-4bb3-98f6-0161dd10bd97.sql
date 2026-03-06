-- Временно отключаем триггер
ALTER TABLE soft_skill_results DISABLE TRIGGER update_user_qualities_trigger;

-- Исправляем черновики soft_skill_results
UPDATE soft_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);

-- Включаем триггер обратно
ALTER TABLE soft_skill_results ENABLE TRIGGER update_user_qualities_trigger;

-- Временно отключаем триггер для hard skills
ALTER TABLE hard_skill_results DISABLE TRIGGER update_user_skills_trigger;

-- Исправляем черновики hard_skill_results
UPDATE hard_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);

-- Включаем триггер обратно
ALTER TABLE hard_skill_results ENABLE TRIGGER update_user_skills_trigger;