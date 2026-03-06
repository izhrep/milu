-- ============================================================================
-- REPLACE full_name WITH NAME CONCATENATION IN ALL FUNCTIONS
-- ============================================================================
-- Update all database functions to use CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
-- ============================================================================

-- ============================================================================
-- PART 1: UPDATE create_task_for_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Оценка 360',
    'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 2: UPDATE create_task_for_skill_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_skill_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Опросник профессиональных навыков',
    'Необходимо пройти опрос профессиональных навыков для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ All functions now use CONCAT with last_name, first_name, middle_name
-- ✅ No references to full_name column remain in functions
-- ============================================================================