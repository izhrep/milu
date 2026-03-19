CREATE OR REPLACE FUNCTION public.validate_template_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.hard_skills_enabled THEN
      IF NEW.hard_scale_min < 0 OR NEW.hard_scale_max <= NEW.hard_scale_min THEN
        RAISE EXCEPTION 'Hard scale range invalid: min=%, max=%', NEW.hard_scale_min, NEW.hard_scale_max;
      END IF;
    END IF;
    IF NEW.soft_scale_min < 0 OR NEW.soft_scale_max <= NEW.soft_scale_min THEN
      RAISE EXCEPTION 'Soft scale range invalid: min=%, max=%', NEW.soft_scale_min, NEW.soft_scale_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;