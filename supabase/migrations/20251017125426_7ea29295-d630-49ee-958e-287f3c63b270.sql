-- Обновляем существующие записи пользователей случайными русскими ФИО
UPDATE users
SET 
  last_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Иванов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Петрова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Сидоров'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Козлова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Смирнов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Новикова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Морозов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Волкова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Соколов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Лебедева'
    ELSE 'Васильев'
  END,
  first_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Александр'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Анна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Дмитрий'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Елена'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Михаил'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Ольга'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Сергей'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Татьяна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Владимир'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Наталья'
    ELSE 'Андрей'
  END,
  middle_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Иванович'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Петровна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Сергеевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Александровна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Дмитриевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Михайловна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Владимирович'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Николаевна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Андреевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Сергеевна'
    ELSE 'Павлович'
  END
WHERE last_name IS NULL OR first_name IS NULL OR middle_name IS NULL;