
-- Migration: Replace hardcoded URL/JWT with vault secrets in trigger functions
-- Fixes: notify_meeting_change() and notify_bitrix_user_connected()

-- 1. Fix notify_meeting_change() — remove hardcoded URL and anon key
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
  -- Resolve secrets from vault
  SELECT decrypted_secret INTO _function_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF _function_url IS NULL OR _function_url = '' OR _anon_key IS NULL OR _anon_key = '' THEN
    RAISE WARNING 'notify_meeting_change: vault secrets SUPABASE_URL or SUPABASE_ANON_KEY not found, skipping notification';
    RETURN COALESCE(NEW, OLD);
  END IF;

  _function_url := _function_url || '/functions/v1/enqueue-reminder';

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

    IF (OLD.meeting_summary IS NULL AND NEW.meeting_summary IS NOT NULL)
       OR (OLD.meeting_summary IS NOT NULL AND NEW.meeting_summary IS DISTINCT FROM OLD.meeting_summary)
    THEN
      _action := 'summary_saved';
      _payload := jsonb_build_object(
        'meeting_id', _meeting_id,
        'action', _action,
        'summary_saved_by', NEW.summary_saved_by
      );
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

-- 2. Fix notify_bitrix_user_connected() — remove hardcoded URL and anon key
CREATE OR REPLACE FUNCTION public.notify_bitrix_user_connected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base_url text;
  _anon_key text;
BEGIN
  IF (NEW.bitrix_bot_enabled = true)
     AND (OLD.bitrix_bot_enabled IS DISTINCT FROM true)
     AND (NEW.bitrix_user_id IS NOT NULL)
  THEN
    SELECT decrypted_secret INTO _base_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _base_url IS NULL OR _base_url = '' OR _anon_key IS NULL OR _anon_key = '' THEN
      RAISE WARNING 'notify_bitrix_user_connected: vault secrets not found, skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := _base_url || '/functions/v1/enqueue-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
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
