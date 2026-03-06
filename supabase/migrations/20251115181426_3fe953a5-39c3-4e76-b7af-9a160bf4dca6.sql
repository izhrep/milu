-- Удаляем дублирующиеся поля из diagnostic_stages (они теперь в parent_stages)
ALTER TABLE diagnostic_stages 
  DROP COLUMN IF EXISTS period,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS deadline_date;

-- Удаляем дублирующиеся поля из meeting_stages (они теперь в parent_stages)
ALTER TABLE meeting_stages 
  DROP COLUMN IF EXISTS period,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS deadline_date,
  DROP COLUMN IF EXISTS is_active;