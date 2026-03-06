-- Remove salary_range column from grades table
ALTER TABLE public.grades DROP COLUMN IF EXISTS salary_range;