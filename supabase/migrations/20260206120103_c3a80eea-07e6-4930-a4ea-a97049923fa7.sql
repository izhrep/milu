
-- Удаляем текущую политику с рекурсией
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

-- Создаем безопасную политику БЕЗ ссылки на survey_360_assignments
-- Используем только безопасные проверки:
-- 1. user_roles (напрямую, без RLS проблем)
-- 2. user_effective_permissions (нет ссылки на users)
-- 3. diagnostic_stage_participants (нет ссылки на users)
CREATE POLICY "users_select_policy" ON public.users
FOR SELECT TO authenticated
USING (
  -- Пользователь видит себя
  id = auth.uid()
  -- Или это админ или HR BP (прямая проверка user_roles - безопасно)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'hr_bp')
  )
  -- Или имеет право просмотра через permissions
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('users.view', 'users.view_all', 'security.manage_users')
  )
  -- Или это подчиненный текущего пользователя
  OR manager_id = auth.uid()
  -- Или активный пользователь и текущий участник диагностики (для выбора пиров)
  OR (
    status = true
    AND EXISTS (
      SELECT 1 FROM public.diagnostic_stage_participants dsp
      WHERE dsp.user_id = auth.uid()
    )
  )
);
