-- Удаляем проблемную политику
DROP POLICY IF EXISTS "users_can_view_evaluated_peers" ON public.users;

-- Создаём security definer функцию для проверки оцениваемых коллег
CREATE OR REPLACE FUNCTION public.is_evaluated_peer(_evaluator_id uuid, _evaluated_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM survey_360_assignments sa
    WHERE sa.evaluating_user_id = _evaluator_id
      AND sa.evaluated_user_id = _evaluated_id
      AND sa.status IN ('approved', 'pending', 'completed')
  )
$$;

-- Создаём новую политику используя функцию
CREATE POLICY "users_can_view_evaluated_peers" ON public.users
FOR SELECT
USING (public.is_evaluated_peer(auth.uid(), id));