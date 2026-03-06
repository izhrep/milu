-- Обновим связь между auth_users и users для admin пользователя
UPDATE users 
SET auth_user_id = (
  SELECT id FROM auth_users WHERE email = users.email LIMIT 1
)
WHERE auth_user_id IS NULL AND email IN (
  SELECT email FROM auth_users
);