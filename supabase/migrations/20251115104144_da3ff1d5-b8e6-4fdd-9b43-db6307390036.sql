-- =====================================================
-- Миграция: Удаление user_kpi_results и добавление RLS политик
-- =====================================================

-- 1. Удаление неиспользуемых таблиц KPI
DROP TABLE IF EXISTS public.user_kpi_results CASCADE;
DROP TABLE IF EXISTS public.kpi_targets CASCADE;

-- 2. RLS политики для user_trade_points
ALTER TABLE public.user_trade_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_trade_points_select_policy"
ON public.user_trade_points FOR SELECT TO authenticated
USING (true);

CREATE POLICY "user_trade_points_insert_policy"
ON public.user_trade_points FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_trade_points.user_id
    AND users.manager_id = auth.uid()
  )
);

CREATE POLICY "user_trade_points_update_policy"
ON public.user_trade_points FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_trade_points.user_id
    AND users.manager_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_trade_points.user_id
    AND users.manager_id = auth.uid()
  )
);

CREATE POLICY "user_trade_points_delete_policy"
ON public.user_trade_points FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- 3. RLS политики для user_skills
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills_select_policy"
ON public.user_skills FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_skills.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_skills_insert_policy"
ON public.user_skills FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_skills_update_policy"
ON public.user_skills FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_skills.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_skills.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_skills_delete_policy"
ON public.user_skills FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- 4. RLS политики для user_qualities
ALTER TABLE public.user_qualities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_qualities_select_policy"
ON public.user_qualities FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_qualities.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_qualities_insert_policy"
ON public.user_qualities FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_qualities_update_policy"
ON public.user_qualities FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_qualities.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_qualities.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "user_qualities_delete_policy"
ON public.user_qualities FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);