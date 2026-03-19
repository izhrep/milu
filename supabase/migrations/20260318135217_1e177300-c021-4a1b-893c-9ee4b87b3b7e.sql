
-- Schedule pg_cron jobs for meeting status and task processing
SELECT cron.schedule('process-meeting-status', '*/15 * * * *', 'SELECT public.process_meeting_status()');
SELECT cron.schedule('process-meeting-tasks', '*/15 * * * *', 'SELECT public.process_meeting_tasks()');
