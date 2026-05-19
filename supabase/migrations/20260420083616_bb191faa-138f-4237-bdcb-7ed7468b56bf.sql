-- Восстанавливаем vault-based получение секретов в notify_meeting_change(),
-- которое было утрачено в миграции 20260417094746 (регрессия: hardcoded URL + JWT).
-- Бизнес-логика (INSERT/UPDATE/DELETE, summary_saved, reschedule, R8 hrbp_summary_available)
-- сохраняется один-в-один из 20260417094746. Меняется только блок получения
-- _function_url / _anon_key + добавляется guard на пустые Vault secrets
-- + safe join URL через rtrim для защиты от двойного слэша.

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
  _hrbp_id uuid;
  _summary_became_nonempty boolean := false;
BEGIN
  -- ─── Vault-based resolve секретов (восстановлено из 20260403125225) ───
  SELECT decrypted_secret INTO _function_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO _anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  -- Guard: при отсутствии секретов — тихо выходим, не валим запись в one_on_one_meetings.
  IF _function_url IS NULL OR _function_url = ''
     OR _anon_key IS NULL OR _anon_key = ''
  THEN
    RAISE WARNING 'notify_meeting_change: SUPABASE_URL/SUPABASE_ANON_KEY missing in vault.decrypted_secrets — notification skipped';
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Safe join: защищаемся от двойного слэша, если SUPABASE_URL сохранён со слэшем на конце.
  _function_url := rtrim(_function_url, '/') || '/functions/v1/enqueue-reminder';

  IF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _meeting_id := OLD.id;
    _payload := jsonb_build_object('meeting_id', _meeting_id, 'action', _action);

  ELSIF TG_OP = 'INSERT' THEN
    _action := 'schedule';
    _meeting_id := NEW.id;
    _payload := jsonb_build_object('meeting_id', _meeting_id, 'action', _action);

    -- Edge case: встреча создана сразу с непустым summary
    IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary <> '' THEN
      _summary_became_nonempty := true;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    _meeting_id := NEW.id;

    -- Summary впервые стал непустым (NULL или '' → непустая строка)
    IF NEW.meeting_summary IS NOT NULL
       AND NEW.meeting_summary <> ''
       AND COALESCE(OLD.meeting_summary, '') = ''
    THEN
      _summary_became_nonempty := true;
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

  -- Основной вызов (schedule / summary_saved / reschedule / deleted).
  -- Защищаем, чтобы сетевая ошибка не валила запись.
  IF _payload IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := _function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := _payload
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_meeting_change main http_post failed: %', SQLERRM;
    END;
  END IF;

  -- ─── R8: HRBP summary available ───
  -- Полностью изолирован: ни отсутствие hr_bp_id, ни сбой lookup, ни сбой
  -- net.http_post НЕ ломают сохранение meeting_summary.
  IF _summary_became_nonempty THEN
    BEGIN
      SELECT u.hr_bp_id INTO _hrbp_id
      FROM public.users u
      WHERE u.id = NEW.employee_id;

      IF _hrbp_id IS NOT NULL THEN
        PERFORM net.http_post(
          url := _function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _anon_key
          ),
          body := jsonb_build_object(
            'action', 'hrbp_summary_available',
            'meeting_id', NEW.id,
            'hrbp_id', _hrbp_id
          )
        );
      END IF;
      -- _hrbp_id IS NULL — это НОРМАЛЬНАЯ ситуация, не ошибка.
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_meeting_change R8 enqueue failed for meeting %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;