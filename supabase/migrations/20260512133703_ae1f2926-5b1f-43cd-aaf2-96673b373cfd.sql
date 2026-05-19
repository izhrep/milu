-- Откат security-усилений по запросу пользователя (12.05.2026)
-- ВНИМАНИЕ: возвращает ранее закрытые уязвимости (см. mem://security/...).
-- has_role() НЕ удаляется — на него завязаны ещё активные policies (*_select_auth_policy и др.).

-- 1) user_roles: вернуть открытый SELECT (USING (true))
DROP POLICY IF EXISTS "Admins and HR can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS users_can_view_own_role_simple ON public.user_roles;
CREATE POLICY "user_roles_select_all"
  ON public.user_roles FOR SELECT
  USING (true);

-- 2) diagnostic_snapshot_jobs: убрать требование diagnostics.manage на INSERT
DROP POLICY IF EXISTS diagnostics_manage_can_enqueue_jobs ON public.diagnostic_snapshot_jobs;
CREATE POLICY "diagnostic_snapshot_jobs_insert_authenticated"
  ON public.diagnostic_snapshot_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3) hard_skill_results / soft_skill_results: вернуть evaluated_user_id = auth.uid()
DROP POLICY IF EXISTS hard_skill_results_select_auth_policy ON public.hard_skill_results;
CREATE POLICY hard_skill_results_select_auth_policy
  ON public.hard_skill_results FOR SELECT
  USING (
    evaluating_user_id = auth.uid()
    OR evaluated_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = hard_skill_results.evaluated_user_id AND u.manager_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr_bp'::app_role)
  );

DROP POLICY IF EXISTS soft_skill_results_select_auth_policy ON public.soft_skill_results;
CREATE POLICY soft_skill_results_select_auth_policy
  ON public.soft_skill_results FOR SELECT
  USING (
    evaluating_user_id = auth.uid()
    OR evaluated_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = soft_skill_results.evaluated_user_id AND u.manager_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr_bp'::app_role)
  );

-- 4) storage.objects для bucket meeting-artifacts: вернуть прежние SELECT/INSERT (без UUID-folder match)
DROP POLICY IF EXISTS meeting_artifacts_storage_select ON storage.objects;
DROP POLICY IF EXISTS meeting_artifacts_storage_insert ON storage.objects;

CREATE POLICY meeting_artifacts_storage_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meeting-artifacts'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY meeting_artifacts_storage_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-artifacts'
    AND auth.uid() IS NOT NULL
  );