-- SQL script to add added_by_manager column to survey_360_assignments table
-- Execute this in Supabase SQL Editor (Database > SQL Editor)

-- Add added_by_manager column
ALTER TABLE survey_360_assignments 
ADD COLUMN IF NOT EXISTS added_by_manager boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN survey_360_assignments.added_by_manager 
IS 'Indicates if this assignment was added directly by the manager (true) or proposed by the employee (false)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_survey_360_assignments_added_by_manager 
ON survey_360_assignments(added_by_manager);

-- Update existing records to have default value
UPDATE survey_360_assignments 
SET added_by_manager = false 
WHERE added_by_manager IS NULL;
