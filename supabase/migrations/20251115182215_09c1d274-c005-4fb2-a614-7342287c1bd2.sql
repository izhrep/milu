-- Просмотрим все триггеры на diagnostic_stages
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'diagnostic_stages'
  AND trigger_schema = 'public';