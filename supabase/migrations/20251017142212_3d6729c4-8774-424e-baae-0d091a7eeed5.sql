-- Добавляем роль admin для пользователя, если её нет
-- Сначала проверяем текущего пользователя в auth.users
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Получаем ID пользователя по email
  SELECT id INTO current_user_id
  FROM public.users
  WHERE email = 'draganova@raketa.im';
  
  -- Если пользователь найден, добавляем роль admin если её нет
  IF current_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role added/verified for user: %', current_user_id;
  ELSE
    RAISE NOTICE 'User with email draganova@raketa.im not found in users table';
  END IF;
END $$;