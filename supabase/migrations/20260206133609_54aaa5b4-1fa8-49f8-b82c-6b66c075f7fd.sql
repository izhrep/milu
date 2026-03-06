
CREATE OR REPLACE FUNCTION public.get_user_display_names(p_user_ids UUID[])
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT, middle_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id, u.first_name, u.last_name, u.middle_name
  FROM public.users u
  WHERE u.id = ANY(p_user_ids);
$$;
