-- =============================================================================
-- Wave 1+2: Diagnostic Config Templates — DDL + Triggers
-- Plan v4.1
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Templates table (split hard/soft scales)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnostic_config_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),

  hard_scale_min int NOT NULL DEFAULT 0,
  hard_scale_max int NOT NULL DEFAULT 4,
  soft_scale_min int NOT NULL DEFAULT 0,
  soft_scale_max int NOT NULL DEFAULT 5,
  hard_scale_reversed boolean NOT NULL DEFAULT false,
  soft_scale_reversed boolean NOT NULL DEFAULT false,
  hard_skills_enabled boolean NOT NULL DEFAULT true,

  comment_rules jsonb NOT NULL DEFAULT '{}',
  open_questions_config jsonb NOT NULL DEFAULT '[]',

  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_hard CHECK (hard_scale_min >= 0 AND hard_scale_max > hard_scale_min),
  CONSTRAINT chk_soft CHECK (soft_scale_min >= 0 AND soft_scale_max > soft_scale_min)
);

ALTER TABLE public.diagnostic_config_templates ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Scale labels table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_scale_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES diagnostic_config_templates(id) ON DELETE CASCADE,
  skill_type text NOT NULL CHECK (skill_type IN ('hard', 'soft')),
  level_value integer NOT NULL,
  label_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  UNIQUE (template_id, skill_type, level_value)
);

ALTER TABLE public.template_scale_labels ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1c. Extend results tables with raw_numeric_value, make answer_option_id nullable
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hard_skill_results ADD COLUMN IF NOT EXISTS raw_numeric_value int;
ALTER TABLE public.soft_skill_results ADD COLUMN IF NOT EXISTS raw_numeric_value int;
ALTER TABLE public.hard_skill_results ALTER COLUMN answer_option_id DROP NOT NULL;
ALTER TABLE public.soft_skill_results ALTER COLUMN answer_option_id DROP NOT NULL;

-- 1c-constraint: At least one score source must be present
ALTER TABLE public.hard_skill_results ADD CONSTRAINT chk_score_source
  CHECK ((answer_option_id IS NOT NULL) OR (raw_numeric_value IS NOT NULL));
ALTER TABLE public.soft_skill_results ADD CONSTRAINT chk_score_source
  CHECK ((answer_option_id IS NOT NULL) OR (raw_numeric_value IS NOT NULL));

-- 1d. Link template to stage
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.diagnostic_stages
  ADD COLUMN IF NOT EXISTS config_template_id uuid REFERENCES diagnostic_config_templates(id),
  ADD COLUMN IF NOT EXISTS frozen_config jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1e. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Templates: admin management
CREATE POLICY "Admins manage templates"
  ON public.diagnostic_config_templates FOR ALL TO authenticated
  USING (has_permission('diagnostics.manage'));

-- Templates: read approved or admin
CREATE POLICY "Read approved templates"
  ON public.diagnostic_config_templates FOR SELECT TO authenticated
  USING (status = 'approved' OR has_permission('diagnostics.manage'));

-- Scale labels: admin write
CREATE POLICY "Admins manage scale labels"
  ON public.template_scale_labels FOR ALL TO authenticated
  USING (has_permission('diagnostics.manage'));

-- Scale labels: authenticated read
CREATE POLICY "Authenticated read scale labels"
  ON public.template_scale_labels FOR SELECT TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. Approval validation trigger (range-aware)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_template_approval()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  hard_expected int;
  soft_expected int;
  hard_count int;
  soft_count int;
  hard_min_val int;
  hard_max_val int;
  soft_min_val int;
  soft_max_val int;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- Hard labels validation (if enabled)
    IF NEW.hard_skills_enabled THEN
      hard_expected := NEW.hard_scale_max - NEW.hard_scale_min + 1;

      SELECT COUNT(DISTINCT level_value), MIN(level_value), MAX(level_value)
      INTO hard_count, hard_min_val, hard_max_val
      FROM public.template_scale_labels
      WHERE template_id = NEW.id AND skill_type = 'hard';

      IF hard_count != hard_expected
         OR hard_min_val != NEW.hard_scale_min
         OR hard_max_val != NEW.hard_scale_max THEN
        RAISE EXCEPTION
          'Hard labels invalid: expected % distinct values in [%..%], got % in [%..%]',
          hard_expected, NEW.hard_scale_min, NEW.hard_scale_max,
          hard_count, COALESCE(hard_min_val, -1), COALESCE(hard_max_val, -1);
      END IF;
    END IF;

    -- Soft labels validation (always required)
    soft_expected := NEW.soft_scale_max - NEW.soft_scale_min + 1;

    SELECT COUNT(DISTINCT level_value), MIN(level_value), MAX(level_value)
    INTO soft_count, soft_min_val, soft_max_val
    FROM public.template_scale_labels
    WHERE template_id = NEW.id AND skill_type = 'soft';

    IF soft_count != soft_expected
       OR soft_min_val != NEW.soft_scale_min
       OR soft_max_val != NEW.soft_scale_max THEN
      RAISE EXCEPTION
        'Soft labels invalid: expected % distinct values in [%..%], got % in [%..%]',
        soft_expected, NEW.soft_scale_min, NEW.soft_scale_max,
        soft_count, COALESCE(soft_min_val, -1), COALESCE(soft_max_val, -1);
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_template_before_approval
  BEFORE UPDATE ON public.diagnostic_config_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_template_approval();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. Freeze trigger on stage activation (immutable, deterministic)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.freeze_template_config_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- IMMUTABILITY GUARD
  IF OLD.frozen_config IS NOT NULL
     AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
    RAISE EXCEPTION 'frozen_config is immutable once set';
  END IF;

  -- FREEZE on first activation with a template
  IF NEW.status = 'active'
     AND (OLD.status IS DISTINCT FROM 'active')
     AND NEW.config_template_id IS NOT NULL
     AND NEW.frozen_config IS NULL
  THEN
    SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
    END IF;
    IF tpl.status != 'approved' THEN
      RAISE EXCEPTION 'Template must be approved before stage activation';
    END IF;

    -- Collect hard labels sorted, filtered by range
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO hard_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'hard'
      AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

    -- Collect soft labels sorted, filtered by range
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO soft_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'soft'
      AND l.level_value BETWEEN tpl.soft_scale_min AND tpl.soft_scale_max;

    NEW.frozen_config := jsonb_build_object(
      'template_id', tpl.id,
      'template_name', tpl.name,
      'template_version', tpl.version,
      'hard_scale_min', tpl.hard_scale_min,
      'hard_scale_max', tpl.hard_scale_max,
      'soft_scale_min', tpl.soft_scale_min,
      'soft_scale_max', tpl.soft_scale_max,
      'hard_scale_reversed', tpl.hard_scale_reversed,
      'soft_scale_reversed', tpl.soft_scale_reversed,
      'hard_skills_enabled', tpl.hard_skills_enabled,
      'scale_labels', jsonb_build_object('hard', hard_labels, 'soft', soft_labels),
      'comment_rules', tpl.comment_rules,
      'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER freeze_config_on_stage_activation
  BEFORE UPDATE ON public.diagnostic_stages
  FOR EACH ROW EXECUTE FUNCTION public.freeze_template_config_on_activation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2c. Updated_at trigger for templates
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_template_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_template_updated_at
  BEFORE UPDATE ON public.diagnostic_config_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_template_updated_at();
