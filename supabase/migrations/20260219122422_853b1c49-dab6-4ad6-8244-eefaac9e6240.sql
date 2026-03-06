
-- Drop old unique constraint that blocks stage-less meeting creation
-- The new idx_one_open_meeting_per_pair partial unique index handles the business rule
DROP INDEX IF EXISTS idx_one_meeting_per_employee_stage;
