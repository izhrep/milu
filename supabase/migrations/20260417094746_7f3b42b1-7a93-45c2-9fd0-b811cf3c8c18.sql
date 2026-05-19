-- Расширяем notify_meeting_change: при первичном появлении непустых итогов
-- встречи 1:1 дополнительно ставим в очередь R8 (Bitrix-уведомление HRBP сотрудника).
-- Внутреннюю задачу в Milu НЕ создаём — только Bitrix через enqueue-reminder.
--
-- Гарантии:
--   * Отсутствие hr_bp_id у сотрудника НЕ является ошибкой — просто пропускаем R8.
--   * Любой сбой постановки R8 в очередь (lookup, net.http_post) НЕ ломает
--     сохранение meeting_summary (обёрнуто в EXCEPTION-блок).

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
  -- Тоже защищаем, чтобы сетевая ошибка не валила запись.
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