-- Update soft_skill_answer_options level_value constraint from 0-4 to 0-5
ALTER TABLE soft_skill_answer_options 
  DROP CONSTRAINT soft_skill_answer_options_level_value_check;

ALTER TABLE soft_skill_answer_options 
  ADD CONSTRAINT soft_skill_answer_options_level_value_check 
  CHECK ((level_value >= 0) AND (level_value <= 5));