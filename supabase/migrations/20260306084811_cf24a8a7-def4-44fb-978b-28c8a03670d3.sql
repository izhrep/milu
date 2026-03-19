-- DEV-ONLY DATA FIX: Merge 50 duplicate answer_categories pairs
-- Strategy: keep oldest (complete) record, reassign refs from fragment, delete fragment

-- Step 1: Reassign hard_skill_questions from fragment to keeper
WITH dups AS (
  SELECT name, question_type,
    (array_agg(id ORDER BY created_at))[1] as keep_id,
    (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
UPDATE hard_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;

-- Step 2: Reassign soft_skill_questions from fragment to keeper
WITH dups AS (
  SELECT name, question_type,
    (array_agg(id ORDER BY created_at))[1] as keep_id,
    (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
UPDATE soft_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;

-- Step 3: Delete fragment answer_options (hard)
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM hard_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);

-- Step 4: Delete fragment answer_options (soft)
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM soft_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);

-- Step 5: Delete fragment answer_categories
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM answer_categories
WHERE id IN (SELECT delete_id FROM dups);