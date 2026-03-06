-- Удаляем проблемную политику с рекурсией
DROP POLICY IF EXISTS "users_select_restricted" ON public.users;

-- Удаляем дублирующиеся политики - оставим только основные
DROP POLICY IF EXISTS "admins_can_view_all_users" ON public.users;
DROP POLICY IF EXISTS "managers_can_view_subordinates" ON public.users;
DROP POLICY IF EXISTS "users_can_view_evaluated_peers" ON public.users;
DROP POLICY IF EXISTS "users_can_view_for_peer_selection" ON public.users;
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_select_for_peer_selection" ON public.users;
DROP POLICY IF EXISTS "users_with_permission_can_view" ON public.users;

-- Оставляем основную политику users_select_auth_policy, но пересоздаём её безопасно
DROP POLICY IF EXISTS "users_select_auth_policy" ON public.users;

-- Создаем одну безопасную политику для SELECT
-- Используем только безопасные проверки без рекурсии
CREATE POLICY "users_select_policy" ON public.users
FOR SELECT TO authenticated
USING (
  -- Пользователь видит себя
  id = auth.uid()
  -- Или имеет право просмотра через permissions (без рекурсии к users)
  OR EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name IN ('users.view', 'security.manage_users')
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
  -- Или оцениваемый пользователь
  OR EXISTS (
    SELECT 1 FROM public.survey_360_assignments sa
    WHERE sa.evaluating_user_id = auth.uid()
    AND sa.evaluated_user_id = users.id
    AND sa.status IN ('approved', 'pending', 'completed')
  )
);