-- Добавляем уникальные ограничения для корректной работы ON CONFLICT

-- 1. diagnostic_stage_participants: уникальность по user_id и stage_id
ALTER TABLE diagnostic_stage_participants
ADD CONSTRAINT diagnostic_stage_participants_user_stage_unique 
UNIQUE (user_id, stage_id);

-- 2. meeting_stage_participants: уникальность по user_id и stage_id
ALTER TABLE meeting_stage_participants
ADD CONSTRAINT meeting_stage_participants_user_stage_unique 
UNIQUE (user_id, stage_id);

-- 3. skill_survey_assignments: уникальность по evaluated_user_id и evaluating_user_id
ALTER TABLE skill_survey_assignments
ADD CONSTRAINT skill_survey_assignments_evaluated_evaluating_unique 
UNIQUE (evaluated_user_id, evaluating_user_id);

-- 4. survey_360_assignments: уникальность по evaluated_user_id и evaluating_user_id
ALTER TABLE survey_360_assignments
ADD CONSTRAINT survey_360_assignments_evaluated_evaluating_unique 
UNIQUE (evaluated_user_id, evaluating_user_id);

-- 5. user_skills: уникальность по user_id и skill_id (если таблица существует)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_skills') THEN
    ALTER TABLE user_skills
    ADD CONSTRAINT user_skills_user_skill_unique 
    UNIQUE (user_id, skill_id);
  END IF;
END $$;

-- 6. user_qualities: уникальность по user_id и quality_id (если таблица существует)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_qualities') THEN
    ALTER TABLE user_qualities
    ADD CONSTRAINT user_qualities_user_quality_unique 
    UNIQUE (user_id, quality_id);
  END IF;
END $$;