-- Backfill null raw_numeric_value from answer_option_id for soft_skill_results
UPDATE soft_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM soft_skill_answer_options WHERE id = soft_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;

-- Backfill null raw_numeric_value from answer_option_id for hard_skill_results
UPDATE hard_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM hard_skill_answer_options WHERE id = hard_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;