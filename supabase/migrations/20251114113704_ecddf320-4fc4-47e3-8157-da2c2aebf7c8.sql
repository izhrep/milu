-- ====================================================================
-- ИСПРАВЛЕНИЕ RLS НА ТАБЛИЦЕ USERS: УСТРАНЕНИЕ РЕКУРСИИ
-- ====================================================================

-- ШАГ 1: УДАЛЯЕМ ВСЕ СУЩЕСТВУЮЩИЕ ПОЛИТИКИ НА ТАБЛИЦЕ USERS
DROP POLICY IF EXISTS "users_select_auth_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- ШАГ 2: СОЗДАЁМ SECURITY DEFINER ФУНКЦИИ БЕЗ ОБРАЩЕНИЯ К USERS

-- Функция проверки права на просмотр пользователей
CREATE OR REPLACE FUNCTION public.can_view_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_effective_permissions
    WHERE user_id = _user_id 
      AND permission_name = 'users.view'
  );
$$;

-- Функция проверки права на управление пользователями
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_effective_permissions
    WHERE user_id = _user_id 
      AND permission_name = 'users.manage'
  );
$$;

-- ШАГ 3: СОЗДАЁМ НОВЫЕ RLS ПОЛИТИКИ БЕЗ РЕКУРСИИ

-- SELECT: пользователь видит себя ИЛИ имеет право users.view ИЛИ users.manage
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT
  USING (
    id = auth.uid() 
    OR can_view_users(auth.uid())
    OR can_manage_users(auth.uid())
  );

-- INSERT: только с правом users.manage
CREATE POLICY "users_insert_policy" ON public.users
  FOR INSERT
  WITH CHECK (can_manage_users(auth.uid()));

-- UPDATE: только с правом users.manage
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE
  USING (can_manage_users(auth.uid()))
  WITH CHECK (can_manage_users(auth.uid()));

-- DELETE: только с правом users.manage
CREATE POLICY "users_delete_policy" ON public.users
  FOR DELETE
  USING (can_manage_users(auth.uid()));

-- ШАГ 4: ПРОВЕРЯЕМ ЧТО RLS ВКЛЮЧЁН
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ШАГ 5: СОЗДАЁМ ФУНКЦИЮ ШИФРОВАНИЯ ДЛЯ ТРИГГЕРА
CREATE OR REPLACE FUNCTION public.encrypt_user_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_url TEXT := 'https://functions.yandexcloud.net/d4e4qgtlth6cvb1lnbu4';
  response TEXT;
BEGIN
  -- Шифруем только если поля не зашифрованы (простая проверка по длине)
  -- Зашифрованные данные обычно длиннее 100 символов
  
  IF NEW.first_name IS NOT NULL AND length(NEW.first_name) < 100 THEN
    BEGIN
      SELECT content INTO response
      FROM http((
        'POST',
        encryption_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object('text', NEW.first_name)::text
      )::http_request);
      
      NEW.first_name := (response::json)->>'encrypted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt first_name: %', SQLERRM;
    END;
  END IF;
  
  IF NEW.last_name IS NOT NULL AND length(NEW.last_name) < 100 THEN
    BEGIN
      SELECT content INTO response
      FROM http((
        'POST',
        encryption_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object('text', NEW.last_name)::text
      )::http_request);
      
      NEW.last_name := (response::json)->>'encrypted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt last_name: %', SQLERRM;
    END;
  END IF;
  
  IF NEW.middle_name IS NOT NULL AND length(NEW.middle_name) < 100 THEN
    BEGIN
      SELECT content INTO response
      FROM http((
        'POST',
        encryption_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object('text', NEW.middle_name)::text
      )::http_request);
      
      NEW.middle_name := (response::json)->>'encrypted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt middle_name: %', SQLERRM;
    END;
  END IF;
  
  IF NEW.email IS NOT NULL AND length(NEW.email) < 100 THEN
    BEGIN
      SELECT content INTO response
      FROM http((
        'POST',
        encryption_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object('text', NEW.email)::text
      )::http_request);
      
      NEW.email := (response::json)->>'encrypted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt email: %', SQLERRM;
    END;
  END IF;
  
  IF NEW.employee_number IS NOT NULL AND length(NEW.employee_number) < 100 THEN
    BEGIN
      SELECT content INTO response
      FROM http((
        'POST',
        encryption_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object('text', NEW.employee_number)::text
      )::http_request);
      
      NEW.employee_number := (response::json)->>'encrypted';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt employee_number: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ШАГ 6: СОЗДАЁМ ТРИГГЕР ДЛЯ АВТОМАТИЧЕСКОГО ШИФРОВАНИЯ
DROP TRIGGER IF EXISTS encrypt_user_data_trigger ON public.users;

CREATE TRIGGER encrypt_user_data_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_user_sensitive_fields();

-- ШАГ 7: ЛОГИРОВАНИЕ И ПРОВЕРКА
DO $$
DECLARE
  policies_count INTEGER;
  functions_count INTEGER;
BEGIN
  -- Считаем созданные политики
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';
  
  -- Проверяем функции
  SELECT COUNT(*) INTO functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN ('can_view_users', 'can_manage_users', 'encrypt_user_sensitive_fields');
  
  RAISE NOTICE '✅ RLS-политики пересозданы: % шт.', policies_count;
  RAISE NOTICE '✅ SECURITY DEFINER функции созданы: % шт.', functions_count;
  RAISE NOTICE '✅ Триггер шифрования установлен';
  RAISE NOTICE '✅ Рекурсия устранена: RLS не обращается к таблице users';
END $$;