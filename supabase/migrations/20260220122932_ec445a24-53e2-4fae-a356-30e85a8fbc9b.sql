
-- Delete meeting_status_current first (FK), then the meeting itself (CASCADE will handle it too)
DELETE FROM meeting_status_current WHERE meeting_id = '15f16559-c295-47a9-9877-c30ab956886d';
DELETE FROM one_on_one_meetings WHERE id = '15f16559-c295-47a9-9877-c30ab956886d';
