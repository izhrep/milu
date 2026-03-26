CREATE OR REPLACE FUNCTION public.notify_bitrix_user_connected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.bitrix_bot_enabled = true)
     AND (OLD.bitrix_bot_enabled IS DISTINCT FROM true)
     AND (NEW.bitrix_user_id IS NOT NULL)
  THEN
    PERFORM net.http_post(
      url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8'
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