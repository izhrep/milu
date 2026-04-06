
-- Step 1: Unschedule the legacy cron job with hardcoded URL/JWT
SELECT cron.unschedule('process-bitrix-reminders');

-- Step 2: Create a SECURITY DEFINER function that reads credentials from vault
CREATE OR REPLACE FUNCTION public.invoke_process_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  -- Read SUPABASE_URL from vault
  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_URL'
   LIMIT 1;

  -- Read SUPABASE_ANON_KEY from vault
  SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_ANON_KEY'
   LIMIT 1;

  -- Safety check: skip if secrets are missing
  IF _url IS NULL OR _url = '' OR _key IS NULL OR _key = '' THEN
    RAISE WARNING '[invoke_process_reminders] vault secrets missing: SUPABASE_URL=% SUPABASE_ANON_KEY=%',
      CASE WHEN _url IS NULL OR _url = '' THEN 'MISSING' ELSE 'OK' END,
      CASE WHEN _key IS NULL OR _key = '' THEN 'MISSING' ELSE 'OK' END;
    RETURN;
  END IF;

  -- Call the process-reminders edge function
  PERFORM net.http_post(
    url   := _url || '/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body  := jsonb_build_object('time', now()::text)
  );
END;
$$;

-- Step 3: Schedule new cron job using the vault-aware function
SELECT cron.schedule(
  'process-bitrix-reminders',
  '*/5 * * * *',
  $$SELECT public.invoke_process_reminders()$$
);
