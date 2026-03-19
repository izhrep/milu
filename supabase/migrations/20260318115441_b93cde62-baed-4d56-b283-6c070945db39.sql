
-- Step 2: Hierarchy constraints — self-reference CHECK + cycle prevention trigger

-- Prevent user from being their own manager
ALTER TABLE public.users ADD CONSTRAINT no_self_manager 
  CHECK (manager_id IS NULL OR manager_id != id);

-- Cycle prevention trigger function
CREATE OR REPLACE FUNCTION public.prevent_manager_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_id uuid;
  hop_count int := 0;
BEGIN
  -- If manager_id is null or unchanged, skip
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.manager_id IS NOT DISTINCT FROM NEW.manager_id THEN
    RETURN NEW;
  END IF;

  -- Walk up the chain from NEW.manager_id
  current_id := NEW.manager_id;
  
  WHILE current_id IS NOT NULL AND hop_count < 10 LOOP
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Циклическая зависимость в иерархии руководителей запрещена (цикл обнаружен на глубине %)', hop_count + 1;
    END IF;
    
    SELECT manager_id INTO current_id
    FROM users
    WHERE id = current_id;
    
    hop_count := hop_count + 1;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_prevent_manager_cycle
  BEFORE INSERT OR UPDATE OF manager_id
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_manager_cycle();
