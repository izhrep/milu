CREATE UNIQUE INDEX IF NOT EXISTS uq_active_meeting_task
  ON public.tasks (assignment_id, task_type, user_id)
  WHERE status IN ('pending', 'in_progress')
    AND task_type IN ('meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary');