-- Schema fix: enforce unique answer_categories and non-null question_type
-- PREREQUISITE: Deduplicate answer_categories by (name, question_type) before applying.
-- See DEV_DATAFIX_answer_categories_merge.sql for dedup script.

-- 1. answer_categories: question_type NOT NULL
ALTER TABLE public.answer_categories 
  ALTER COLUMN question_type SET NOT NULL;

-- 2. answer_categories: UNIQUE(name, question_type)
ALTER TABLE public.answer_categories 
  ADD CONSTRAINT answer_categories_name_question_type_unique 
  UNIQUE (name, question_type);
