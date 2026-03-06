-- Добавляем пользователя Владимир Маршаков с уникальным номером
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
  'EMP010',
  'vladimir.marshakov@company.com',
  'Активный',
  (SELECT id FROM public.positions WHERE name = 'Менеджер по продажам' LIMIT 1),
  (SELECT id FROM public.departments WHERE name = 'Отдел по работе с клиентами' LIMIT 1),
  '2023-01-15',
  'Уровень 3 - Опытный'
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