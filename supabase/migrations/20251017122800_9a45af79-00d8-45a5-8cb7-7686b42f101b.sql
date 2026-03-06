-- 1. Users table changes
-- Add new name columns
ALTER TABLE public.users ADD COLUMN last_name TEXT;
ALTER TABLE public.users ADD COLUMN first_name TEXT;
ALTER TABLE public.users ADD COLUMN middle_name TEXT;

-- Rename supervisor_id to manager_id
ALTER TABLE public.users RENAME COLUMN supervisor_id TO manager_id;

-- Drop unused columns
ALTER TABLE public.users DROP COLUMN full_name;
ALTER TABLE public.users DROP COLUMN competency_level;

-- Change status to boolean (fix: drop default first, then change type, then set new default)
ALTER TABLE public.users ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN status TYPE BOOLEAN USING (status = 'Активный');
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT true;

-- 2. Departments table changes
ALTER TABLE public.departments DROP COLUMN parent_id;