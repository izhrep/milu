-- ==========================================
-- ПОЛНЫЙ АУДИТ И ИСПРАВЛЕНИЕ СИСТЕМЫ АВТОРИЗАЦИИ
-- ==========================================

-- ==========================================
-- ЧАСТЬ 1: ОЧИСТКА СТАРЫХ RLS ПОЛИТИК НА ТАБЛИЦАХ АВТОРИЗАЦИИ
-- ==========================================

-- Удаляем все существующие политики на users
DROP POLICY IF EXISTS "users_select_auth_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- Удаляем все существующие политики на user_effective_permissions
DROP POLICY IF EXISTS "user_effective_permissions_select_policy" ON public.user_effective_permissions;
DROP POLICY IF EXISTS "user_effective_permissions_insert_policy" ON public.user_effective_permissions;
DROP POLICY IF EXISTS "user_effective_permissions_update_policy" ON public.user_effective_permissions;
DROP POLICY IF EXISTS "user_effective_permissions_delete_policy" ON public.user_effective_permissions;

-- ==========================================
-- ЧАСТЬ 2: СОЗДАНИЕ БЕЗОПАСНЫХ SECURITY DEFINER ФУНКЦИЙ
-- ==========================================

-- Функция проверки, является ли пользователь владельцем записи
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid, _record_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _record_user_id;
$$;

-- Функция получения ID текущего пользователя (безопасная обёртка)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- ==========================================
-- ЧАСТЬ 3: RLS ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ users
-- ==========================================

-- Включаем RLS на users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT: Пользователи могут видеть:
-- 1. Свою собственную запись (через auth.uid())
-- 2. Все записи, если есть разрешение users.view
-- 3. Все записи, если есть разрешение users.manage
CREATE POLICY "users_select_auth_policy"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR can_view_users(auth.uid()) 
  OR can_manage_users(auth.uid())
);

-- INSERT: Только пользователи с разрешением users.manage
CREATE POLICY "users_insert_auth_policy"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (can_manage_users(auth.uid()));

-- UPDATE: Только пользователи с разрешением users.manage
CREATE POLICY "users_update_auth_policy"
ON public.users
FOR UPDATE
TO authenticated
USING (can_manage_users(auth.uid()));

-- DELETE: Только пользователи с разрешением users.manage
CREATE POLICY "users_delete_auth_policy"
ON public.users
FOR DELETE
TO authenticated
USING (can_manage_users(auth.uid()));

-- ==========================================
-- ЧАСТЬ 4: RLS ПОЛИТИКИ ДЛЯ user_effective_permissions
-- ==========================================

-- Включаем RLS
ALTER TABLE public.user_effective_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: Пользователи могут видеть только свои разрешения
CREATE POLICY "user_effective_permissions_select_policy"
ON public.user_effective_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: Только системные операции (через SECURITY DEFINER функции)
-- Обычные пользователи не должны напрямую изменять эту таблицу
CREATE POLICY "user_effective_permissions_system_only"
ON public.user_effective_permissions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- ==========================================
-- ЧАСТЬ 5: ПРОВЕРКА ФУНКЦИИ has_permission
-- ==========================================

-- Пересоздаём has_permission для гарантии отсутствия рекурсии
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_effective_permissions
    WHERE user_id = auth.uid() 
      AND permission_name = _permission_name
  );
$$;

-- ==========================================
-- ЧАСТЬ 6: ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
-- ==========================================

-- Убеждаемся, что у всех пользователей есть роли
DO $$
DECLARE
  users_without_roles INT;
BEGIN
  SELECT COUNT(*) INTO users_without_roles
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
  );
  
  IF users_without_roles > 0 THEN
    RAISE NOTICE 'ПРЕДУПРЕЖДЕНИЕ: % пользователей без ролей', users_without_roles;
  END IF;
END $$;

-- ==========================================
-- ЧАСТЬ 7: ОТЧЁТ О ПРОДЕЛАННОЙ РАБОТЕ
-- ==========================================

DO $$ 
DECLARE
  users_policies_count INT;
  user_roles_policies_count INT;
  permissions_policies_count INT;
  user_effective_permissions_policies_count INT;
BEGIN
  -- Подсчёт политик на users
  SELECT COUNT(*) INTO users_policies_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'users';
  
  -- Подсчёт политик на user_roles
  SELECT COUNT(*) INTO user_roles_policies_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_roles';
  
  -- Подсчёт политик на permissions
  SELECT COUNT(*) INTO permissions_policies_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'permissions';
  
  -- Подсчёт политик на user_effective_permissions
  SELECT COUNT(*) INTO user_effective_permissions_policies_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_effective_permissions';
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'АУДИТ СИСТЕМЫ АВТОРИЗАЦИИ ЗАВЕРШЁН';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Таблица users: % политик RLS', users_policies_count;
  RAISE NOTICE 'Таблица user_roles: % политик RLS', user_roles_policies_count;
  RAISE NOTICE 'Таблица permissions: % политик RLS', permissions_policies_count;
  RAISE NOTICE 'Таблица user_effective_permissions: % политик RLS', user_effective_permissions_policies_count;
  RAISE NOTICE '================================================';
  RAISE NOTICE 'ИСПРАВЛЕНИЯ:';
  RAISE NOTICE '- Удалены рекурсивные RLS политики на users';
  RAISE NOTICE '- Созданы безопасные SECURITY DEFINER функции';
  RAISE NOTICE '- Пересозданы все RLS политики без рекурсии';
  RAISE NOTICE '- Добавлены политики на user_effective_permissions';
  RAISE NOTICE '- Функция has_permission использует только user_effective_permissions';
  RAISE NOTICE '================================================';
END $$;