-- =====================================================
-- ИСПРАВЛЕНИЕ КРИТИЧЕСКИХ ПРОБЛЕМ БЕЗОПАСНОСТИ
-- =====================================================

-- 1. ИСПРАВЛЕНИЕ: Таблица users - ограничиваем публичный доступ
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;

CREATE POLICY "users_select_policy"
ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users subordinate
    WHERE subordinate.id = users.id
    AND subordinate.manager_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'hr_bp'
    AND EXISTS (
      SELECT 1 FROM public.users hr_user
      JOIN public.departments hr_dept ON hr_user.department_id = hr_dept.id
      JOIN public.departments user_dept ON users.department_id = user_dept.id
      WHERE hr_user.id = auth.uid()
      AND hr_dept.company_id = user_dept.company_id
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. ИСПРАВЛЕНИЕ: Таблица audit_log - только для администраторов
DROP POLICY IF EXISTS "audit_log_select_admin_only" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_system" ON public.audit_log;

CREATE POLICY "audit_log_select_admin_only"
ON public.audit_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "audit_log_insert_system"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. ИСПРАВЛЕНИЕ: Таблица user_assessment_results
DROP POLICY IF EXISTS "user_assessment_results_select_policy" ON public.user_assessment_results;
DROP POLICY IF EXISTS "user_assessment_results_insert_policy" ON public.user_assessment_results;
DROP POLICY IF EXISTS "user_assessment_results_update_policy" ON public.user_assessment_results;
DROP POLICY IF EXISTS "user_assessment_results_insert_system" ON public.user_assessment_results;
DROP POLICY IF EXISTS "user_assessment_results_update_admin_hr" ON public.user_assessment_results;
DROP POLICY IF EXISTS "user_assessment_results_delete_admin" ON public.user_assessment_results;

CREATE POLICY "user_assessment_results_select_policy"
ON public.user_assessment_results FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_assessment_results.user_id
    AND users.manager_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_assessment_results_insert_system"
ON public.user_assessment_results FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_assessment_results_update_admin_hr"
ON public.user_assessment_results FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_assessment_results_delete_admin"
ON public.user_assessment_results FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 4. Усиливаем безопасность admin_activity_logs
DROP POLICY IF EXISTS "admin_activity_logs_select_admin_only" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "admin_activity_logs_insert_system" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_system" ON public.admin_activity_logs;

CREATE POLICY "admin_activity_logs_select_admin_only"
ON public.admin_activity_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "admin_activity_logs_insert_system"
ON public.admin_activity_logs FOR INSERT TO authenticated
WITH CHECK (true);