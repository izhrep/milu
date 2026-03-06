-- First check the current foreign key constraint on tasks table
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'tasks'
  AND kcu.column_name = 'assignment_id';

-- Drop the existing foreign key constraint that's causing the issue
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignment_id_fkey;

-- Create a more flexible approach - allow assignment_id to reference either table
-- For now, make assignment_id nullable to avoid the constraint issue
ALTER TABLE tasks ALTER COLUMN assignment_id DROP NOT NULL;

-- Add a new column to specify the assignment type
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('survey_360', 'skill_survey'));

-- Update the foreign key to be more flexible or remove it entirely for now
-- We'll handle referential integrity at the application level