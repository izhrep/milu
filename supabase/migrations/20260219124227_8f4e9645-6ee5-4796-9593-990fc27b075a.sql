DELETE FROM meeting_status_current WHERE meeting_id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
DELETE FROM one_on_one_meetings WHERE id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';