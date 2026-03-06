-- Add new status values and approval fields to survey_360_assignments
-- Update status field to support new workflow: pending_approval, approved, in_progress, completed

-- Add is_manager_participant field to track if manager is participating
ALTER TABLE survey_360_assignments 
ADD COLUMN IF NOT EXISTS is_manager_participant boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_survey_360_assignments_status ON survey_360_assignments(status);
CREATE INDEX IF NOT EXISTS idx_survey_360_assignments_evaluated_user ON survey_360_assignments(evaluated_user_id);

-- Function to auto-assign manager as evaluator when employee starts assessment
CREATE OR REPLACE FUNCTION auto_assign_manager_for_360()
RETURNS TRIGGER AS $$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Get the manager of the evaluated user
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.evaluated_user_id;
  
  -- If manager exists and this is the first assignment (self-assessment)
  IF manager_user_id IS NOT NULL AND NEW.evaluating_user_id = NEW.evaluated_user_id THEN
    -- Create manager assignment
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      is_manager_participant,
      approved_by,
      approved_at
    ) VALUES (
      NEW.evaluated_user_id,
      manager_user_id,
      'approved',
      true,
      NEW.evaluated_user_id,
      now()
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-assigning manager
DROP TRIGGER IF EXISTS trigger_auto_assign_manager_360 ON survey_360_assignments;
CREATE TRIGGER trigger_auto_assign_manager_360
  AFTER INSERT ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_manager_for_360();

-- Function to create tasks when assignments are approved
CREATE OR REPLACE FUNCTION create_task_on_assignment_approval()
RETURNS TRIGGER AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Create task for evaluating user
    INSERT INTO tasks (
      user_id,
      assignment_id,
      title,
      description,
      status,
      task_type,
      category
    ) VALUES (
      NEW.evaluating_user_id,
      NEW.id,
      'Оценка 360',
      'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
      'pending',
      'assessment',
      'Оценка 360'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task creation on approval
DROP TRIGGER IF EXISTS trigger_create_task_on_approval ON survey_360_assignments;
CREATE TRIGGER trigger_create_task_on_approval
  AFTER UPDATE ON survey_360_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION create_task_on_assignment_approval();