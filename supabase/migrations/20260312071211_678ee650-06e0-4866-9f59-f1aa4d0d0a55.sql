
CREATE OR REPLACE FUNCTION public.validate_johari_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
  
  IF rules IS NULL OR rules = '{}'::jsonb OR rules = 'null'::jsonb THEN
    RETURN NEW;
  END IF;

  open_pct := (rules->>'open_delta_pct')::numeric;
  bh_pct := (rules->>'blind_hidden_delta_pct')::numeric;

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
$function$;
