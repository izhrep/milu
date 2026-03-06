
-- Fix search_path on validate_template_approval
CREATE OR REPLACE FUNCTION public.validate_template_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  hard_expected int; soft_expected int;
  hard_count int; soft_count int;
  hard_min_val int; hard_max_val int;
  soft_min_val int; soft_max_val int;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.hard_skills_enabled THEN
      hard_expected := NEW.hard_scale_max - NEW.hard_scale_min + 1;
      SELECT COUNT(DISTINCT level_value), MIN(level_value), MAX(level_value)
      INTO hard_count, hard_min_val, hard_max_val
      FROM public.template_scale_labels
      WHERE template_id = NEW.id AND skill_type = 'hard';
      IF hard_count != hard_expected OR hard_min_val != NEW.hard_scale_min OR hard_max_val != NEW.hard_scale_max THEN
        RAISE EXCEPTION 'Hard labels invalid: expected % values in [%..%], got % in [%..%]',
          hard_expected, NEW.hard_scale_min, NEW.hard_scale_max,
          hard_count, COALESCE(hard_min_val, -1), COALESCE(hard_max_val, -1);
      END IF;
    END IF;
    soft_expected := NEW.soft_scale_max - NEW.soft_scale_min + 1;
    SELECT COUNT(DISTINCT level_value), MIN(level_value), MAX(level_value)
    INTO soft_count, soft_min_val, soft_max_val
    FROM public.template_scale_labels
    WHERE template_id = NEW.id AND skill_type = 'soft';
    IF soft_count != soft_expected OR soft_min_val != NEW.soft_scale_min OR soft_max_val != NEW.soft_scale_max THEN
      RAISE EXCEPTION 'Soft labels invalid: expected % values in [%..%], got % in [%..%]',
        soft_expected, NEW.soft_scale_min, NEW.soft_scale_max,
        soft_count, COALESCE(soft_min_val, -1), COALESCE(soft_max_val, -1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix search_path on update_template_updated_at
CREATE OR REPLACE FUNCTION public.update_template_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
