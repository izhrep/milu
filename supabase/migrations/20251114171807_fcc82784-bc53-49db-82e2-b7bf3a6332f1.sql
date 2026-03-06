-- ====================================================================
-- Миграция: Исправление бесконечной рекурсии в RLS политике users
-- Проблема: has_permission() обращается к users через user_effective_permissions
-- Решение: Использовать прямую проверку user_effective_permissions
-- ====================================================================

-- 1. Удаляем проблемную политику
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- 2. Создаём политику без рекурсии, используя прямую проверку user_effective_permissions
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
  -- HR BP видит пользователей своего департамента
  (
    EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
        AND uep.permission_name = 'users.view_department'
    )
    AND department_id IN (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "users_select_policy" ON users IS 
'Ограниченный доступ к пользователям БЕЗ рекурсии:
- Пользователь видит себя
- Admin видит всех (users.view_all через user_effective_permissions)
- Manager видит только подчинённых (team.view + manager_id = auth.uid())
- HR BP видит пользователей своего департамента (users.view_department)';