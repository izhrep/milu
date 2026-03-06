-- Переименование таблиц для единообразия терминологии hard_skills и soft_skills

-- 1. Переименовываем category_skills → category_hard_skills
ALTER TABLE category_skills RENAME TO category_hard_skills;

-- 2. Переименовываем skills → hard_skills
ALTER TABLE skills RENAME TO hard_skills;

-- 3. Переименовываем qualities → soft_skills
ALTER TABLE qualities RENAME TO soft_skills;

-- 4. Обновляем внешние ключи в hard_skills для новой таблицы категорий
ALTER TABLE hard_skills RENAME CONSTRAINT skills_category_id_fkey TO hard_skills_category_id_fkey;

-- 5. Обновляем внешние ключи в grade_skills
ALTER TABLE grade_skills RENAME CONSTRAINT grade_skills_skill_id_fkey TO grade_skills_hard_skill_id_fkey;

-- 6. Обновляем внешние ключи в grade_qualities
ALTER TABLE grade_qualities RENAME CONSTRAINT grade_qualities_quality_id_fkey TO grade_qualities_soft_skill_id_fkey;

-- 7. Обновляем внешние ключи в hard_skill_questions
ALTER TABLE hard_skill_questions RENAME CONSTRAINT hard_skill_questions_skill_id_fkey TO hard_skill_questions_hard_skill_id_fkey;

-- 8. Обновляем внешние ключи в soft_skill_questions
ALTER TABLE soft_skill_questions RENAME CONSTRAINT soft_skill_questions_quality_id_fkey TO soft_skill_questions_soft_skill_id_fkey;
ALTER TABLE soft_skill_questions RENAME CONSTRAINT fk_survey_360_questions_quality TO fk_survey_360_questions_soft_skill;

-- 9. Обновляем внешние ключи в development_tasks
ALTER TABLE development_tasks RENAME CONSTRAINT development_tasks_skill_id_fkey TO development_tasks_hard_skill_id_fkey;
ALTER TABLE development_tasks RENAME CONSTRAINT development_tasks_quality_id_fkey TO development_tasks_soft_skill_id_fkey;

-- 10. Переименовываем индексы для category_hard_skills
ALTER INDEX IF EXISTS idx_skills_category_id RENAME TO idx_hard_skills_category_id;

-- Комментарии к таблицам
COMMENT ON TABLE category_hard_skills IS 'Категории hard skills (навыков)';
COMMENT ON TABLE hard_skills IS 'Hard skills (профессиональные навыки)';
COMMENT ON TABLE soft_skills IS 'Soft skills (личностные качества)';