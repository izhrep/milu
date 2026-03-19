-- ============================================================
-- DEV-ONLY DATA FIX: Merge duplicate answer_categories
-- ============================================================
-- Context: Legacy Excel import bug created 50 duplicate pairs
-- in answer_categories by (name, question_type).
-- Each pair has one complete record (5-6 answer_options)
-- and one fragment (1-2 answer_options).
--
-- This script:
-- 1. Reassigns questions from fragment to keeper
-- 2. Deletes fragment answer_options
-- 3. Deletes fragment answer_categories
--
-- DO NOT include in production migrations.
-- For prod, use PROD_AUDIT_answer_categories.sql first.
-- ============================================================

-- Step 1: Reassign hard_skill_questions
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

-- Step 2: Reassign soft_skill_questions
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

-- Step 3: Delete fragment hard answer_options
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM hard_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);

-- Step 4: Delete fragment soft answer_options
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
