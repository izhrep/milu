
-- ============================================================
-- Wave 1: Snapshot DDL — header, 16 snapshot tables, jobs queue
-- ============================================================

-- 1.1 Header table
CREATE TABLE public.diagnostic_result_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.diagnostic_stages(id),
  evaluated_user_id uuid NOT NULL REFERENCES public.users(id),
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  data_hash text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, evaluated_user_id, version)
);
CREATE INDEX idx_drs_current ON public.diagnostic_result_snapshots(stage_id, evaluated_user_id) WHERE is_current;
ALTER TABLE public.diagnostic_result_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2a diagnostic_user_snapshots
CREATE TABLE public.diagnostic_user_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.users(id),
  last_name text,
  first_name text,
  middle_name text,
  grade_id uuid,
  grade_name text,
  position_name text,
  department_name text,
  position_category_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.diagnostic_user_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2b survey_assignment_snapshots
CREATE TABLE public.survey_assignment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.survey_360_assignments(id),
  evaluating_user_id uuid,
  assignment_type text,
  evaluator_last_name text,
  evaluator_first_name text,
  evaluator_position_category_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.survey_assignment_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2c answer_category_snapshots
CREATE TABLE public.answer_category_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.answer_categories(id),
  name text NOT NULL,
  question_type text,
  comment_required boolean,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.answer_category_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2d grade_skill_snapshots
CREATE TABLE public.grade_skill_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.grade_skills(id),
  skill_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  target_level integer NOT NULL,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.grade_skill_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2e grade_quality_snapshots
CREATE TABLE public.grade_quality_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.grade_qualities(id),
  quality_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  target_level integer NOT NULL,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.grade_quality_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2f hard_skill_category_snapshots
CREATE TABLE public.hard_skill_category_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.category_hard_skills(id),
  name text NOT NULL,
  description text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.hard_skill_category_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2g hard_skill_subcategory_snapshots
CREATE TABLE public.hard_skill_subcategory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.sub_category_hard_skills(id),
  name text NOT NULL,
  category_id uuid,
  category_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.hard_skill_subcategory_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2h hard_skill_snapshots
CREATE TABLE public.hard_skill_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.hard_skills(id),
  name text NOT NULL,
  description text,
  category_id uuid,
  category_name text,
  sub_category_id uuid,
  subcategory_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.hard_skill_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2i hard_skill_question_snapshots
CREATE TABLE public.hard_skill_question_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.hard_skill_questions(id),
  question_text text NOT NULL,
  skill_id uuid,
  answer_category_id uuid,
  order_index integer,
  comment_required_override boolean,
  visibility_restriction_enabled boolean,
  visibility_restriction_type text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.hard_skill_question_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2j hard_skill_answer_option_snapshots
CREATE TABLE public.hard_skill_answer_option_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.hard_skill_answer_options(id),
  answer_category_id uuid,
  numeric_value integer NOT NULL,
  level_value integer,
  title text NOT NULL,
  description text,
  order_index integer,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.hard_skill_answer_option_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2k soft_skill_category_snapshots
CREATE TABLE public.soft_skill_category_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.category_soft_skills(id),
  name text NOT NULL,
  description text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.soft_skill_category_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2l soft_skill_subcategory_snapshots
CREATE TABLE public.soft_skill_subcategory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.sub_category_soft_skills(id),
  name text NOT NULL,
  category_id uuid,
  category_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.soft_skill_subcategory_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2m soft_skill_snapshots
CREATE TABLE public.soft_skill_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.soft_skills(id),
  name text NOT NULL,
  description text,
  category_id uuid,
  category_name text,
  sub_category_id uuid,
  subcategory_name text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.soft_skill_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2n soft_skill_question_snapshots
CREATE TABLE public.soft_skill_question_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.soft_skill_questions(id),
  question_text text NOT NULL,
  quality_id uuid,
  answer_category_id uuid,
  category text,
  order_index integer,
  behavioral_indicators text,
  comment_required_override boolean,
  visibility_restriction_enabled boolean,
  visibility_restriction_type text,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.soft_skill_question_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.2o soft_skill_answer_option_snapshots
CREATE TABLE public.soft_skill_answer_option_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostic_result_snapshots(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.soft_skill_answer_options(id),
  answer_category_id uuid,
  numeric_value integer NOT NULL,
  level_value integer,
  title text NOT NULL,
  description text,
  order_index integer,
  UNIQUE (diagnostic_id, entity_id)
);
ALTER TABLE public.soft_skill_answer_option_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.3 Jobs queue
CREATE TABLE public.diagnostic_snapshot_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.diagnostic_stages(id),
  evaluated_user_id uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX idx_snapshot_jobs_pending
  ON public.diagnostic_snapshot_jobs(stage_id, evaluated_user_id)
  WHERE status = 'pending';
ALTER TABLE public.diagnostic_snapshot_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1.4 RLS Policies
-- ============================================================

-- Helper function to check snapshot access (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.can_view_snapshot(_snapshot_evaluated_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    auth.uid() = _snapshot_evaluated_user_id
    OR public.is_users_manager(auth.uid(), _snapshot_evaluated_user_id)
    OR public.has_permission(auth.uid(), 'assessment_results.view_all')
  );
$$;

-- Header: SELECT
CREATE POLICY "Users can view own snapshots"
  ON public.diagnostic_result_snapshots FOR SELECT TO authenticated
  USING (public.can_view_snapshot(evaluated_user_id));

-- All 16 snapshot tables: SELECT via header join
-- Using a helper approach: each child checks parent access

CREATE POLICY "Select via header" ON public.diagnostic_user_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.survey_assignment_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.answer_category_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.grade_skill_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.grade_quality_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.hard_skill_category_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.hard_skill_subcategory_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.hard_skill_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.hard_skill_question_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.hard_skill_answer_option_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.soft_skill_category_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.soft_skill_subcategory_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.soft_skill_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.soft_skill_question_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

CREATE POLICY "Select via header" ON public.soft_skill_answer_option_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_result_snapshots h WHERE h.id = diagnostic_id AND public.can_view_snapshot(h.evaluated_user_id)));

-- Jobs: no direct access for business roles (only via SECURITY DEFINER)
-- Allow authenticated to INSERT (enqueue) 
CREATE POLICY "Authenticated can enqueue jobs"
  ON public.diagnostic_snapshot_jobs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Wave 2: Trigger + Orchestration Functions
-- ============================================================

-- 2.1 Enqueue trigger function
CREATE OR REPLACE FUNCTION public.enqueue_diagnostic_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.diagnostic_stage_id IS NOT NULL THEN
      INSERT INTO diagnostic_snapshot_jobs (stage_id, evaluated_user_id, reason)
      VALUES (NEW.diagnostic_stage_id, NEW.evaluated_user_id, 'assignment_completed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enqueue_snapshot_on_assignment_complete
  AFTER UPDATE ON public.survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_diagnostic_snapshot();

-- 2.2 Orchestration function
CREATE OR REPLACE FUNCTION public.create_or_refresh_diagnostic_snapshot(
  p_stage_id uuid,
  p_evaluated_user_id uuid,
  p_reason text DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lock_key bigint;
  v_user RECORD;
  v_hash text;
  v_current_hash text;
  v_snapshot_id uuid;
  v_next_version integer;
  v_grade_id uuid;
BEGIN
  -- Advisory lock
  v_lock_key := hashtext(p_stage_id::text || p_evaluated_user_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get evaluated user info
  SELECT u.id, u.last_name, u.first_name, u.middle_name, u.grade_id,
         u.position_id, u.department_id,
         g.name AS grade_name,
         p.name AS position_name,
         d.name AS department_name,
         pc.name AS position_category_name
  INTO v_user
  FROM users u
  LEFT JOIN grades g ON g.id = u.grade_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN positions pos ON pos.id = u.position_id
  LEFT JOIN position_categories pc ON pc.id = pos.position_category_id
  WHERE u.id = p_evaluated_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_evaluated_user_id;
  END IF;

  v_grade_id := v_user.grade_id;

  -- Build hash from key data points
  SELECT md5(string_agg(sub.hash_part, '|' ORDER BY sub.ord))
  INTO v_hash
  FROM (
    -- User context
    SELECT 1 AS ord, concat_ws(',', v_user.last_name, v_user.first_name, v_user.grade_name, v_user.position_name, v_user.department_name) AS hash_part
    UNION ALL
    -- Grade skills
    SELECT 2, COALESCE(string_agg(concat_ws(',', gs.id::text, gs.skill_id::text, gs.target_level::text), ';' ORDER BY gs.skill_id), '')
    FROM grade_skills gs WHERE gs.grade_id = v_grade_id
    UNION ALL
    -- Grade qualities  
    SELECT 3, COALESCE(string_agg(concat_ws(',', gq.id::text, gq.quality_id::text, gq.target_level::text), ';' ORDER BY gq.quality_id), '')
    FROM grade_qualities gq WHERE gq.grade_id = v_grade_id
    UNION ALL
    -- Assignments
    SELECT 4, COALESCE(string_agg(concat_ws(',', sa.id::text, sa.assignment_type, sa.evaluating_user_id::text, sa.status), ';' ORDER BY sa.id), '')
    FROM survey_360_assignments sa
    WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id
    UNION ALL
    -- Hard skills (via grade_skills)
    SELECT 5, COALESCE(string_agg(concat_ws(',', hs.id::text, hs.name, hs.category_id::text, hs.sub_category_id::text), ';' ORDER BY hs.id), '')
    FROM hard_skills hs
    WHERE hs.id IN (SELECT gs2.skill_id FROM grade_skills gs2 WHERE gs2.grade_id = v_grade_id)
    UNION ALL
    -- Soft skills (via grade_qualities)
    SELECT 6, COALESCE(string_agg(concat_ws(',', ss.id::text, ss.name, ss.category_id::text, ss.sub_category_id::text), ';' ORDER BY ss.id), '')
    FROM soft_skills ss
    WHERE ss.id IN (SELECT gq2.quality_id FROM grade_qualities gq2 WHERE gq2.grade_id = v_grade_id)
    UNION ALL
    -- Hard answer options
    SELECT 7, COALESCE(string_agg(concat_ws(',', hao.id::text, hao.numeric_value::text, hao.title), ';' ORDER BY hao.id), '')
    FROM hard_skill_answer_options hao
    UNION ALL
    -- Soft answer options
    SELECT 8, COALESCE(string_agg(concat_ws(',', sao.id::text, sao.numeric_value::text, sao.title), ';' ORDER BY sao.id), '')
    FROM soft_skill_answer_options sao
  ) sub;

  -- Check current hash
  SELECT data_hash INTO v_current_hash
  FROM diagnostic_result_snapshots
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id AND is_current = true;

  IF v_current_hash = v_hash THEN
    RETURN; -- No changes
  END IF;

  -- Mark old as not current
  UPDATE diagnostic_result_snapshots
  SET is_current = false
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id AND is_current = true;

  -- Get next version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM diagnostic_result_snapshots
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id;

  -- Create header
  INSERT INTO diagnostic_result_snapshots (stage_id, evaluated_user_id, version, is_current, data_hash, reason)
  VALUES (p_stage_id, p_evaluated_user_id, v_next_version, true, v_hash, p_reason)
  RETURNING id INTO v_snapshot_id;

  -- 1. diagnostic_user_snapshots: evaluated user + all evaluators
  INSERT INTO diagnostic_user_snapshots (diagnostic_id, entity_id, last_name, first_name, middle_name, grade_id, grade_name, position_name, department_name, position_category_name)
  SELECT v_snapshot_id, u.id, u.last_name, u.first_name, u.middle_name, u.grade_id,
         g.name, p.name, d.name, pc.name
  FROM users u
  LEFT JOIN grades g ON g.id = u.grade_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN position_categories pc ON pc.id = p.position_category_id
  WHERE u.id = p_evaluated_user_id
     OR u.id IN (SELECT sa.evaluating_user_id FROM survey_360_assignments sa WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 2. survey_assignment_snapshots
  INSERT INTO survey_assignment_snapshots (diagnostic_id, entity_id, evaluating_user_id, assignment_type, evaluator_last_name, evaluator_first_name, evaluator_position_category_name)
  SELECT v_snapshot_id, sa.id, sa.evaluating_user_id, sa.assignment_type,
         eu.last_name, eu.first_name, pc.name
  FROM survey_360_assignments sa
  LEFT JOIN users eu ON eu.id = sa.evaluating_user_id
  LEFT JOIN positions pos ON pos.id = eu.position_id
  LEFT JOIN position_categories pc ON pc.id = pos.position_category_id
  WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 3. answer_category_snapshots (all used categories)
  INSERT INTO answer_category_snapshots (diagnostic_id, entity_id, name, question_type, comment_required)
  SELECT DISTINCT v_snapshot_id, ac.id, ac.name, ac.question_type, ac.comment_required
  FROM answer_categories ac
  WHERE ac.id IN (
    SELECT DISTINCT hsq.answer_category_id FROM hard_skill_questions hsq WHERE hsq.answer_category_id IS NOT NULL
    UNION
    SELECT DISTINCT ssq.answer_category_id FROM soft_skill_questions ssq WHERE ssq.answer_category_id IS NOT NULL
  )
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 4. grade_skill_snapshots
  INSERT INTO grade_skill_snapshots (diagnostic_id, entity_id, skill_id, grade_id, target_level)
  SELECT v_snapshot_id, gs.id, gs.skill_id, gs.grade_id, gs.target_level
  FROM grade_skills gs WHERE gs.grade_id = v_grade_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 5. grade_quality_snapshots
  INSERT INTO grade_quality_snapshots (diagnostic_id, entity_id, quality_id, grade_id, target_level)
  SELECT v_snapshot_id, gq.id, gq.quality_id, gq.grade_id, gq.target_level
  FROM grade_qualities gq WHERE gq.grade_id = v_grade_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 6. hard_skill_category_snapshots
  INSERT INTO hard_skill_category_snapshots (diagnostic_id, entity_id, name, description)
  SELECT DISTINCT v_snapshot_id, chs.id, chs.name, chs.description
  FROM category_hard_skills chs
  WHERE chs.id IN (SELECT hs.category_id FROM hard_skills hs WHERE hs.id IN (SELECT gs3.skill_id FROM grade_skills gs3 WHERE gs3.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 7. hard_skill_subcategory_snapshots
  INSERT INTO hard_skill_subcategory_snapshots (diagnostic_id, entity_id, name, category_id, category_name)
  SELECT DISTINCT v_snapshot_id, schs.id, schs.name, schs.category_hard_skill_id, chs2.name
  FROM sub_category_hard_skills schs
  LEFT JOIN category_hard_skills chs2 ON chs2.id = schs.category_hard_skill_id
  WHERE schs.id IN (SELECT hs2.sub_category_id FROM hard_skills hs2 WHERE hs2.id IN (SELECT gs4.skill_id FROM grade_skills gs4 WHERE gs4.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 8. hard_skill_snapshots
  INSERT INTO hard_skill_snapshots (diagnostic_id, entity_id, name, description, category_id, category_name, sub_category_id, subcategory_name)
  SELECT v_snapshot_id, hs.id, hs.name, hs.description, hs.category_id, chs3.name, hs.sub_category_id, schs2.name
  FROM hard_skills hs
  LEFT JOIN category_hard_skills chs3 ON chs3.id = hs.category_id
  LEFT JOIN sub_category_hard_skills schs2 ON schs2.id = hs.sub_category_id
  WHERE hs.id IN (SELECT gs5.skill_id FROM grade_skills gs5 WHERE gs5.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 9. hard_skill_question_snapshots
  INSERT INTO hard_skill_question_snapshots (diagnostic_id, entity_id, question_text, skill_id, answer_category_id, order_index, comment_required_override, visibility_restriction_enabled, visibility_restriction_type)
  SELECT v_snapshot_id, hsq.id, hsq.question_text, hsq.skill_id, hsq.answer_category_id, hsq.order_index, hsq.comment_required_override, hsq.visibility_restriction_enabled, hsq.visibility_restriction_type
  FROM hard_skill_questions hsq
  WHERE hsq.skill_id IN (SELECT gs6.skill_id FROM grade_skills gs6 WHERE gs6.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 10. hard_skill_answer_option_snapshots (all options for relevant categories)
  INSERT INTO hard_skill_answer_option_snapshots (diagnostic_id, entity_id, answer_category_id, numeric_value, level_value, title, description, order_index)
  SELECT v_snapshot_id, hao.id, hao.answer_category_id, hao.numeric_value, hao.level_value, hao.title, hao.description, hao.order_index
  FROM hard_skill_answer_options hao
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 11. soft_skill_category_snapshots
  INSERT INTO soft_skill_category_snapshots (diagnostic_id, entity_id, name, description)
  SELECT DISTINCT v_snapshot_id, css.id, css.name, css.description
  FROM category_soft_skills css
  WHERE css.id IN (SELECT ss2.category_id FROM soft_skills ss2 WHERE ss2.id IN (SELECT gq3.quality_id FROM grade_qualities gq3 WHERE gq3.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 12. soft_skill_subcategory_snapshots
  INSERT INTO soft_skill_subcategory_snapshots (diagnostic_id, entity_id, name, category_id, category_name)
  SELECT DISTINCT v_snapshot_id, scss.id, scss.name, scss.category_soft_skill_id, css2.name
  FROM sub_category_soft_skills scss
  LEFT JOIN category_soft_skills css2 ON css2.id = scss.category_soft_skill_id
  WHERE scss.id IN (SELECT ss3.sub_category_id FROM soft_skills ss3 WHERE ss3.id IN (SELECT gq4.quality_id FROM grade_qualities gq4 WHERE gq4.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 13. soft_skill_snapshots
  INSERT INTO soft_skill_snapshots (diagnostic_id, entity_id, name, description, category_id, category_name, sub_category_id, subcategory_name)
  SELECT v_snapshot_id, ss.id, ss.name, ss.description, ss.category_id, css3.name, ss.sub_category_id, scss2.name
  FROM soft_skills ss
  LEFT JOIN category_soft_skills css3 ON css3.id = ss.category_id
  LEFT JOIN sub_category_soft_skills scss2 ON scss2.id = ss.sub_category_id
  WHERE ss.id IN (SELECT gq5.quality_id FROM grade_qualities gq5 WHERE gq5.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 14. soft_skill_question_snapshots
  INSERT INTO soft_skill_question_snapshots (diagnostic_id, entity_id, question_text, quality_id, answer_category_id, category, order_index, behavioral_indicators, comment_required_override, visibility_restriction_enabled, visibility_restriction_type)
  SELECT v_snapshot_id, ssq.id, ssq.question_text, ssq.quality_id, ssq.answer_category_id, ssq.category, ssq.order_index, ssq.behavioral_indicators, ssq.comment_required_override, ssq.visibility_restriction_enabled, ssq.visibility_restriction_type
  FROM soft_skill_questions ssq
  WHERE ssq.quality_id IN (SELECT gq6.quality_id FROM grade_qualities gq6 WHERE gq6.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 15. soft_skill_answer_option_snapshots (all options)
  INSERT INTO soft_skill_answer_option_snapshots (diagnostic_id, entity_id, answer_category_id, numeric_value, level_value, title, description, order_index)
  SELECT v_snapshot_id, sao.id, sao.answer_category_id, sao.numeric_value, sao.level_value, sao.title, sao.description, sao.order_index
  FROM soft_skill_answer_options sao
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

END;
$$;

-- 2.3 Process job function
CREATE OR REPLACE FUNCTION public.process_diagnostic_snapshot_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM diagnostic_snapshot_jobs WHERE id = p_job_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE diagnostic_snapshot_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = p_job_id;

  BEGIN
    PERFORM create_or_refresh_diagnostic_snapshot(v_job.stage_id, v_job.evaluated_user_id, v_job.reason);
    UPDATE diagnostic_snapshot_jobs SET status = 'done', processed_at = now() WHERE id = p_job_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE diagnostic_snapshot_jobs SET status = 'error', last_error = SQLERRM WHERE id = p_job_id;
  END;
END;
$$;

-- 2.4 Backfill function
CREATE OR REPLACE FUNCTION public.backfill_diagnostic_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT sa.diagnostic_stage_id, sa.evaluated_user_id
    FROM survey_360_assignments sa
    JOIN diagnostic_stages ds ON ds.id = sa.diagnostic_stage_id
    WHERE ds.is_active = false
      AND sa.diagnostic_stage_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM diagnostic_result_snapshots drs
        WHERE drs.stage_id = sa.diagnostic_stage_id
          AND drs.evaluated_user_id = sa.evaluated_user_id
          AND drs.is_current = true
      )
  LOOP
    PERFORM create_or_refresh_diagnostic_snapshot(v_rec.diagnostic_stage_id, v_rec.evaluated_user_id, 'backfill');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
