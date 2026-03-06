-- ====================================================================
-- ОЧИСТКА ДАННЫХ: УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ КРОМЕ АДМИНА (С ЛОГАМИ)
-- ====================================================================

-- 1. Удаляем логи аудита для всех пользователей кроме админа
DELETE FROM audit_log 
WHERE admin_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572'
   OR target_user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

-- 2. Удаляем логи активности админа
DELETE FROM admin_activity_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

-- 3. Удаляем логи отказов в доступе
DELETE FROM access_denied_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

-- 4. Очищаем диагностические этапы и этапы встреч
DELETE FROM diagnostic_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

DELETE FROM meeting_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

-- 5. Удаляем этапы без участников
DELETE FROM diagnostic_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM diagnostic_stage_participants
);

DELETE FROM meeting_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM meeting_stage_participants
);

-- 6. Удаляем всех пользователей кроме админа
DELETE FROM users 
WHERE id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';

-- 7. Проверяем результат
DO $$
DECLARE
  users_count INTEGER;
  admin_email TEXT;
  admin_role TEXT;
BEGIN
  SELECT COUNT(*), MAX(u.email), MAX(ur.role::TEXT) 
  INTO users_count, admin_email, admin_role
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id;
  
  RAISE NOTICE 'Очистка завершена. Осталось пользователей: %, Email: %, Роль: %', 
    users_count, admin_email, admin_role;
END $$;