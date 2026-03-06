-- Удаляем старый триггер, который пытается обратиться к удалённым полям
DROP TRIGGER IF EXISTS log_diagnostic_stage_changes_trigger ON diagnostic_stages;
DROP FUNCTION IF EXISTS log_diagnostic_stage_changes();

-- Создаем новую функцию логирования без ссылок на удалённые поля
CREATE OR REPLACE FUNCTION log_diagnostic_stage_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.email,
      'CREATE',
      'diagnostic_stage',
      p.period, -- берем из parent_stages
      jsonb_build_object(
        'stage_id', NEW.id,
        'parent_id', NEW.parent_id,
        'evaluation_period', NEW.evaluation_period
      )
    FROM users u
    LEFT JOIN parent_stages p ON p.id = NEW.parent_id
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT
      get_current_session_user(),
      u.email,
      'UPDATE',
      'diagnostic_stage',
      p.period, -- берем из parent_stages
      jsonb_build_object(
        'stage_id', NEW.id,
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    FROM users u
    LEFT JOIN parent_stages p ON p.id = NEW.parent_id
    WHERE u.id = get_current_session_user();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Создаем триггеры заново
CREATE TRIGGER log_diagnostic_stage_changes_trigger
  AFTER INSERT OR UPDATE ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION log_diagnostic_stage_changes();