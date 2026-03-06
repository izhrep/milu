-- Удаляем view с SECURITY DEFINER и создаём обычную view
DROP VIEW IF EXISTS stages_with_status;

CREATE OR REPLACE VIEW stages_with_status AS
SELECT 
  ds.*,
  get_stage_status_by_dates(ds.start_date, ds.end_date) as computed_status,
  (SELECT COUNT(*) FROM diagnostic_stage_participants WHERE stage_id = ds.id) as participants_count
FROM diagnostic_stages ds
WHERE ds.parent_stage_id IS NULL;

GRANT SELECT ON stages_with_status TO authenticated;

-- Создаём RLS политику для view
ALTER VIEW stages_with_status SET (security_invoker = true);