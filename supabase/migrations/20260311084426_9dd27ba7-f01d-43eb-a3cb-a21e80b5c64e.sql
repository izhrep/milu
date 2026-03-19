
-- ═══════════════════════════════════════════════════════════════════════════
-- Add johari_rules JSONB column to diagnostic_config_templates
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.diagnostic_config_templates
  ADD COLUMN IF NOT EXISTS johari_rules jsonb NOT NULL DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════════════════
-- Server-side validation trigger for johari_rules
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_johari_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rules jsonb;
  open_pct numeric;
  bh_pct numeric;
  bl_enabled boolean;
  bl_threshold numeric;
  bl_down numeric;
  bl_up numeric;
BEGIN
  rules := NEW.johari_rules;
  
  -- Empty object is allowed (no johari rules configured yet)
  IF rules IS NULL OR rules = '{}'::jsonb OR rules = 'null'::jsonb THEN
    RETURN NEW;
  END IF;

  open_pct := (rules->>'open_delta_pct')::numeric;
  bh_pct := (rules->>'blind_hidden_delta_pct')::numeric;

  -- Validate: 0 <= open_delta_pct < blind_hidden_delta_pct <= 0.5
  IF open_pct IS NULL OR bh_pct IS NULL THEN
    RAISE EXCEPTION 'johari_rules: open_delta_pct and blind_hidden_delta_pct are required';
  END IF;

  IF open_pct < 0 THEN
    RAISE EXCEPTION 'johari_rules: open_delta_pct must be >= 0, got %', open_pct;
  END IF;

  IF bh_pct > 0.5 THEN
    RAISE EXCEPTION 'johari_rules: blind_hidden_delta_pct must be <= 0.5, got %', bh_pct;
  END IF;

  IF open_pct >= bh_pct THEN
    RAISE EXCEPTION 'johari_rules: open_delta_pct (%) must be < blind_hidden_delta_pct (%)', open_pct, bh_pct;
  END IF;

  -- Validate borderline rounding if enabled
  bl_enabled := COALESCE((rules->>'borderline_rounding_enabled')::boolean, false);
  IF bl_enabled THEN
    bl_threshold := (rules->>'borderline_threshold_delta')::numeric;
    bl_down := (rules->>'borderline_round_down_to')::numeric;
    bl_up := (rules->>'borderline_round_up_to')::numeric;

    IF bl_threshold IS NULL OR bl_down IS NULL OR bl_up IS NULL THEN
      RAISE EXCEPTION 'johari_rules: borderline fields required when rounding is enabled';
    END IF;

    IF NOT (bl_down < bl_threshold AND bl_threshold < bl_up) THEN
      RAISE EXCEPTION 'johari_rules: must satisfy round_down_to (%) < threshold (%) < round_up_to (%)', bl_down, bl_threshold, bl_up;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_johari_rules_trigger
  BEFORE INSERT OR UPDATE ON public.diagnostic_config_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_johari_rules();

-- ═══════════════════════════════════════════════════════════════════════════
-- Update freeze trigger to include johari_rules in frozen_config
-- ═══════════════════════════════════════════════════════════════════════════
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
      'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb),
      'johari_rules', tpl.johari_rules
    );
  END IF;

  RETURN NEW;
END;
$$;
