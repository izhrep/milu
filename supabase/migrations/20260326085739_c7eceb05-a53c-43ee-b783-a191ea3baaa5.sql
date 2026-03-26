-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ─── Trigger function: enqueue reminder via Edge Function ───
CREATE OR REPLACE FUNCTION public.notify_meeting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _meeting_id uuid;
  _payload jsonb;
  _function_url text;
  _anon_key text;
BEGIN
  _function_url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder';
  _anon_key := current_setting('app.settings.anon_key', true);

  -- Fallback anon key if not set via app.settings
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

    -- meeting_summary changed from NULL to NOT NULL → summary_saved
    IF OLD.meeting_summary IS NULL AND NEW.meeting_summary IS NOT NULL THEN
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
      -- No relevant change
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- Fire and forget HTTP call via pg_net
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
$$;

-- ─── Attach trigger ───
DROP TRIGGER IF EXISTS trg_meeting_notify ON public.one_on_one_meetings;

CREATE TRIGGER trg_meeting_notify
  AFTER INSERT OR UPDATE OR DELETE
  ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_change();

-- ─── RLS for meeting_notifications ───
ALTER TABLE public.meeting_notifications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Edge Functions use service role)
-- No user-facing RLS policies needed since users don't query this table directly

-- ─── Index for process-reminders cron query ───
CREATE INDEX IF NOT EXISTS idx_meeting_notifications_pending
  ON public.meeting_notifications (status, scheduled_at)
  WHERE status = 'pending';