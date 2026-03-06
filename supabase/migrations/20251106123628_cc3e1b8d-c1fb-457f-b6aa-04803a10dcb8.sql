-- Проверим работу функции get_current_session_user
-- Обновим функцию для лучшей совместимости
CREATE OR REPLACE FUNCTION public.get_current_session_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT user_id 
  FROM admin_sessions 
  WHERE expires_at > now() 
  ORDER BY created_at DESC 
  LIMIT 1;
$$;