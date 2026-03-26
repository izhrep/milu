-- DEV-ONLY cleanup: delete all 1:1 meeting data for Юрасова and her manager
-- Scope: employee_id = Юрасова OR manager_id = Тест Руководитель

DO $$
DECLARE
  _meeting_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _meeting_ids
  FROM one_on_one_meetings
  WHERE employee_id = '7c04b872-6de2-418d-b959-616894d398d7'
     OR manager_id = '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef';

  IF _meeting_ids IS NULL THEN
    RAISE NOTICE 'No meetings found, nothing to delete';
    RETURN;
  END IF;

  DELETE FROM meeting_reschedules   WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_decisions      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_artifacts      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_private_notes  WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_manager_fields WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM one_on_one_meetings    WHERE id = ANY(_meeting_ids);

  RAISE NOTICE 'Deleted % meetings and related data', array_length(_meeting_ids, 1);
END $$;