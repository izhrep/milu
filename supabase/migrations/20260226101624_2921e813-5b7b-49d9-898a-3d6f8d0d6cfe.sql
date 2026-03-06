
-- Delete meeting-related data for Tkachenko meetings
DELETE FROM meeting_artifacts WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
DELETE FROM meeting_decisions WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
DELETE FROM meeting_private_notes WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
DELETE FROM meeting_status_current WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
DELETE FROM one_on_one_meetings WHERE employee_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
DELETE FROM tasks WHERE user_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
