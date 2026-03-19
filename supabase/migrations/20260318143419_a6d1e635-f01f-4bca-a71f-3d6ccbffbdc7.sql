-- Delete related data for Yurasova's meetings, then the meetings themselves
DELETE FROM meeting_decisions WHERE meeting_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
DELETE FROM tasks WHERE assignment_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
DELETE FROM one_on_one_meetings WHERE id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');