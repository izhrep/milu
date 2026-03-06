-- CR: Отвязка 1:1 от этапности + обновление формы
-- Запуск expire_stageless_meetings() по расписанию (каждые 30 минут)
-- Выполнить в Supabase SQL Editor вручную:

-- SELECT cron.schedule(
--   'expire-stageless-meetings',
--   '*/30 * * * *',
--   'SELECT public.expire_stageless_meetings()'
-- );
