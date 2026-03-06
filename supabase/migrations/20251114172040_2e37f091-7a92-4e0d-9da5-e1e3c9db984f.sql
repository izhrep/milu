-- ====================================================================
-- Миграция: Окончательное устранение рекурсии в RLS политике users
-- Проблема: Подзапрос к users в проверке для HR BP создает рекурсию
-- Решение: Создать security definer функцию для получения department_id
-- ====================================================================

-- 1. Создаем security definer функцию для получения department_id пользователя
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM users
  WHERE id = _user_id;
$$;

-- 2. Удаляем проблемную политику
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- 3. Создаём политику БЕЗ рекурсии, используя security definer функцию
CREATE POLICY "users_select_policy" ON users
FOR SELECT
USING (
  -- Сам пользователь всегда видит свою запись
  id = auth.uid()
  OR
  -- Admin видит всех через разрешение users.view_all (прямая проверка)
  EXISTS (
    SELECT 1 FROM user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
      AND uep.permission_name = 'users.view_all'
  )
  OR
  -- Manager видит только своих подчинённых
  (
    EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
        AND uep.permission_name = 'team.view'
    )
    AND manager_id = auth.uid()
  )
  OR
  -- HR BP видит пользователей своего департамента (БЕЗ рекурсии через security definer)
  (
    EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
        AND uep.permission_name = 'users.view_department'
    )
    AND department_id = get_user_department_id(auth.uid())
  )
);

COMMENT ON POLICY "users_select_policy" ON users IS 
'Ограниченный доступ к пользователям БЕЗ рекурсии:
- Пользователь видит себя
- Admin видит всех (users.view_all через user_effective_permissions)
- Manager видит только подчинённых (team.view + manager_id = auth.uid())
- HR BP видит пользователей своего департамента (users.view_department + security definer функция)';