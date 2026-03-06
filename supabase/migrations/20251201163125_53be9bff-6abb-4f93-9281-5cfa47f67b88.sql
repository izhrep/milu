-- Drop label column from soft_skill_answer_options
ALTER TABLE public.soft_skill_answer_options DROP COLUMN label;

-- Add title column to soft_skill_answer_options
ALTER TABLE public.soft_skill_answer_options ADD COLUMN title TEXT NOT NULL;