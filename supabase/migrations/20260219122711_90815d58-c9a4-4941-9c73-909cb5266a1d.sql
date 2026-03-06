
-- Clean up Yurasova's expired meeting and related data for clean testing flow
DELETE FROM meeting_status_current WHERE meeting_id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
DELETE FROM one_on_one_meetings WHERE id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
