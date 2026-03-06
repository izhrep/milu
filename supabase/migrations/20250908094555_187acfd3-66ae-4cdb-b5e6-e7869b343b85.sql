-- Fix the data insertion by handling the CASE statement properly

-- First clear any partial data
DELETE FROM public.user_skills WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
DELETE FROM public.user_qualities WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
DELETE FROM public.user_achievements WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
DELETE FROM public.user_profiles WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
DELETE FROM public.users WHERE employee_number = 'EMP001';

-- Insert sample data for testing

-- First insert sample departments, positions, skills, qualities
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
AND NOT EXISTS (SELECT 1 FROM public.positions WHERE name = 'Продавец-консультант');

INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT (name) DO NOTHING;

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
WHERE p.name = 'Продавец-консультант' AND d.name = 'Продажи';

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
WHERE u.employee_number = 'EMP001';

-- Insert achievements
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT (title) DO NOTHING;

-- Link achievements to user
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-11-15'::timestamp,
  'Внедрил новую систему выкладки'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Лидер изменений';

INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-10-20'::timestamp,
  'Завершил все обязательные курсы'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Тренинг-мастер';

-- Link skills to user
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  4,
  5,
  NOW() - INTERVAL '30 days',
  'Отличные результаты по выкладке'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Мерчендайзинг';

INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  3,
  5,
  NOW() - INTERVAL '30 days',
  'Требует изучение новых категорий'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Знание продукта';

INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  4,
  5,
  NOW() - INTERVAL '30 days',
  'Превосходные техники продаж'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Продажи';

INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  5,
  5,
  NOW() - INTERVAL '30 days',
  'Эксперт в консультировании'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Консультирование';

-- Link qualities to user  
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  5,
  5,
  NOW() - INTERVAL '60 days',
  'Отлично работает с клиентами'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Коммуникабельность';

INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  3,
  4,
  NOW() - INTERVAL '60 days',
  'Нужно развивать инициативность'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Предприимчивость';

INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  4,
  5,
  NOW() - INTERVAL '60 days',
  'Всегда выполняет обязательства'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Ответственность';