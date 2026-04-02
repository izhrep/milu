
-- 1. Add permission
INSERT INTO permissions (name, description, resource, action)
VALUES ('meetings.edit_summary_date', 'Редактирование итогов и даты/времени любой встречи 1:1', 'meetings', 'edit_summary_date')
ON CONFLICT (name) DO NOTHING;

-- 2. Assign to hr_bp role
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id FROM permissions p
WHERE p.name = 'meetings.edit_summary_date'
ON CONFLICT DO NOTHING;

-- 3. Expand RLS UPDATE policy
DROP POLICY IF EXISTS "one_on_one_meetings_update_auth_policy" ON one_on_one_meetings;
CREATE POLICY "one_on_one_meetings_update_auth_policy"
ON one_on_one_meetings FOR UPDATE TO authenticated
USING (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_permission('meetings.manage')
  OR has_permission('meetings.edit_summary_date')
);

-- 4. Update trigger: catch summary re-edits (NOT NULL → different NOT NULL via IS DISTINCT FROM)
CREATE OR REPLACE FUNCTION public.notify_meeting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
  _meeting_id uuid;
  _payload jsonb;
  _function_url text;
  _anon_key text;
BEGIN
  _function_url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder';
  _anon_key := current_setting('app.settings.anon_key', true);

  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8';
  END IF;

  IF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _meeting_id := OLD.id;
    _payload := jsonb_build_object('meeting_id', _meeting_id, 'action', _action);
  ELSIF TG_OP = 'INSERT' THEN
    _action := 'schedule';
    _meeting_id := NEW.id;
    _payload := jsonb_build_object('meeting_id', _meeting_id, 'action', _action);
  ELSIF TG_OP = 'UPDATE' THEN
    _meeting_id := NEW.id;

    -- meeting_summary changed: NULL→NOT NULL or NOT NULL→different NOT NULL
    IF (OLD.meeting_summary IS NULL AND NEW.meeting_summary IS NOT NULL)
       OR (OLD.meeting_summary IS NOT NULL AND NEW.meeting_summary IS DISTINCT FROM OLD.meeting_summary)
    THEN
      _action := 'summary_saved';
      _payload := jsonb_build_object(
        'meeting_id', _meeting_id,
        'action', _action,
        'summary_saved_by', NEW.summary_saved_by
      );
    -- meeting_date changed → reschedule
    ELSIF OLD.meeting_date IS DISTINCT FROM NEW.meeting_date THEN
      _action := 'reschedule';
      _payload := jsonb_build_object(
        'meeting_id', _meeting_id,
        'action', _action,
        'new_date', NEW.meeting_date
      );
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  PERFORM net.http_post(
    url := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := _payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;
