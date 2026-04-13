
CREATE OR REPLACE FUNCTION public.cleanup_meeting_tasks_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE assignment_id = OLD.id
    AND task_type IN ('meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary')
    AND status IN ('pending', 'in_progress', 'closed');
  RETURN OLD;
END;
$$;
