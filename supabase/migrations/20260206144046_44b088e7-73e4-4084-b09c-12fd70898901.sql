
CREATE OR REPLACE FUNCTION public.get_respondent_profiles(p_user_ids UUID[])
RETURNS TABLE(
  id UUID,
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  position_name TEXT,
  position_category_id UUID,
  position_category_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.middle_name,
    p.name AS position_name,
    pc.id AS position_category_id,
    pc.name AS position_category_name
  FROM public.users u
  LEFT JOIN public.positions p ON u.position_id = p.id
  LEFT JOIN public.position_categories pc ON p.position_category_id = pc.id
  WHERE u.id = ANY(p_user_ids);
$$;
