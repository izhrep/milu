
-- ============================================================
-- FreezeConfig Surgical Fix: Replace trigger + Add scale validation
-- ============================================================

-- 1. Drop old trigger and function
DROP TRIGGER IF EXISTS freeze_config_on_stage_activation ON public.diagnostic_stages;
DROP FUNCTION IF EXISTS public.freeze_template_config_on_activation();

-- 2. New freeze trigger: BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION public.freeze_template_config_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- === INSERT path: snapshot approved template into frozen_config ===
  IF TG_OP = 'INSERT' THEN
    IF NEW.config_template_id IS NOT NULL THEN
      SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
      END IF;
      IF tpl.status != 'approved' THEN
        RAISE EXCEPTION 'Template must be approved before stage creation';
      END IF;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
        ORDER BY l.level_value
      ), '[]'::jsonb)
      INTO hard_labels
      FROM template_scale_labels l
      WHERE l.template_id = tpl.id
        AND l.skill_type = 'hard'
        AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

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
    -- If config_template_id IS NULL → legacy stage, frozen_config stays NULL
    RETURN NEW;
  END IF;

  -- === UPDATE path: immutability guards ===
  IF TG_OP = 'UPDATE' THEN
    -- Guard 1: frozen_config is immutable once set
    IF OLD.frozen_config IS NOT NULL
       AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
      RAISE EXCEPTION 'frozen_config is immutable once set';
    END IF;

    -- Guard 2: config_template_id is immutable once set
    IF OLD.config_template_id IS NOT NULL
       AND NEW.config_template_id IS DISTINCT FROM OLD.config_template_id THEN
      RAISE EXCEPTION 'config_template_id is immutable once set';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER freeze_config_on_stage_insert_or_update
  BEFORE INSERT OR UPDATE ON public.diagnostic_stages
  FOR EACH ROW EXECUTE FUNCTION public.freeze_template_config_on_insert();

-- 3. Scale validation trigger for hard_skill_results
CREATE OR REPLACE FUNCTION public.validate_hard_result_against_frozen_scale()
RETURNS trigger LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  frozen jsonb;
  effective_value int;
  scale_min int;
  scale_max int;
BEGIN
  -- 1. Skip allowed
  IF COALESCE(NEW.is_skip, false) = true THEN
    RETURN NEW;
  END IF;

  -- 2. Draft allowed
  IF COALESCE(NEW.is_draft, false) = true THEN
    RETURN NEW;
  END IF;

  -- 3. Final record must have an answer
  IF NEW.answer_option_id IS NULL AND NEW.raw_numeric_value IS NULL THEN
    RAISE EXCEPTION 'Final result (is_draft=false) must have answer_option_id or raw_numeric_value';
  END IF;

  -- 4. No stage context → no validation
  IF NEW.diagnostic_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 5. Lookup frozen_config
  SELECT ds.frozen_config INTO frozen
  FROM diagnostic_stages ds
  WHERE ds.id = NEW.diagnostic_stage_id;

  IF frozen IS NULL THEN
    RETURN NEW; -- legacy stage
  END IF;

  -- 6. Resolve effective value
  IF NEW.raw_numeric_value IS NOT NULL THEN
    effective_value := NEW.raw_numeric_value;
  ELSE
    SELECT ao.numeric_value INTO effective_value
    FROM hard_skill_answer_options ao
    WHERE ao.id = NEW.answer_option_id;
  END IF;

  IF effective_value IS NULL THEN
    RETURN NEW; -- cannot resolve, allow
  END IF;

  -- 7. Check bounds
  scale_min := (frozen->>'hard_scale_min')::int;
  scale_max := (frozen->>'hard_scale_max')::int;

  IF effective_value < scale_min OR effective_value > scale_max THEN
    RAISE EXCEPTION 'Hard skill result value % outside frozen scale [%..%]', effective_value, scale_min, scale_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_hard_result_scale
  BEFORE INSERT OR UPDATE ON public.hard_skill_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_hard_result_against_frozen_scale();

-- 4. Scale validation trigger for soft_skill_results
CREATE OR REPLACE FUNCTION public.validate_soft_result_against_frozen_scale()
RETURNS trigger LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  frozen jsonb;
  effective_value int;
  scale_min int;
  scale_max int;
BEGIN
  -- 1. Skip allowed
  IF COALESCE(NEW.is_skip, false) = true THEN
    RETURN NEW;
  END IF;

  -- 2. Draft allowed
  IF COALESCE(NEW.is_draft, false) = true THEN
    RETURN NEW;
  END IF;

  -- 3. Final record must have an answer
  IF NEW.answer_option_id IS NULL AND NEW.raw_numeric_value IS NULL THEN
    RAISE EXCEPTION 'Final result (is_draft=false) must have answer_option_id or raw_numeric_value';
  END IF;

  -- 4. No stage context → no validation
  IF NEW.diagnostic_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 5. Lookup frozen_config
  SELECT ds.frozen_config INTO frozen
  FROM diagnostic_stages ds
  WHERE ds.id = NEW.diagnostic_stage_id;

  IF frozen IS NULL THEN
    RETURN NEW; -- legacy stage
  END IF;

  -- 6. Resolve effective value
  IF NEW.raw_numeric_value IS NOT NULL THEN
    effective_value := NEW.raw_numeric_value;
  ELSE
    SELECT ao.numeric_value INTO effective_value
    FROM soft_skill_answer_options ao
    WHERE ao.id = NEW.answer_option_id;
  END IF;

  IF effective_value IS NULL THEN
    RETURN NEW; -- cannot resolve, allow
  END IF;

  -- 7. Check bounds
  scale_min := (frozen->>'soft_scale_min')::int;
  scale_max := (frozen->>'soft_scale_max')::int;

  IF effective_value < scale_min OR effective_value > scale_max THEN
    RAISE EXCEPTION 'Soft skill result value % outside frozen scale [%..%]', effective_value, scale_min, scale_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_soft_result_scale
  BEFORE INSERT OR UPDATE ON public.soft_skill_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_soft_result_against_frozen_scale();
