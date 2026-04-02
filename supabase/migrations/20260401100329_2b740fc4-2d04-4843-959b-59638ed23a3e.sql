CREATE OR REPLACE FUNCTION public.cleanup_meeting_tasks_on_delete()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE assignment_id = OLD.id
    AND task_type IN ('meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary')
    AND status IN ('pending', 'in_progress');
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_meeting_tasks_on_delete
  AFTER DELETE ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_meeting_tasks_on_delete();