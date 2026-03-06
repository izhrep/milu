-- Insert sample data for testing

-- First insert sample departments, positions, skills, qualities
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT DO NOTHING;

INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT DO NOTHING;

INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
ON CONFLICT DO NOTHING;

INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT DO NOTHING;

INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT DO NOTHING;

-- Insert a sample user
INSERT INTO public.users (
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date
) 
SELECT 
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  p.id,
  d.id,
  '2023-01-15'
FROM public.positions p, public.departments d
WHERE p.name = 'Продавец-консультант' AND d.name = 'Продажи'
ON CONFLICT (employee_number) DO NOTHING;

-- Get the user ID for further inserts
-- Insert user profile
INSERT INTO public.user_profiles (
  user_id,
  phone,
  birth_date,
  bio,
  work_address,
  store_number
)
SELECT 
  u.id,
  '+7 (999) 123-45-67',
  '1990-05-15',
  'Опытный продавец-консультант с 2-летним стажем',
  'Ул. Красная Пресня 36 с1',
  '#00343'
FROM public.users u
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id) DO NOTHING;

-- Insert achievements
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT DO NOTHING;

-- Link achievements to user
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  CASE 
    WHEN a.title = 'Лидер изменений' THEN '2024-11-15'::timestamp
    WHEN a.title = 'Тренинг-мастер' THEN '2024-10-20'::timestamp
    WHEN a.title = 'Продавец месяца' THEN '2024-12-01'::timestamp
  END,
  CASE 
    WHEN a.title = 'Лидер изменений' THEN 'Внедрил новую систему выкладки'
    WHEN a.title = 'Тренинг-мастер' THEN 'Завершил все обязательные курсы'
    WHEN a.title = 'Продавец месяца' THEN 'Превысил план продаж на 120%'
  END
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Link skills to user
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  CASE 
    WHEN s.name = 'Мерчендайзинг' THEN 4
    WHEN s.name = 'Знание продукта' THEN 3
    WHEN s.name = 'Продажи' THEN 4
    WHEN s.name = 'Консультирование' THEN 5
  END,
  5,
  NOW() - INTERVAL '30 days',
  CASE 
    WHEN s.name = 'Мерчендайзинг' THEN 'Отличные результаты по выкладке'
    WHEN s.name = 'Знание продукта' THEN 'Требует изучение новых категорий'
    WHEN s.name = 'Продажи' THEN 'Превосходные техники продаж'
    WHEN s.name = 'Консультирование' THEN 'Эксперт в консультировании'
  END
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, skill_id) DO NOTHING;

-- Link qualities to user  
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  CASE 
    WHEN q.name = 'Коммуникабельность' THEN 5
    WHEN q.name = 'Предприимчивость' THEN 3
    WHEN q.name = 'Ответственность' THEN 4
    WHEN q.name = 'Лидерство' THEN 2
  END,
  CASE 
    WHEN q.name = 'Предприимчивость' THEN 4
    WHEN q.name = 'Лидерство' THEN 4
    ELSE NULL
  END,
  NOW() - INTERVAL '60 days',
  CASE 
    WHEN q.name = 'Коммуникабельность' THEN 'Отлично работает с клиентами'
    WHEN q.name = 'Предприимчивость' THEN 'Нужно развивать инициативность'
    WHEN q.name = 'Ответственность' THEN 'Всегда выполняет обязательства'
    WHEN q.name = 'Лидерство' THEN 'Развивается как лидер команды'
  END
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, quality_id) DO NOTHING;