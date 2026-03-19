
-- Block 1: Tighten legacy/template contract on diagnostic_stages
-- Replace the freeze trigger to:
-- 1. On INSERT: reject caller-supplied frozen_config (must be NULL from caller)
-- 2. On UPDATE: block ANY change to config_template_id (not just when OLD is NOT NULL)
-- 3. Preserve existing immutability of frozen_config

CREATE OR REPLACE FUNCTION public.freeze_template_config_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- === INSERT path ===
  IF TG_OP = 'INSERT' THEN
    -- Guard: caller must NOT supply frozen_config — it is always built server-side
    IF NEW.frozen_config IS NOT NULL THEN
      RAISE EXCEPTION 'frozen_config must not be supplied on INSERT; it is built automatically from the template';
    END IF;

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

  -- === UPDATE path ===
  IF TG_OP = 'UPDATE' THEN
    -- Guard 1: frozen_config is immutable once set
    IF OLD.frozen_config IS NOT NULL
       AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
      RAISE EXCEPTION 'frozen_config is immutable once set';
    END IF;

    -- Guard 2: config_template_id is immutable ALWAYS (legacy stays legacy, template stays template)
    IF NEW.config_template_id IS DISTINCT FROM OLD.config_template_id THEN
      RAISE EXCEPTION 'config_template_id is immutable after stage creation';
    END IF;

    -- Guard 3: legacy stage cannot acquire frozen_config via UPDATE
    IF OLD.frozen_config IS NULL AND NEW.frozen_config IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot set frozen_config on a legacy stage';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
