
-- ==========================================================
-- Migration: Drop legacy PII encryption trigger & function
-- Security finding: external_encrypt_pii
-- Reason: Remove unauthorized PII exfiltration to external
--         Yandex Cloud endpoint via HTTP on every user
--         INSERT/UPDATE. Application-layer encryption was
--         already disabled (no-op). This migration removes
--         the database-level trigger and function permanently.
-- ==========================================================

-- 1. Drop the trigger
DROP TRIGGER IF EXISTS encrypt_user_data_trigger ON public.users;

-- 2. Drop the function
DROP FUNCTION IF EXISTS public.encrypt_user_sensitive_fields();

-- 3. Also drop the decrypt counterpart if it still exists
DROP FUNCTION IF EXISTS public.decrypt_user_sensitive_fields();

-- 4. Verification block
DO $$
DECLARE
  trigger_exists boolean;
  encrypt_fn_exists boolean;
  decrypt_fn_exists boolean;
BEGIN
  -- Check trigger
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'encrypt_user_data_trigger'
      AND c.relname = 'users'
      AND n.nspname = 'public'
  ) INTO trigger_exists;

  -- Check encrypt function
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'encrypt_user_sensitive_fields'
      AND n.nspname = 'public'
  ) INTO encrypt_fn_exists;

  -- Check decrypt function
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'decrypt_user_sensitive_fields'
      AND n.nspname = 'public'
  ) INTO decrypt_fn_exists;

  IF trigger_exists OR encrypt_fn_exists OR decrypt_fn_exists THEN
    RAISE EXCEPTION 'Verification failed: trigger_exists=%, encrypt_fn=%, decrypt_fn=%',
      trigger_exists, encrypt_fn_exists, decrypt_fn_exists;
  END IF;

  RAISE NOTICE 'Verification OK: PII encryption trigger and functions successfully removed';
END;
$$;
