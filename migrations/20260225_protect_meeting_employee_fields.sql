-- Trigger function: prevent manager/admin/hr from updating employee-only fields
-- Employee-only fields: energy_gained, energy_lost, previous_decisions_debrief, stoppers, ideas_and_suggestions
-- These fields can only be written by the employee (employee_id = auth.uid())

CREATE OR REPLACE FUNCTION protect_meeting_employee_fields()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_employee boolean;
BEGIN
  -- If the current user IS the employee, allow all changes
  is_employee := (current_user_id = NEW.employee_id);
  IF is_employee THEN
    RETURN NEW;
  END IF;

  -- For non-employees (manager/admin/hr): prevent writing employee-only fields
  -- Only block if the value is actually changing
  IF (NEW.energy_gained IS DISTINCT FROM OLD.energy_gained) OR
     (NEW.energy_lost IS DISTINCT FROM OLD.energy_lost) OR
     (NEW.previous_decisions_debrief IS DISTINCT FROM OLD.previous_decisions_debrief) OR
     (NEW.stoppers IS DISTINCT FROM OLD.stoppers) OR
     (NEW.ideas_and_suggestions IS DISTINCT FROM OLD.ideas_and_suggestions) THEN
    -- Revert employee fields to their old values silently
    NEW.energy_gained := OLD.energy_gained;
    NEW.energy_lost := OLD.energy_lost;
    NEW.previous_decisions_debrief := OLD.previous_decisions_debrief;
    NEW.stoppers := OLD.stoppers;
    NEW.ideas_and_suggestions := OLD.ideas_and_suggestions;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_meeting_employee_fields ON one_on_one_meetings;

CREATE TRIGGER trg_protect_meeting_employee_fields
  BEFORE UPDATE ON one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION protect_meeting_employee_fields();
