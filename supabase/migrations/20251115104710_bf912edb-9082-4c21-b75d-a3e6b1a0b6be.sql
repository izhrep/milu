-- Создание функции has_permission для проверки разрешений пользователя
-- Используется в RLS политиках для контроля доступа

CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = _permission_name
  );
$$;

-- Также создадим перегруженную версию для проверки разрешений конкретного пользователя
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = _user_id
      AND permission_name = _permission_name
  );
$$;

-- Дополнительные вспомогательные функции для работы с встречами
CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.one_on_one_meetings
    WHERE id = _meeting_id
      AND (employee_id = _user_id OR manager_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_meeting_stage_participant(_stage_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_stage_participants
    WHERE stage_id = _stage_id
      AND user_id = _user_id
  );
$$;

-- Функция для получения текущего user_id из сессии
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Функция для получения текущего session user (для логирования)
CREATE OR REPLACE FUNCTION public.get_current_session_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;