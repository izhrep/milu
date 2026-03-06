-- Enhance tasks table to support all task types
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'assessment';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS competency_ref UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_expected_level INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_result_level INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT;

-- Add check constraints for valid values
ALTER TABLE tasks ADD CONSTRAINT check_task_type 
CHECK (task_type IN ('assessment', 'development', 'kpi', 'urgent'));

ALTER TABLE tasks ADD CONSTRAINT check_priority 
CHECK (priority IN ('normal', 'urgent'));

ALTER TABLE tasks ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'in_progress', 'completed'));

ALTER TABLE tasks ADD CONSTRAINT check_kpi_levels 
CHECK (kpi_expected_level BETWEEN 0 AND 4 AND kpi_result_level BETWEEN 0 AND 4);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_type ON tasks(user_id, task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_deadline ON tasks(priority, deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Update existing tasks to have proper type
UPDATE tasks SET task_type = 'assessment' WHERE assignment_id IS NOT NULL;

COMMENT ON COLUMN tasks.task_type IS 'Type of task: assessment, development, kpi, urgent';
COMMENT ON COLUMN tasks.priority IS 'Priority level: normal, urgent';
COMMENT ON COLUMN tasks.deadline IS 'Task completion deadline';
COMMENT ON COLUMN tasks.competency_ref IS 'Reference to skill or quality for development tasks';
COMMENT ON COLUMN tasks.kpi_expected_level IS 'Expected KPI level (0-4)';
COMMENT ON COLUMN tasks.kpi_result_level IS 'Actual KPI result level (0-4)';
COMMENT ON COLUMN tasks.category IS 'Task category for grouping';