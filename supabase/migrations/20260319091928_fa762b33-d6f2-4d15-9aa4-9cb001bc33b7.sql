
-- 1. Drop legacy trigger and function that creates task_type='meeting' without assignment_id
DROP TRIGGER IF EXISTS trigger_create_meeting_task_for_participant ON meeting_stage_participants;
DROP FUNCTION IF EXISTS public.create_meeting_task_for_participant() CASCADE;
