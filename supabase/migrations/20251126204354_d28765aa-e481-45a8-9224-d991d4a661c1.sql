-- Удаляем вариант ответа с level_value = 4 для Hard Skills
-- Сначала удаляем все результаты, использующие этот вариант (если есть)
DELETE FROM hard_skill_results
WHERE answer_option_id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2';

-- Затем удаляем сам вариант ответа
DELETE FROM hard_skill_answer_options
WHERE id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2'
  AND level_value = 4;

-- Проверяем результат
SELECT id, title, level_value, numeric_value 
FROM hard_skill_answer_options 
WHERE answer_category_id = '00000000-0000-0000-0000-000000000001'
ORDER BY level_value;