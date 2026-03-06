-- Добавляем роль admin для пользователя-администратора
INSERT INTO public.user_roles (user_id, role)
VALUES ('9138f9ee-ca94-4563-9016-05e5d2b496df', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;