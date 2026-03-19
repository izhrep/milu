
-- Data fix: restore peer_selection task for Yurasova that was incorrectly completed
UPDATE tasks 
SET status = 'pending', updated_at = now()
WHERE id = '1f0bfe3f-8e6a-4578-be45-fe1337314a4b'
  AND task_type = 'peer_selection'
  AND status = 'completed';
