-- Добавляем отдел
INSERT INTO public.departments (id, name, description) 
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'Отдел продаж', 'Отдел розничных продаж');

-- Добавляем категорию должности
INSERT INTO public.position_categories (id, name, description)
VALUES ('550e8400-e29b-41d4-a716-446655440002', 'Продажи', 'Категория должностей связанных с продажами');

-- Добавляем должность
INSERT INTO public.positions (id, position_category_id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Продавец-консультант');

-- Добавляем пользователя Владимир Маршаков
INSERT INTO public.users (
  id,
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date,
  competency_level
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440001',
  '2023-01-15',
  'Средний'
);

-- Добавляем профиль пользователя
INSERT INTO public.user_profiles (
  id,
  user_id,
  birth_date,
  phone,
  bio,
  work_address,
  store_number,
  emergency_contact_name,
  emergency_contact_phone
) VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);