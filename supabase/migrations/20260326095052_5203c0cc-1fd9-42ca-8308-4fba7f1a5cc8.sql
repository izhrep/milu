
-- Make meeting_id nullable in meeting_notifications for R1n (no meeting context)
ALTER TABLE public.meeting_notifications ALTER COLUMN meeting_id DROP NOT NULL;

-- Trigger: when bitrix_bot_enabled is set to true, call enqueue-reminder with action=bitrix_user_connected
CREATE OR REPLACE FUNCTION public.notify_bitrix_user_connected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when bitrix_bot_enabled changes from false/null to true
  IF (NEW.bitrix_bot_enabled = true)
     AND (OLD.bitrix_bot_enabled IS DISTINCT FROM true)
     AND (NEW.bitrix_user_id IS NOT NULL)
  THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/enqueue-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY')
      ),
      body := jsonb_build_object(
        'action', 'bitrix_user_connected',
        'user_id', NEW.id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitrix_user_connected ON public.users;
CREATE TRIGGER trg_bitrix_user_connected
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_bitrix_user_connected();
