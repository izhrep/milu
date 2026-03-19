-- ============================================================
-- PROD AUDIT: Check answer_categories duplicates
-- ============================================================
-- Run this BEFORE applying constraints migration in production.
-- READ-ONLY — does not modify any data.
-- ============================================================

-- 1. Find duplicate pairs by (name, question_type)
SELECT name, question_type, COUNT(*) as cnt,
  array_agg(id ORDER BY created_at) as ids
FROM answer_categories
GROUP BY name, question_type
HAVING COUNT(*) > 1
ORDER BY question_type, name;

-- 2. For each duplicate, show answer_options and question counts
WITH dups AS (
  SELECT name, question_type,
    (array_agg(id ORDER BY created_at))[1] as keep_id,
    (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
SELECT 
  d.name,
  d.question_type,
  d.keep_id,
  d.delete_id,
  (SELECT COUNT(*) FROM hard_skill_answer_options WHERE answer_category_id = d.keep_id) as keep_hard_opts,
  (SELECT COUNT(*) FROM hard_skill_answer_options WHERE answer_category_id = d.delete_id) as del_hard_opts,
  (SELECT COUNT(*) FROM soft_skill_answer_options WHERE answer_category_id = d.keep_id) as keep_soft_opts,
  (SELECT COUNT(*) FROM soft_skill_answer_options WHERE answer_category_id = d.delete_id) as del_soft_opts,
  (SELECT COUNT(*) FROM hard_skill_questions WHERE answer_category_id = d.keep_id) as keep_hard_q,
  (SELECT COUNT(*) FROM hard_skill_questions WHERE answer_category_id = d.delete_id) as del_hard_q,
  (SELECT COUNT(*) FROM soft_skill_questions WHERE answer_category_id = d.keep_id) as keep_soft_q,
  (SELECT COUNT(*) FROM soft_skill_questions WHERE answer_category_id = d.delete_id) as del_soft_q
FROM dups d
ORDER BY d.question_type, d.name;

-- 3. Check for NULL question_type (must be zero before adding NOT NULL)
SELECT COUNT(*) as null_question_type 
FROM answer_categories 
WHERE question_type IS NULL;

-- 4. Check for existing answer_option duplicates per (category, level)
SELECT 'hard' as type, answer_category_id, level_value, COUNT(*) 
FROM hard_skill_answer_options
GROUP BY answer_category_id, level_value
HAVING COUNT(*) > 1
UNION ALL
SELECT 'soft', answer_category_id, level_value, COUNT(*)
FROM soft_skill_answer_options
GROUP BY answer_category_id, level_value
HAVING COUNT(*) > 1;
