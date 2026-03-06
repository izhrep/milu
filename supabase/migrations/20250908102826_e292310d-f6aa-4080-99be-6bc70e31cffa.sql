-- Добавляем отдел если его нет
INSERT INTO public.departments (id, name, description) 
VALUES (gen_random_uuid(), 'Отдел продаж', 'Отдел розничных продаж')
ON CONFLICT (name) DO NOTHING;

-- Добавляем категорию должности если её нет
INSERT INTO public.position_categories (id, name, description)
VALUES (gen_random_uuid(), 'Продажи', 'Категория должностей связанных с продажами')
ON CONFLICT (name) DO NOTHING;

-- Добавляем должность если её нет
INSERT INTO public.positions (id, position_category_id, name)
SELECT gen_random_uuid(), pc.id, 'Продавец-консультант'
FROM public.position_categories pc
WHERE pc.name = 'Продажи'
ON CONFLICT (name) DO NOTHING;

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
  gen_random_uuid(),
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  (SELECT id FROM public.positions WHERE name = 'Продавец-консультант' LIMIT 1),
  (SELECT id FROM public.departments WHERE name = 'Отдел продаж' LIMIT 1),
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
  gen_random_uuid(),
  (SELECT id FROM public.users WHERE full_name = 'Владимир Маршаков' LIMIT 1),
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);