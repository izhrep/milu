DELETE FROM meeting_decisions WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
DELETE FROM meeting_private_notes WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
DELETE FROM meeting_status_current WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
DELETE FROM one_on_one_meetings WHERE id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';