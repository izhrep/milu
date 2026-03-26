# Migration Data Audit Report

**Дата генерации**: 2026-03-24

**Всего файлов миграций проверено**: 411

**Файлов с изменением данных**: 91

**Всего SQL-блоков с изменением данных**: 258

**Из них высокого риска**: 84

**С hardcoded UUID**: 82

**Seed/reference data**: 71


---

## Детальный отчёт по миграциям

### `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql`

#### Блок 1

- **Строки**: 4–8
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `departments`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 10–14
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 16–18
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 20–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `skills`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 27–32
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `qualities`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT DO NOTHING;
```

#### Блок 6

- **Строки**: 35–54
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 7

- **Строки**: 58–75
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 8

- **Строки**: 78–82
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `achievements`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT DO NOTHING;
```

#### Блок 9

- **Строки**: 85–101
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_achievements`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 10

- **Строки**: 104–124
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_skills`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 11

- **Строки**: 127–151
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

### `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql`

#### Блок 1

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `user_skills`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM public.user_skills WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 2

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM public.user_qualities WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 3

- **Строки**: 6–6
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `user_achievements`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM public.user_achievements WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 4

- **Строки**: 7–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM public.user_profiles WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 5

- **Строки**: 8–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `users`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM public.users WHERE employee_number = 'EMP001';
```

#### Блок 6

- **Строки**: 13–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `departments`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 7

- **Строки**: 19–23
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 8

- **Строки**: 25–27
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
AND NOT EXISTS (SELECT 1 FROM public.positions WHERE name = 'Продавец-консультант');
```

#### Блок 9

- **Строки**: 29–34
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `skills`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 10

- **Строки**: 36–41
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `qualities`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT (name) DO NOTHING;
```

#### Блок 11

- **Строки**: 44–62
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 12

- **Строки**: 65–81
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 13

- **Строки**: 84–88
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `achievements`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT (title) DO NOTHING;
```

#### Блок 14

- **Строки**: 91–98
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_achievements`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-11-15'::timestamp,
  'Внедрил новую систему выкладки'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Лидер изменений';
```

#### Блок 15

- **Строки**: 100–107
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_achievements`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-10-20'::timestamp,
  'Завершил все обязательные курсы'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Тренинг-мастер';
```

#### Блок 16

- **Строки**: 110–119
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_skills`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 17

- **Строки**: 121–130
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_skills`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 18

- **Строки**: 132–141
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_skills`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 19

- **Строки**: 143–152
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_skills`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 20

- **Строки**: 155–164
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 21

- **Строки**: 166–175
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 22

- **Строки**: 177–186
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

### `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql`

#### Блок 1

- **Строки**: 2–4
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `departments`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.departments (id, name, description) 
VALUES (gen_random_uuid(), 'Отдел продаж', 'Отдел розничных продаж')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 7–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.position_categories (id, name, description)
VALUES (gen_random_uuid(), 'Продажи', 'Категория должностей связанных с продажами')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 12–16
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (id, position_category_id, name)
SELECT gen_random_uuid(), pc.id, 'Продавец-консультант'
FROM public.position_categories pc
WHERE pc.name = 'Продажи'
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 19–39
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

#### Блок 5

- **Строки**: 42–62
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

### `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql`

#### Блок 1

- **Строки**: 2–3
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `departments`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.departments (id, name, description) 
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'Отдел продаж', 'Отдел розничных продаж');
```

#### Блок 2

- **Строки**: 6–7
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.position_categories (id, name, description)
VALUES ('550e8400-e29b-41d4-a716-446655440002', 'Продажи', 'Категория должностей связанных с продажами');
```

#### Блок 3

- **Строки**: 10–11
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.positions (id, position_category_id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Продавец-консультант');
```

#### Блок 4

- **Строки**: 14–34
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

#### Блок 5

- **Строки**: 37–57
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

### `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql`

#### Блок 1

- **Строки**: 2–22
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

#### Блок 2

- **Строки**: 25–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

### `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql`

#### Блок 1

- **Строки**: 2–22
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

#### Блок 2

- **Строки**: 25–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_profiles`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
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
```

### `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql`

#### Блок 1

- **Строки**: 2–10
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `users`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.users (id, full_name, email, employee_number, status, supervisor_id) VALUES
  ('12345678-1234-5678-9012-123456789001', 'Владимир Маршаков', 'vladimir.marshakov@company.com', 'EMP001', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789002', 'Мария Завьялова', 'maria.zavyalova@company.com', 'EMP002', 'Активный', NULL),
  ('12345678-1234-5678-9012-123456789003', 'Антон Кораблев', 'anton.korablev@company.com', 'EMP003', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789004', 'Анна Макарова', 'anna.makarova@company.com', 'EMP004', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789005', 'Вероника Жогова', 'veronika.zhogova@company.com', 'EMP005', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789006', 'Петр Сидоров', 'petr.sidorov@company.com', 'EMP006', 'Активный', '12345678-1234-5678-9012-123456789001'),
  ('12345678-1234-5678-9012-123456789007', 'Екатерина Новикова', 'ekaterina.novikova@company.com', 'EMP007', 'Активный', '12345678-1234-5678-9012-123456789001')
ON CONFLICT (id) DO NOTHING;
```

### `supabase/migrations/20250909103431_98f4e799-2579-45b7-ae05-a85a9af3552f.sql`

#### Блок 1

- **Строки**: 34–36
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `trade_points`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.trade_points (name, address, status)
VALUES ('Торговая точка Центральная', 'ул. Центральная, 1', 'Активный')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 48–51
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_trade_points`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.user_trade_points (user_id, trade_point_id)
SELECT ru.user_id, tp.id
FROM retail_users ru, trade_point tp
ON CONFLICT (user_id, trade_point_id) DO NOTHING;
```

### `supabase/migrations/20250909103451_9018ea03-bf79-488c-9668-f87f959f0e25.sql`

#### Блок 1

- **Строки**: 34–35
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `trade_points`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.trade_points (name, address, status)
VALUES ('Торговая точка Центральная', 'ул. Центральная, 1', 'Активный');
```

#### Блок 2

- **Строки**: 38–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `user_trade_points`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.user_trade_points (user_id, trade_point_id)
SELECT u.id, tp.id
FROM public.users u
JOIN public.departments d ON u.department_id = d.id
CROSS JOIN public.trade_points tp
WHERE d.name = 'Розница' 
  AND u.status = 'Активный'
  AND tp.address = 'ул. Центральная, 1';
```

### `supabase/migrations/20250909103544_4212f3f4-b583-4ab4-89be-886a56c56667.sql`

#### Блок 1

- **Строки**: 3–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.position_categories (name, description)
VALUES ('Руководящие должности', 'Категория для руководящих должностей в компании')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 8–12
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
LIMIT 1;
```

### `supabase/migrations/20250909103556_acc79f3d-a33d-4c90-906c-5e3614e06987.sql`

#### Блок 1

- **Строки**: 3–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.position_categories (name, description)
VALUES ('Руководящие должности', 'Категория для руководящих должностей в компании')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 8–12
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
LIMIT 1;
```

### `supabase/migrations/20250909103840_fac0136f-f368-44a2-a3dd-0f49cc4523bd.sql`

#### Блок 1

- **Строки**: 2–6
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `position_categories`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.position_categories (name, description)
SELECT 'Руководящие должности', 'Категория для руководящих должностей в компании'
WHERE NOT EXISTS (
  SELECT 1 FROM public.position_categories WHERE name = 'Руководящие должности'
);
```

#### Блок 2

- **Строки**: 9–16
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `positions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
  AND NOT EXISTS (
    SELECT 1 FROM public.positions WHERE name = 'Директор магазина'
  )
LIMIT 1;
```

### `supabase/migrations/20250909112242_14b24f5d-253a-4d5e-ae61-63ea8f55fdf0.sql`

#### Блок 1

- **Строки**: 7–12
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `trade_points`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.trade_points 
SET 
  address = 'Краснодар, Центральная улица, 1',
  latitude = 45.058071,
  longitude = 39.109530
WHERE address = 'ул. Центральная, 1';
```

### `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql`

#### Блок 1

- **Строки**: 80–98
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_qualities`, `SET`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid as user_id,
    sq.quality_id,
    AVG(ao.value) as current_level,
    AVG(ao.value) + 1 as target_level,
    MAX(sr.created_at) as last_assessed_at
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT (user_id, quality_id) 
DO UPDATE SET 
    current_level = EXCLUDED.current_level,
    target_level = EXCLUDED.target_level,
    last_assessed_at = EXCLUDED.last_assessed_at,
    updated_at = now();
```

### `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql`

#### Блок 1

- **Строки**: 146–169
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_assessment_results`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO user_assessment_results (
  user_id,
  assessment_type,
  assessment_period,
  assessment_date,
  quality_id,
  quality_average,
  total_responses
)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'survey_360',
  'H2_2025',
  MAX(sr.created_at),
  sq.quality_id,
  AVG(ao.value),
  COUNT(*)
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql`

#### Блок 1

- **Строки**: 146–169
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_assessment_results`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO user_assessment_results (
  user_id,
  assessment_type,
  assessment_period,
  assessment_date,
  quality_id,
  quality_average,
  total_responses
)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'survey_360',
  'H2_2025',
  MAX(sr.created_at),
  sq.quality_id,
  AVG(ao.value),
  COUNT(*)
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20250910090707_734e6f60-f42a-4af5-aba4-41a173592375.sql`

#### Блок 1

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Безусловное удаление данных

```sql
DELETE FROM survey_360_assignments;
```

### `supabase/migrations/20250910113731_77e815ab-a42d-4513-a75f-583ee5ad7cc7.sql`

#### Блок 1

- **Строки**: 22–28
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `skill_survey_answer_options`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 31–40
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `skill_survey_questions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO skill_survey_questions (skill_id, question_text, order_index) 
SELECT 
  s.id as skill_id,
  'Оцените уровень навыка "' || s.name || '"' as question_text,
  1 as order_index
FROM skills s
WHERE NOT EXISTS (
  SELECT 1 FROM skill_survey_questions ssq WHERE ssq.skill_id = s.id
)
LIMIT 5;
```

### `supabase/migrations/20250910114711_9d8eb2a2-dfea-4463-9b5c-f392ae64dcc3.sql`

#### Блок 1

- **Строки**: 40–46
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `skill_survey_answer_options`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20250910155224_a3187eb2-4f52-43e7-b297-74beeb77d74a.sql`

#### Блок 1

- **Строки**: 3–26
- **Тип операции**: `DO`
- **Целевые таблицы**: `skill_survey_assignments`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Ищем пользователя Владимир Маршаков
    SELECT id INTO user_id FROM users WHERE full_name = 'Владимир Маршаков' LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Создаем назначение на самооценку (evaluated_user_id = evaluating_user_id)
        INSERT INTO skill_survey_assignments (
            evaluated_user_id,
            evaluating_user_id,
            status
        ) VALUES (
            user_id,
            user_id,
            'отправлен запрос'
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Создано назначение на самооценку навыков для пользователя %', user_id;
    ELSE
        RAISE NOTICE 'Пользователь Владимир Маршаков не найден';
    END IF;
END $$;
```

### `supabase/migrations/20250910161756_6804f833-5b6f-4938-923b-3fd14aa58ff4.sql`

#### Блок 1

- **Строки**: 2–25
- **Тип операции**: `DO`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Ищем пользователя Владимир Маршаков
    SELECT id INTO user_id FROM users WHERE full_name = 'Владимир Маршаков' LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Создаем назначение на самооценку 360 (evaluated_user_id = evaluating_user_id)
        INSERT INTO survey_360_assignments (
            evaluated_user_id,
            evaluating_user_id,
            status
        ) VALUES (
            user_id,
            user_id,
            'отправлен запрос'
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Создано назначение на самооценку 360 для пользователя %', user_id;
    ELSE
        RAISE NOTICE 'Пользователь Владимир Маршаков не найден';
    END IF;
END $$;
```

### `supabase/migrations/20250911152420_8bcd628c-6d63-490b-a333-3ae46c04a40f.sql`

#### Блок 1

- **Строки**: 29–29
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE tasks SET task_type = 'assessment' WHERE assignment_id IS NOT NULL;
```

### `supabase/migrations/20251017125426_7ea29295-d630-49ee-958e-287f3c63b270.sql`

#### Блок 1

- **Строки**: 2–43
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `users`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
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
```

### `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql`

#### Блок 1

- **Строки**: 2–4
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_roles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('9138f9ee-ca94-4563-9016-05e5d2b496df', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### `supabase/migrations/20251017142212_3d6729c4-8774-424e-baae-0d091a7eeed5.sql`

#### Блок 1

- **Строки**: 3–22
- **Тип операции**: `DO`
- **Целевые таблицы**: `user_roles`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Получаем ID пользователя по email
  SELECT id INTO current_user_id
  FROM public.users
  WHERE email = 'draganova@raketa.im';
  
  -- Если пользователь найден, добавляем роль admin если её нет
  IF current_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role added/verified for user: %', current_user_id;
  ELSE
    RAISE NOTICE 'User with email draganova@raketa.im not found in users table';
  END IF;
END $$;
```

### `supabase/migrations/20251024164900_bf4e62fa-c64c-43e6-a1ab-8f742a13ddf4.sql`

#### Блок 1

- **Строки**: 78–92
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.permissions (name, description, resource, action) VALUES
  ('view_own_data', 'Просмотр своих данных', 'user', 'read'),
  ('view_team_data', 'Просмотр данных команды', 'team', 'read'),
  ('view_all_users', 'Просмотр всех пользователей', 'users', 'read'),
  ('manage_users', 'Управление пользователями', 'users', 'write'),
  ('manage_surveys', 'Управление опросами', 'surveys', 'write'),
  ('view_surveys', 'Просмотр опросов', 'surveys', 'read'),
  ('manage_meetings', 'Управление встречами', 'meetings', 'write'),
  ('view_meetings', 'Просмотр встреч', 'meetings', 'read'),
  ('manage_tasks', 'Управление задачами', 'tasks', 'write'),
  ('view_tasks', 'Просмотр задач', 'tasks', 'read'),
  ('manage_career_tracks', 'Управление карьерными треками', 'career', 'write'),
  ('view_career_tracks', 'Просмотр карьерных треков', 'career', 'read'),
  ('manage_system', 'Администрирование системы', 'system', 'admin')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 94–97
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks')
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 99–102
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_team_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks', 'manage_meetings', 'manage_tasks')
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 104–107
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions 
WHERE name IN ('view_all_users', 'manage_users', 'manage_surveys', 'view_surveys', 'manage_meetings', 'view_meetings', 'manage_tasks', 'view_tasks', 'manage_career_tracks', 'view_career_tracks')
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 109–111
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251024171243_b54ab4a7-8452-49e2-ad55-a3ce62d02eab.sql`

#### Блок 1

- **Строки**: 2–76
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, description, resource, action) VALUES
  -- Права на пользователей
  ('users.view', 'Просмотр пользователей', 'users', 'view'),
  ('users.create', 'Создание пользователей', 'users', 'create'),
  ('users.update', 'Редактирование пользователей', 'users', 'update'),
  ('users.delete', 'Удаление пользователей', 'users', 'delete'),
  ('users.manage_roles', 'Управление ролями пользователей', 'users', 'manage_roles'),
  
  -- Права на роли
  ('roles.view', 'Просмотр ролей', 'roles', 'view'),
  ('roles.create', 'Создание ролей', 'roles', 'create'),
  ('roles.update', 'Редактирование ролей', 'roles', 'update'),
  ('roles.delete', 'Удаление ролей', 'roles', 'delete'),
  
  -- Права на подразделения
  ('departments.view', 'Просмотр подразделений', 'departments', 'view'),
  ('departments.create', 'Создание подразделений', 'departments', 'create'),
  ('departments.update', 'Редактирование подразделений', 'departments', 'update'),
  ('departments.delete', 'Удаление подразделений', 'departments', 'delete'),
  
  -- Права на должности
  ('positions.view', 'Просмотр должностей', 'positions', 'view'),
  ('positions.create', 'Создание должностей', 'positions', 'create'),
  ('positions.update', 'Редактирование должностей', 'positions', 'update'),
  ('positions.delete', 'Удаление должностей', 'positions', 'delete'),
  
  -- Права на грейды
  ('grades.view', 'Просмотр грейдов', 'grades', 'view'),
  ('grades.create', 'Создание грейдов', 'grades', 'create'),
  ('grades.update', 'Редактирование грейдов', 'grades', 'update'),
  ('grades.delete', 'Удаление грейдов', 'grades', 'delete'),
  
  -- Права на навыки
  ('skills.view', 'Просмотр навыков', 'skills', 'view'),
  ('skills.create', 'Создание навыков', 'skills', 'create'),
  ('skills.update', 'Редактирование навыков', 'skills', 'update'),
  ('skills.delete', 'Удаление навыков', 'skills', 'delete'),
  
  -- Права на качества
  ('qualities.view', 'Просмотр качеств', 'qualities', 'view'),
  ('qualities.create', 'Создание качеств', 'qualities', 'create'),
  ('qualities.update', 'Редактирование качеств', 'qualities', 'update'),
  ('qualities.delete', 'Удаление качеств', 'qualities', 'delete'),
  
  -- Права на опросы
  ('surveys.view', 'Просмотр опросов', 'surveys', 'view'),
  ('surveys.create', 'Создание опросов', 'surveys', 'create'),
  ('surveys.assign', 'Назначение опросов', 'surveys', 'assign'),
  ('surveys.results', 'Просмотр результатов опросов', 'surveys', 'results'),
  
  -- Права на встречи
  ('meetings.view', 'Просмотр встреч', 'meetings', 'view'),
  ('meetings.create', 'Создание встреч', 'meetings', 'create'),
  ('meetings.update', 'Редактирование встреч', 'meetings', 'update'),
  ('meetings.approve', 'Утверждение встреч', 'meetings', 'approve'),
  
  -- Права на отчёты
  ('reports.view', 'Просмотр отчётов', 'reports', 'view'),
  ('reports.export', 'Экспорт отчётов', 'reports', 'export'),
  
  -- Права на настройки
  ('settings.view', 'Просмотр настроек', 'settings', 'view'),
  ('settings.update', 'Изменение настроек', 'settings', 'update'),
  
  -- Права на сессии
  ('sessions.view', 'Просмотр сессий', 'sessions', 'view'),
  ('sessions.revoke', 'Завершение сессий', 'sessions', 'revoke'),
  
  -- Права на аудит
  ('audit.view', 'Просмотр журнала аудита', 'audit', 'view'),
  
  -- Права на управление правами
  ('permissions.view', 'Просмотр прав доступа', 'permissions', 'view'),
  ('permissions.manage', 'Управление правами доступа', 'permissions', 'manage')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 79–93
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'users.view',
  'users.create', 
  'users.update',
  'departments.view',
  'positions.view',
  'surveys.view',
  'surveys.assign',
  'surveys.results',
  'reports.view',
  'reports.export'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 96–108
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'users.view',
  'surveys.view',
  'surveys.results',
  'meetings.view',
  'meetings.create',
  'meetings.update',
  'meetings.approve',
  'reports.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 111–118
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'surveys.view',
  'meetings.view',
  'meetings.create'
)
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251024171304_169ddc7f-9ec7-47e0-b30c-663d46dac7d0.sql`

#### Блок 1

- **Строки**: 2–76
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, description, resource, action) VALUES
  -- Права на пользователей
  ('users.view', 'Просмотр пользователей', 'users', 'view'),
  ('users.create', 'Создание пользователей', 'users', 'create'),
  ('users.update', 'Редактирование пользователей', 'users', 'update'),
  ('users.delete', 'Удаление пользователей', 'users', 'delete'),
  ('users.manage_roles', 'Управление ролями пользователей', 'users', 'manage_roles'),
  
  -- Права на роли
  ('roles.view', 'Просмотр ролей', 'roles', 'view'),
  ('roles.create', 'Создание ролей', 'roles', 'create'),
  ('roles.update', 'Редактирование ролей', 'roles', 'update'),
  ('roles.delete', 'Удаление ролей', 'roles', 'delete'),
  
  -- Права на подразделения
  ('departments.view', 'Просмотр подразделений', 'departments', 'view'),
  ('departments.create', 'Создание подразделений', 'departments', 'create'),
  ('departments.update', 'Редактирование подразделений', 'departments', 'update'),
  ('departments.delete', 'Удаление подразделений', 'departments', 'delete'),
  
  -- Права на должности
  ('positions.view', 'Просмотр должностей', 'positions', 'view'),
  ('positions.create', 'Создание должностей', 'positions', 'create'),
  ('positions.update', 'Редактирование должностей', 'positions', 'update'),
  ('positions.delete', 'Удаление должностей', 'positions', 'delete'),
  
  -- Права на грейды
  ('grades.view', 'Просмотр грейдов', 'grades', 'view'),
  ('grades.create', 'Создание грейдов', 'grades', 'create'),
  ('grades.update', 'Редактирование грейдов', 'grades', 'update'),
  ('grades.delete', 'Удаление грейдов', 'grades', 'delete'),
  
  -- Права на навыки
  ('skills.view', 'Просмотр навыков', 'skills', 'view'),
  ('skills.create', 'Создание навыков', 'skills', 'create'),
  ('skills.update', 'Редактирование навыков', 'skills', 'update'),
  ('skills.delete', 'Удаление навыков', 'skills', 'delete'),
  
  -- Права на качества
  ('qualities.view', 'Просмотр качеств', 'qualities', 'view'),
  ('qualities.create', 'Создание качеств', 'qualities', 'create'),
  ('qualities.update', 'Редактирование качеств', 'qualities', 'update'),
  ('qualities.delete', 'Удаление качеств', 'qualities', 'delete'),
  
  -- Права на опросы
  ('surveys.view', 'Просмотр опросов', 'surveys', 'view'),
  ('surveys.create', 'Создание опросов', 'surveys', 'create'),
  ('surveys.assign', 'Назначение опросов', 'surveys', 'assign'),
  ('surveys.results', 'Просмотр результатов опросов', 'surveys', 'results'),
  
  -- Права на встречи
  ('meetings.view', 'Просмотр встреч', 'meetings', 'view'),
  ('meetings.create', 'Создание встреч', 'meetings', 'create'),
  ('meetings.update', 'Редактирование встреч', 'meetings', 'update'),
  ('meetings.approve', 'Утверждение встреч', 'meetings', 'approve'),
  
  -- Права на отчёты
  ('reports.view', 'Просмотр отчётов', 'reports', 'view'),
  ('reports.export', 'Экспорт отчётов', 'reports', 'export'),
  
  -- Права на настройки
  ('settings.view', 'Просмотр настроек', 'settings', 'view'),
  ('settings.update', 'Изменение настроек', 'settings', 'update'),
  
  -- Права на сессии
  ('sessions.view', 'Просмотр сессий', 'sessions', 'view'),
  ('sessions.revoke', 'Завершение сессий', 'sessions', 'revoke'),
  
  -- Права на аудит
  ('audit.view', 'Просмотр журнала аудита', 'audit', 'view'),
  
  -- Права на управление правами
  ('permissions.view', 'Просмотр прав доступа', 'permissions', 'view'),
  ('permissions.manage', 'Управление правами доступа', 'permissions', 'manage')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 79–93
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'users.view',
  'users.create', 
  'users.update',
  'departments.view',
  'positions.view',
  'surveys.view',
  'surveys.assign',
  'surveys.results',
  'reports.view',
  'reports.export'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 96–108
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'users.view',
  'surveys.view',
  'surveys.results',
  'meetings.view',
  'meetings.create',
  'meetings.update',
  'meetings.approve',
  'reports.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 111–118
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'surveys.view',
  'meetings.view',
  'meetings.create'
)
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251024172033_638aa638-b4f5-4b2b-a883-e0bb0b4abc1b.sql`

#### Блок 1

- **Строки**: 7–24
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_roles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN r.name ILIKE '%admin%' THEN 'admin'::app_role
    WHEN r.name ILIKE '%hr%' OR r.name ILIKE '%бизнес-партнер%' THEN 'hr_bp'::app_role
    WHEN r.name ILIKE '%manager%' OR r.name ILIKE '%руководитель%' THEN 'manager'::app_role
    ELSE 'employee'::app_role
  END
FROM public.users u
LEFT JOIN roles r ON u.role_id = r.id
INNER JOIN auth.users au ON au.id = u.id  -- Only migrate users that exist in auth
WHERE u.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
```

### `supabase/migrations/20251024172728_8fd1328d-c399-41c7-a1a7-57d5b1f4e1d7.sql`

#### Блок 1

- **Строки**: 15–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_roles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  'employee'::app_role
FROM public.users u
WHERE u.status = true  -- Only active users
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
```

### `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql`

#### Блок 1

- **Строки**: 5–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `audit_log`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.audit_log 
WHERE target_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
   OR admin_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 2

- **Строки**: 10–11
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `user_roles`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.user_roles 
WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 3

- **Строки**: 14–14
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.tasks WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 4

- **Строки**: 15–17
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.one_on_one_meetings 
WHERE employee_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND manager_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 5

- **Строки**: 18–18
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_stage_participants`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.meeting_stage_participants WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 6

- **Строки**: 19–19
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `survey_360_results`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.survey_360_results WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 7

- **Строки**: 20–20
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.survey_360_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 8

- **Строки**: 21–21
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `survey_360_selections`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.survey_360_selections WHERE selector_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 9

- **Строки**: 22–22
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `skill_survey_results`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.skill_survey_results WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 10

- **Строки**: 23–23
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `skill_survey_assignments`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.skill_survey_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 11

- **Строки**: 24–24
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `development_plans`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.development_plans WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 12

- **Строки**: 25–25
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `survey_assignments`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.survey_assignments WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 13

- **Строки**: 28–29
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `users`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.users 
WHERE id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

### `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql`

#### Блок 1

- **Строки**: 5–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `SET`, `auth`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@example.com',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token;
```

#### Блок 2

- **Строки**: 43–58
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `users`, `SET`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.users (id, employee_number, email, last_name, first_name, status)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'ADMIN001',
  'admin@example.com',
  'User',
  'Admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET
  employee_number = EXCLUDED.employee_number,
  email = EXCLUDED.email,
  last_name = EXCLUDED.last_name,
  first_name = EXCLUDED.first_name,
  status = EXCLUDED.status;
```

#### Блок 3

- **Строки**: 61–66
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_roles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;
```

### `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql`

#### Блок 1

- **Строки**: 5–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `SET`, `auth`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@example.com',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token;
```

#### Блок 2

- **Строки**: 43–58
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `users`, `SET`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.users (id, employee_number, email, last_name, first_name, status)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'ADMIN001',
  'admin@example.com',
  'User',
  'Admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET
  employee_number = EXCLUDED.employee_number,
  email = EXCLUDED.email,
  last_name = EXCLUDED.last_name,
  first_name = EXCLUDED.first_name,
  status = EXCLUDED.status;
```

#### Блок 3

- **Строки**: 61–66
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `user_roles`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;
```

### `supabase/migrations/20251024182157_7bfc2245-d76c-4d23-9419-9259b413ee08.sql`

#### Блок 1

- **Строки**: 2–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `auth`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE auth.users 
SET confirmation_token = NULL
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

### `supabase/migrations/20251024182318_2fa89074-53c7-48e5-80ea-f78aa4784b14.sql`

#### Блок 1

- **Строки**: 2–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `auth`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE auth.users 
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND raw_app_meta_data IS NULL;
```

### `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql`

#### Блок 1

- **Строки**: 35–43
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `SET`, `auth_users`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.auth_users (id, email, password_hash)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df',
  'admin@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    updated_at = now();
```

#### Блок 2

- **Строки**: 46–48
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `users`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com';
```

### `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql`

#### Блок 1

- **Строки**: 2–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `users`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com' AND auth_user_id IS NULL;
```

### `supabase/migrations/20251024190505_56efe2c2-ec96-424e-b575-db03423c93ba.sql`

#### Блок 1

- **Строки**: 2–15
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions WHERE name IN (
  'view_all_users', 'manage_users', 'permissions.view', 'permissions.manage', 
  'view_surveys', 'manage_surveys', 'view_meetings', 'manage_meetings',
  'view_tasks', 'manage_tasks', 'view_career_tracks', 'manage_career_tracks',
  'view_own_data', 'view_team_data', 'manage_system', 'audit.view',
  'departments.view', 'departments.create', 'departments.update', 'departments.delete',
  'grades.view', 'grades.create', 'grades.update', 'grades.delete',
  'users.create', 'users.update', 'users.delete', 'users.view',
  'roles.view', 'roles.manage', 'surveys.view', 'surveys.create',
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  'reports.view', 'positions.create'
)
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 18–23
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'manage_meetings', 'view_meetings',
  'meetings.create', 'meetings.update', 'meetings.approve', 'reports.view', 'view_surveys'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 26–31
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'meetings.create', 'view_meetings',
  'surveys.view', 'view_surveys', 'view_tasks', 'view_own_data'
)
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251024190704_74a6af7d-9f87-4bb3-91c5-22281f47914e.sql`

#### Блок 1

- **Строки**: 2–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `users`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE users 
SET auth_user_id = (
  SELECT id FROM auth_users WHERE email = users.email LIMIT 1
)
WHERE auth_user_id IS NULL AND email IN (
  SELECT email FROM auth_users
);
```

### `supabase/migrations/20251029153232_cd7f39e5-7c16-45c0-b797-5e92fab66ecc.sql`

#### Блок 1

- **Строки**: 24–28
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `category_skills`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO category_skills (name)
SELECT DISTINCT category
FROM skills
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 34–37
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `skills`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE skills s
SET category_id = cs.id
FROM category_skills cs
WHERE s.category = cs.name;
```

### `supabase/migrations/20251031142614_88246b03-60df-4326-90c0-2fb8b92450dc.sql`

#### Блок 1

- **Строки**: 2–95
- **Тип операции**: `DO`
- **Целевые таблицы**: `user_assessment_results`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  -- Aggregate survey_360_results for each evaluated user
  FOR user_rec IN 
    SELECT DISTINCT evaluated_user_id
    FROM survey_360_results
  LOOP
    -- Delete existing aggregated results for this user
    DELETE FROM user_assessment_results
    WHERE user_id = user_rec.evaluated_user_id;
    
    -- Insert aggregated quality results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      quality_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.evaluated_user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.evaluated_user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      sq.quality_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.evaluated_user_id THEN ao.value ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.evaluated_user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id)
        THEN ao.value 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id) THEN ao.value ELSE NULL END),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = user_rec.evaluated_user_id
      AND sq.quality_id IS NOT NULL
    GROUP BY sq.quality_id;
  END LOOP;
  
  -- Aggregate skill_survey_results for each user
  FOR user_rec IN 
    SELECT DISTINCT user_id
    FROM skill_survey_results
  LOOP
    -- Insert aggregated skill results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      skill_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      ssq.skill_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.user_id THEN ao.step ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.user_id)
        THEN ao.step 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.user_id) THEN ao.step ELSE NULL END),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = user_rec.user_id
      AND ssq.skill_id IS NOT NULL
    GROUP BY ssq.skill_id;
  END LOOP;
END $$;
```

### `supabase/migrations/20251031192352_d0fd1e52-aa22-4f45-933b-dfc1151b22a6.sql`

#### Блок 1

- **Строки**: 2–9
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM tasks 
WHERE diagnostic_stage_id IS NULL 
  AND (
    task_type IN ('survey_360', 'assessment_360') 
    OR assignment_type = 'survey_360'
    OR title ILIKE '%Оценка 360%'
    OR category = 'Оценка 360'
  );
```

### `supabase/migrations/20251031195715_eb63bf82-d04d-4441-92e4-ef3b9493a1be.sql`

#### Блок 1

- **Строки**: 8–14
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.survey_360_assignments
SET assignment_type = CASE
  WHEN evaluated_user_id = evaluating_user_id THEN 'self'
  WHEN is_manager_participant = true THEN 'manager'
  ELSE 'peer'
END
WHERE assignment_type IS NULL;
```

### `supabase/migrations/20251101133545_1f64e97c-6d1e-400f-b991-219a67d7cc9e.sql`

#### Блок 1

- **Строки**: 55–57
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.survey_360_assignments
SET status = 'completed'
WHERE status = 'выполнено';
```

#### Блок 2

- **Строки**: 59–61
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.tasks
SET status = 'completed'
WHERE status = 'выполнено';
```

### `supabase/migrations/20251101161419_de9ef741-2189-42a4-80bf-6355f6d5907b.sql`

#### Блок 1

- **Строки**: 6–36
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, description, resource, action)
VALUES 
  -- Диагностика компетенций
  ('diagnostics.create', 'Создание этапов диагностики', 'diagnostics', 'create'),
  ('diagnostics.view', 'Просмотр этапов диагностики', 'diagnostics', 'view'),
  ('diagnostics.update', 'Редактирование этапов диагностики', 'diagnostics', 'update'),
  ('diagnostics.delete', 'Удаление этапов диагностики', 'diagnostics', 'delete'),
  ('diagnostics.manage_participants', 'Управление участниками диагностики', 'diagnostics', 'manage_participants'),
  ('diagnostics.view_results', 'Просмотр результатов диагностики', 'diagnostics', 'view_results'),
  ('diagnostics.export_results', 'Экспорт результатов диагностики', 'diagnostics', 'export_results'),
  
  -- Задачи
  ('tasks.create', 'Создание задач', 'tasks', 'create'),
  ('tasks.view', 'Просмотр задач', 'tasks', 'view'),
  ('tasks.update', 'Редактирование задач', 'tasks', 'update'),
  ('tasks.delete', 'Удаление задач', 'tasks', 'delete'),
  
  -- Карьерные треки
  ('career.create', 'Создание карьерных треков', 'career', 'create'),
  ('career.update', 'Редактирование карьерных треков', 'career', 'update'),
  ('career.delete', 'Удаление карьерных треков', 'career', 'delete'),
  
  -- Команда
  ('team.view', 'Просмотр команды', 'team', 'view'),
  ('team.manage', 'Управление командой', 'team', 'manage'),
  
  -- Развитие
  ('development.view', 'Просмотр планов развития', 'development', 'view'),
  ('development.create', 'Создание планов развития', 'development', 'create'),
  ('development.update', 'Редактирование планов развития', 'development', 'update')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 39–50
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'tasks.create', 'tasks.view', 'tasks.update', 'tasks.delete',
  'career.create', 'career.update', 'career.delete',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 3

- **Строки**: 53–63
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update',
  'reports.view', 'reports.export'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 4

- **Строки**: 66–77
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view', 'diagnostics.view_results',
  'team.view', 'team.manage',
  'meetings.create', 'meetings.view', 'meetings.update', 'meetings.approve',
  'tasks.view', 'tasks.create', 'tasks.update',
  'development.view', 'development.create', 'development.update',
  'reports.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 5

- **Строки**: 80–91
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view',
  'surveys.view',
  'tasks.view',
  'development.view',
  'career.read',
  'meetings.create', 'meetings.view', 'meetings.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

### `supabase/migrations/20251113140825_ca1a3363-737d-4a86-9864-fb8b30ee6819.sql`

#### Блок 1

- **Строки**: 91–94
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE tasks
SET category = 'assessment'
WHERE task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey')
  AND category != 'assessment';
```

#### Блок 2

- **Строки**: 97–104
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments sa
SET status = 'completed', updated_at = now()
WHERE sa.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM soft_skill_results ssr
    WHERE ssr.assignment_id = sa.id
      AND ssr.is_draft = false
  );
```

#### Блок 3

- **Строки**: 107–112
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE tasks t
SET status = 'completed', updated_at = now()
FROM survey_360_assignments sa
WHERE t.assignment_id = sa.id
  AND sa.status = 'completed'
  AND t.status != 'completed';
```

#### Блок 4

- **Строки**: 115–121
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.assignment_type = 'self'
  AND sa.diagnostic_stage_id IS NULL;
```

#### Блок 5

- **Строки**: 124–131
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp, users u
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = u.manager_id
  AND sa.assignment_type = 'manager'
  AND sa.diagnostic_stage_id IS NULL
  AND dsp.user_id = u.id;
```

#### Блок 6

- **Строки**: 134–139
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.assignment_type = 'peer'
  AND sa.diagnostic_stage_id IS NULL;
```

### `supabase/migrations/20251113143447_e4dd6f64-70f4-43ae-83bd-20946ac030cc.sql`

#### Блок 1

- **Строки**: 13–83
- **Тип операции**: `DO`
- **Целевые таблицы**: `tasks`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
  peer_assignment RECORD;
  peer_task_exists BOOLEAN;
  evaluated_user_name TEXT;
BEGIN
  -- Проходим по всем peer assignments без результатов
  FOR peer_assignment IN 
    SELECT 
      sa.id,
      sa.evaluated_user_id,
      sa.evaluating_user_id,
      sa.diagnostic_stage_id
    FROM survey_360_assignments sa
    WHERE sa.assignment_type = 'peer'
      AND sa.diagnostic_stage_id IS NOT NULL
      AND sa.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM hard_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
      AND NOT EXISTS (
        SELECT 1 FROM soft_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
  LOOP
    -- Проверяем, есть ли задача для этого assignment
    SELECT EXISTS (
      SELECT 1 FROM tasks 
      WHERE assignment_id = peer_assignment.id
    ) INTO peer_task_exists;
    
    -- Если задачи нет, создаём её
    IF NOT peer_task_exists THEN
      -- Получаем имя оцениваемого пользователя
      SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
      INTO evaluated_user_name
      FROM users
      WHERE id = peer_assignment.evaluated_user_id;
      
      -- Создаём задачу для коллеги
      INSERT INTO tasks (
        user_id,
        assignment_id,
        diagnostic_stage_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      )
      SELECT
        peer_assignment.evaluating_user_id,
        peer_assignment.id,
        peer_assignment.diagnostic_stage_id,
        'peer',
        'Оценка коллеги: ' || evaluated_user_name,
        'Необходимо пройти оценку 360 для коллеги ' || evaluated_user_name || '. Срок: ' || ds.deadline_date::text,
        'pending',
        ds.deadline_date,
        'survey_360_evaluation',
        'assessment'
      FROM diagnostic_stages ds
      WHERE ds.id = peer_assignment.diagnostic_stage_id;
      
      RAISE NOTICE 'Создана задача для peer assignment %', peer_assignment.id;
    END IF;
  END LOOP;
END $$;
```

### `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql`

#### Блок 1

- **Строки**: 61–70
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE name IN (
    'view_career_tracks', 'manage_career_tracks', 
    'view_meetings', 'manage_meetings',
    'view_surveys', 'manage_surveys',
    'view_tasks', 'manage_tasks',
    'view_all_users', 'manage_users', 'manage_system',
    'view_own_data', 'view_team_data'
  )
);
```

#### Блок 2

- **Строки**: 72–79
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `permissions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM permissions WHERE name IN (
  'view_career_tracks', 'manage_career_tracks', 
  'view_meetings', 'manage_meetings',
  'view_surveys', 'manage_surveys',
  'view_tasks', 'manage_tasks',
  'view_all_users', 'manage_users', 'manage_system',
  'view_own_data', 'view_team_data'
);
```

#### Блок 3

- **Строки**: 82–122
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Пользователи
  ('users.manage_roles', 'users', 'manage_roles', 'Управление ролями пользователей'),
  
  -- Встречи
  ('meetings.delete', 'meetings', 'delete', 'Удаление встреч'),
  ('meetings.return', 'meetings', 'return', 'Возврат встреч на доработку'),
  
  -- Опросы
  ('surveys.delete', 'surveys', 'delete', 'Удаление опросов'),
  ('surveys.update', 'surveys', 'update', 'Редактирование опросов'),
  ('surveys.manage', 'surveys', 'manage', 'Управление всеми опросами'),
  
  -- Навыки
  ('skills.create', 'skills', 'create', 'Создание навыков'),
  ('skills.update', 'skills', 'update', 'Редактирование навыков'),
  ('skills.delete', 'skills', 'delete', 'Удаление навыков'),
  ('skills.view', 'skills', 'view', 'Просмотр навыков'),
  
  -- Качества
  ('qualities.create', 'qualities', 'create', 'Создание качеств'),
  ('qualities.update', 'qualities', 'update', 'Редактирование качеств'),
  ('qualities.delete', 'qualities', 'delete', 'Удаление качеств'),
  ('qualities.view', 'qualities', 'view', 'Просмотр качеств'),
  
  -- Должности
  ('positions.update', 'positions', 'update', 'Редактирование должностей'),
  ('positions.delete', 'positions', 'delete', 'Удаление должностей'),
  
  -- Отчёты
  ('reports.create', 'reports', 'create', 'Создание отчётов'),
  ('reports.update', 'reports', 'update', 'Редактирование отчётов'),
  ('reports.delete', 'reports', 'delete', 'Удаление отчётов'),
  
  -- Развитие
  ('development.delete', 'development', 'delete', 'Удаление планов развития'),
  
  -- Задачи
  ('tasks.view_all', 'tasks', 'view_all', 'Просмотр всех задач'),
  ('tasks.view_team', 'tasks', 'view_team', 'Просмотр задач команды')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 129–129
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Безусловное удаление данных

```sql
DELETE FROM role_permissions;
```

#### Блок 5

- **Строки**: 132–133
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions;
```

#### Блок 6

- **Строки**: 136–161
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи
  'users.view', 'users.create', 'users.update',
  -- Диагностика
  'diagnostics.view', 'diagnostics.create', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.view_results', 'diagnostics.export_results', 'diagnostics.manage_participants',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update', 'development.delete',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.assign', 'surveys.results', 'surveys.manage',
  -- Карьера
  'career.update', 'career.create', 'career.delete',
  -- Отчёты
  'reports.view', 'reports.export',
  -- Подразделения
  'departments.view',
  -- Должности
  'positions.view'
);
```

#### Блок 7

- **Строки**: 164–184
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи (только просмотр)
  'users.view',
  -- Диагностика
  'diagnostics.view', 'diagnostics.view_results',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.results',
  -- Карьера
  'career.update',
  -- Отчёты
  'reports.view'
);
```

#### Блок 8

- **Строки**: 187–201
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions WHERE name IN (
  -- Диагностика
  'diagnostics.view',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update',
  -- Развитие
  'development.view',
  -- Задачи
  'tasks.view',
  -- Опросы
  'surveys.view',
  -- Карьера (просмотр)
  'career.update'
);
```

### `supabase/migrations/20251113170450_2cd48a6d-06d0-470a-8591-1387103cbf70.sql`

#### Блок 1

- **Строки**: 13–20
- **Тип операции**: `DO`
- **Целевые таблицы**: `permissions`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
BEGIN
  -- diagnostics.manage (используется в RLS, но отсутствует)
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'diagnostics.manage') THEN
    INSERT INTO permissions (name, resource, action, description)
    VALUES ('diagnostics.manage', 'diagnostics', 'manage', 'Полное управление диагностикой');
  END IF;
END $$;
```

### `supabase/migrations/20251113184003_b4988151-d84c-4aeb-a8ac-fd0d1aa1a08c.sql`

#### Блок 1

- **Строки**: 164–175
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permission_groups`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permission_groups (name, label, description, icon, display_order) VALUES
  ('users', 'Пользователи', 'Управление пользователями и профилями', '👤', 1),
  ('diagnostics', 'Диагностика', 'Управление диагностическими этапами и результатами', '📊', 2),
  ('surveys', 'Опросы', 'Управление опросами навыков и 360', '📝', 3),
  ('meetings', 'Встречи 1:1', 'Управление встречами один на один', '🤝', 4),
  ('development', 'Развитие', 'Управление планами развития и задачами', '🎯', 5),
  ('tasks', 'Задачи', 'Управление задачами', '✅', 6),
  ('team', 'Команда', 'Просмотр и управление командой', '👥', 7),
  ('analytics', 'Аналитика', 'Доступ к аналитике и отчётам', '📈', 8),
  ('security', 'Безопасность', 'Управление безопасностью и правами доступа', '🔒', 9),
  ('profile', 'Профиль', 'Управление профилями', '👨‍💼', 10)
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 177–192
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permission_group_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO permission_group_permissions (group_id, permission_id)
SELECT pg.id, p.id
FROM permissions p
CROSS JOIN permission_groups pg
WHERE 
  (pg.name = 'users' AND p.resource = 'users') OR
  (pg.name = 'diagnostics' AND p.resource = 'diagnostics') OR
  (pg.name = 'surveys' AND p.resource = 'surveys') OR
  (pg.name = 'meetings' AND p.resource = 'meetings') OR
  (pg.name = 'development' AND p.resource = 'development') OR
  (pg.name = 'tasks' AND p.resource = 'tasks') OR
  (pg.name = 'team' AND p.resource = 'team') OR
  (pg.name = 'analytics' AND p.resource = 'analytics') OR
  (pg.name = 'security' AND p.resource = 'security') OR
  (pg.name = 'profile' AND p.resource = 'profile')
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql`

#### Блок 1

- **Строки**: 12–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('skills.create', 'skills', 'create', 'Создание навыков'),
('skills.update', 'skills', 'update', 'Редактирование навыков'),
('skills.delete', 'skills', 'delete', 'Удаление навыков'),
('skills.view', 'skills', 'view', 'Просмотр навыков')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 20–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('categories.create', 'categories', 'create', 'Создание категорий навыков'),
('categories.update', 'categories', 'update', 'Редактирование категорий'),
('categories.delete', 'categories', 'delete', 'Удаление категорий'),
('categories.view', 'categories', 'view', 'Просмотр категорий')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 28–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('certifications.create', 'certifications', 'create', 'Создание сертификаций'),
('certifications.update', 'certifications', 'update', 'Редактирование сертификаций'),
('certifications.delete', 'certifications', 'delete', 'Удаление сертификаций'),
('certifications.view', 'certifications', 'view', 'Просмотр сертификаций')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 36–41
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('competency_levels.create', 'competency_levels', 'create', 'Создание уровней компетенций'),
('competency_levels.update', 'competency_levels', 'update', 'Редактирование уровней'),
('competency_levels.delete', 'competency_levels', 'delete', 'Удаление уровней'),
('competency_levels.view', 'competency_levels', 'view', 'Просмотр уровней')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 5

- **Строки**: 44–49
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('manufacturers.create', 'manufacturers', 'create', 'Создание производителей'),
('manufacturers.update', 'manufacturers', 'update', 'Редактирование производителей'),
('manufacturers.delete', 'manufacturers', 'delete', 'Удаление производителей'),
('manufacturers.view', 'manufacturers', 'view', 'Просмотр производителей')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 6

- **Строки**: 52–57
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('trade_points.create', 'trade_points', 'create', 'Создание торговых точек'),
('trade_points.update', 'trade_points', 'update', 'Редактирование торговых точек'),
('trade_points.delete', 'trade_points', 'delete', 'Удаление торговых точек'),
('trade_points.view', 'trade_points', 'view', 'Просмотр торговых точек')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 7

- **Строки**: 60–65
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('track_types.create', 'track_types', 'create', 'Создание типов треков'),
('track_types.update', 'track_types', 'update', 'Редактирование типов'),
('track_types.delete', 'track_types', 'delete', 'Удаление типов'),
('track_types.view', 'track_types', 'view', 'Просмотр типов')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 8

- **Строки**: 68–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('development_tasks.create', 'development_tasks', 'create', 'Создание задач развития'),
('development_tasks.update', 'development_tasks', 'update', 'Редактирование задач'),
('development_tasks.delete', 'development_tasks', 'delete', 'Удаление задач'),
('development_tasks.view', 'development_tasks', 'view', 'Просмотр задач')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 9

- **Строки**: 76–81
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('survey_questions.create', 'survey_questions', 'create', 'Создание вопросов опросов'),
('survey_questions.update', 'survey_questions', 'update', 'Редактирование вопросов'),
('survey_questions.delete', 'survey_questions', 'delete', 'Удаление вопросов'),
('survey_questions.view', 'survey_questions', 'view', 'Просмотр вопросов')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 10

- **Строки**: 84–88
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
('assessment_results.view_all', 'assessment_results', 'view_all', 'Просмотр всех результатов оценки'),
('assessment_results.view_team', 'assessment_results', 'view_team', 'Просмотр результатов команды'),
('assessment_results.export', 'assessment_results', 'export', 'Экспорт результатов оценки')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 11

- **Строки**: 95–102
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE resource IN (
  'skills', 'categories', 'certifications', 'competency_levels',
  'manufacturers', 'trade_points', 'track_types', 'development_tasks',
  'survey_questions', 'assessment_results'
)
ON CONFLICT DO NOTHING;
```

#### Блок 12

- **Строки**: 105–117
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'skills.view', 'skills.create', 'skills.update',
  'categories.view', 'categories.create', 'categories.update',
  'certifications.view', 'certifications.create', 'certifications.update',
  'competency_levels.view', 'competency_levels.create', 'competency_levels.update',
  'development_tasks.view', 'development_tasks.create', 'development_tasks.update',
  'survey_questions.view', 'survey_questions.create', 'survey_questions.update',
  'assessment_results.view_all', 'assessment_results.export',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 13

- **Строки**: 120–128
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'survey_questions.view', 'assessment_results.view_team',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 14

- **Строки**: 131–138
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql`

#### Блок 1

- **Строки**: 2–32
- **Тип операции**: `DO`
- **Целевые таблицы**: `user_roles`, `users`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | yes |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DO $$
DECLARE
  admin_user_id UUID := 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = admin_user_id) INTO user_exists;

  IF NOT user_exists THEN
    -- Create user record
    INSERT INTO users (id, email, first_name, last_name, employee_number, status, created_at, updated_at)
    VALUES (
      admin_user_id,
      'alena.draganova@gmail.com',
      'Алена',
      'Драганова',
      'ADMIN_' || substring(admin_user_id::text, 1, 8),
      true,
      NOW(),
      NOW()
    );
  END IF;

  -- Assign admin role (idempotent)
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Refresh effective permissions
  PERFORM refresh_user_effective_permissions(admin_user_id);
END $$;
```

### `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql`

#### Блок 1

- **Строки**: 6–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `audit_log`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM audit_log 
WHERE admin_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572'
   OR target_user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 2

- **Строки**: 11–12
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `admin_activity_logs`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM admin_activity_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 3

- **Строки**: 15–16
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `access_denied_logs`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM access_denied_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 4

- **Строки**: 19–20
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `diagnostic_stage_participants`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM diagnostic_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 5

- **Строки**: 22–23
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_stage_participants`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 6

- **Строки**: 26–30
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `diagnostic_stages`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM diagnostic_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM diagnostic_stage_participants
);
```

#### Блок 7

- **Строки**: 32–36
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_stages`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM meeting_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM meeting_stage_participants
);
```

#### Блок 8

- **Строки**: 39–40
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `users`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM users 
WHERE id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

### `supabase/migrations/20251114134632_169827a9-7fd6-4a7e-9a8d-814d30c23063.sql`

#### Блок 1

- **Строки**: 3–8
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `SET`, `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.manage', 'security', 'manage', 'Управление безопасностью и пользователями')
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description;
```

#### Блок 2

- **Строки**: 11–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 
  'admin'::app_role,
  p.id
FROM permissions p
WHERE p.name = 'security.manage'
ON CONFLICT (role, permission_id) DO NOTHING;
```

### `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql`

#### Блок 1

- **Строки**: 7–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.view_admin_panel', 'security', 'view_admin_panel', 'Доступ к административной панели')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 12–14
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_all', 'users', 'view_all', 'Просмотр всех пользователей системы')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 17–19
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_department', 'users', 'view_department', 'Просмотр пользователей своего департамента')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 22–26
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'security.view_admin_panel'
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 29–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_all'
ON CONFLICT DO NOTHING;
```

#### Блок 6

- **Строки**: 36–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_department'
ON CONFLICT DO NOTHING;
```

#### Блок 7

- **Строки**: 43–45
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM role_permissions
WHERE role IN ('manager', 'hr_bp')
  AND permission_id IN (SELECT id FROM permissions WHERE name = 'users.view');
```

### `supabase/migrations/20251114175842_4c907627-8446-4794-8785-c59096034f0c.sql`

#### Блок 1

- **Строки**: 73–75
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `companies`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO public.companies (name, description)
VALUES ('Ракета', 'Основная компания')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 78–80
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `departments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.departments
SET company_id = (SELECT id FROM public.companies WHERE name = 'Ракета' LIMIT 1)
WHERE company_id IS NULL;
```

### `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql`

#### Блок 1

- **Строки**: 102–106
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `answer_categories`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO public.answer_categories (id, name, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Оценка Hard Skills', 'Категория ответов для оценки hard skills'),
  ('00000000-0000-0000-0000-000000000002', 'Оценка Soft Skills', 'Категория ответов для оценки soft skills')
ON CONFLICT (id) DO NOTHING;
```

#### Блок 2

- **Строки**: 109–115
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_answer_options`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.hard_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000001',
  level_value = COALESCE(numeric_value, 0),
  label = COALESCE(title, ''),
  order_index = 1
WHERE answer_category_id IS NULL;
```

#### Блок 3

- **Строки**: 118–123
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_answer_options`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.soft_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000002',
  level_value = COALESCE(numeric_value, 0),
  order_index = 1
WHERE answer_category_id IS NULL;
```

#### Блок 4

- **Строки**: 126–128
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.hard_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000001'
WHERE answer_category_id IS NULL;
```

#### Блок 5

- **Строки**: 130–132
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE public.soft_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000002'
WHERE answer_category_id IS NULL;
```

### `supabase/migrations/20251119141547_9f26d3bc-f474-47a2-96e8-515213617f3e.sql`

#### Блок 1

- **Строки**: 90–113
- **Тип операции**: `DO`
- **Целевые таблицы**: `diagnostic_stages`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DO $$
DECLARE
  stage_rec RECORD;
  new_progress numeric;
  new_status text;
BEGIN
  FOR stage_rec IN SELECT id FROM diagnostic_stages WHERE is_active = true LOOP
    new_progress := calculate_diagnostic_stage_progress(stage_rec.id);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_rec.id;
  END LOOP;
END $$;
```

### `supabase/migrations/20251126095025_2991f499-6573-4192-abd2-9fc14cba4e5b.sql`

#### Блок 1

- **Строки**: 13–15
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments 
SET added_by_manager = false 
WHERE added_by_manager IS NULL;
```

### `supabase/migrations/20251126104734_8b43b49f-4fc2-4ae8-8185-72d62f0898a1.sql`

#### Блок 1

- **Строки**: 2–38
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `tasks`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  deadline,
  task_type,
  category
)
SELECT 
  dsp.user_id,
  dsp.stage_id,
  sa.id as assignment_id,
  'self' as assignment_type,
  'Выбрать оценивающих' as title,
  'Выберите коллег для проведения оценки 360. Срок: ' || ps.deadline_date::text as description,
  'pending' as status,
  ps.deadline_date,
  'peer_selection' as task_type,
  'assessment' as category
FROM public.diagnostic_stage_participants dsp
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
JOIN public.parent_stages ps ON ps.id = ds.parent_id
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id 
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
)
AND ds.is_active = true;
```

### `supabase/migrations/20251126111310_14eac296-3c4a-4150-815d-e519dd20e908.sql`

#### Блок 1

- **Строки**: 12–47
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `tasks`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO public.tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  deadline,
  task_type,
  category
)
SELECT
  dsp.user_id,
  dsp.stage_id,
  sa.id,
  'self',
  'Выбрать оценивающих',
  'Выберите коллег для проведения оценки 360. Срок: ' || COALESCE(ps.deadline_date::text, 'не указан'),
  'pending',
  ps.deadline_date,
  'peer_selection',
  'assessment'
FROM public.diagnostic_stage_participants dsp
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
LEFT JOIN public.parent_stages ps ON ps.id = ds.parent_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
);
```

### `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql`

#### Блок 1

- **Строки**: 3–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `hard_skill_results`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM hard_skill_results
WHERE answer_option_id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2';
```

#### Блок 2

- **Строки**: 7–9
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `hard_skill_answer_options`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM hard_skill_answer_options
WHERE id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2'
  AND level_value = 4;
```

### `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql`

#### Блок 1

- **Строки**: 62–63
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM public.tasks 
WHERE id = '75494d0f-37e3-452d-98cf-6e31b23561f7';
```

### `supabase/migrations/20251203224143_5449843a-2499-4bb3-98f6-0161dd10bd97.sql`

#### Блок 1

- **Строки**: 5–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE soft_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);
```

#### Блок 2

- **Строки**: 19–24
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE hard_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);
```

### `supabase/migrations/20251208081020_cb14a461-81aa-4cd7-81fd-2a6e44f067d5.sql`

#### Блок 1

- **Строки**: 2–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.tasks 
SET title = 'Выбрать респондентов'
WHERE task_type = 'peer_selection' AND title = 'Выбрать оценивающих';
```

### `supabase/migrations/20251208132404_47d3e270-e4f0-4c5d-b291-ce0aac87fb09.sql`

#### Блок 1

- **Строки**: 2–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.tasks 
SET description = 'Выберите респондентов для прохождения формы "Обратная связь 360"'
WHERE task_type = 'peer_selection' 
AND description LIKE '%Выберите коллег для проведения оценки 360%';
```

#### Блок 2

- **Строки**: 8–12
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE public.tasks
SET title = 'Начать опрос "Обратная связь 360" по себе'
WHERE task_type = 'diagnostic_stage'
AND assignment_type = 'self'
AND title = 'Пройти самооценку';
```

### `supabase/migrations/20251209115723_4022d2c6-16d1-4d63-96c9-b5620e86cea8.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `user_skills`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE user_skills SET target_level = 4 WHERE target_level > 4;
```

### `supabase/migrations/20251209115905_d2f8f98e-ca82-4e8b-b333-b6d9169a1495.sql`

#### Блок 1

- **Строки**: 3–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE hard_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;
```

#### Блок 2

- **Строки**: 8–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE soft_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;
```

### `supabase/migrations/20251209121101_90891b91-8f3c-443b-9f2b-7ca66a553766.sql`

#### Блок 1

- **Строки**: 59–69
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `user_qualities`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE user_qualities
SET target_level = subq.grade_target,
    updated_at = now()
FROM (
  SELECT uq.id as uq_id, gq.target_level as grade_target
  FROM user_qualities uq
  JOIN users u ON u.id = uq.user_id
  JOIN grade_qualities gq ON gq.grade_id = u.grade_id AND gq.quality_id = uq.quality_id
  WHERE gq.target_level IS NOT NULL
) subq
WHERE user_qualities.id = subq.uq_id;
```

### `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql`

#### Блок 1

- **Строки**: 20–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'self',
  'approved'
)
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 37–52
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  is_manager_participant,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'manager',
  true,
  'approved'
)
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql`

#### Блок 1

- **Строки**: 8–32
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `tasks`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'fb6846f5-54df-4e1a-a4f6-435a9848f454',
  'self',
  'Пройти самооценку',
  'Необходимо пройти комплексную оценку компетенций (самооценка)',
  'expired',  -- Stage has ended, so mark as expired
  'diagnostic_stage',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = 'fb6846f5-54df-4e1a-a4f6-435a9848f454'
);
```

#### Блок 2

- **Строки**: 35–59
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `tasks`
- **Описание**: Вставка данных из существующих таблиц

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  '0b17db1b-93c5-4dc4-919f-2b91a9de73da',
  'manager',
  'Оценка подчинённого: Юрасова',
  'Необходимо пройти оценку 360 для Юрасова',
  'expired',  -- Stage has ended, so mark as expired
  'survey_360_evaluation',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = '0b17db1b-93c5-4dc4-919f-2b91a9de73da'
);
```

#### Блок 3

- **Строки**: 62–65
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE survey_360_assignments
SET status = 'expired', status_at_stage_end = 'approved'
WHERE id IN ('fb6846f5-54df-4e1a-a4f6-435a9848f454', '0b17db1b-93c5-4dc4-919f-2b91a9de73da')
  AND status = 'approved';
```

### `supabase/migrations/20260128124303_d97e92c0-2dd6-45a4-ae43-e39764c02531.sql`

#### Блок 1

- **Строки**: 117–122
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `diagnostic_stages`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE diagnostic_stages ds
SET is_active = false, updated_at = now()
FROM parent_stages ps
WHERE ds.parent_id = ps.id 
  AND ps.is_active = false 
  AND ds.is_active = true;
```

### `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql`

#### Блок 1

- **Строки**: 6–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'security.manage_users', 'security', 'manage_users', 
        'Полное управление пользователями системы')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 12–15
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.manage', 'development', 'manage', 
        'Полное управление планами развития')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 18–21
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.view_all', 'development', 'view_all', 
        'Просмотр всех планов развития')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 24–27
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.view_all', 'meetings', 'view_all', 
        'Просмотр всех встреч 1:1')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 5

- **Строки**: 30–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.manage', 'meetings', 'manage', 
        'Полное управление встречами 1:1')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 6

- **Строки**: 40–50
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', p.id FROM permissions p 
WHERE p.name IN (
  'security.manage_users',
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 7

- **Строки**: 53–64
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', p.id FROM permissions p 
WHERE p.name IN (
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage',
  'users.view',
  'security.view_admin_panel'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 8

- **Строки**: 67–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', p.id FROM permissions p 
WHERE p.name IN (
  'diagnostics.export_results',
  'development.view_all'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 9

- **Строки**: 76–81
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT role_name::app_role, p.id 
FROM permissions p, 
     unnest(ARRAY['hr_bp', 'manager', 'employee']) as role_name
WHERE p.name = 'grades.view'
ON CONFLICT (role, permission_id) DO NOTHING;
```

### `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_status_current`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_status_current WHERE meeting_id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
```

### `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_status_current`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_status_current WHERE meeting_id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
```

#### Блок 2

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
```

#### Блок 3

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';
```

### `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_decisions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_decisions WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 2

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_private_notes`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_private_notes WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 3

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_status_current`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_status_current WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 4

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 5

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';
```

### `supabase/migrations/20260220121928_6ce31c94-7c55-4eca-b724-fa316e83da14.sql`

#### Блок 1

- **Строки**: 49–50
- **Тип операции**: `INSERT`
- **Целевые таблицы**: `storage`
- **Описание**: Вставка данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-artifacts', 'meeting-artifacts', false);
```

### `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_status_current`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_status_current WHERE meeting_id = '15f16559-c295-47a9-9877-c30ab956886d';
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE id = '15f16559-c295-47a9-9877-c30ab956886d';
```

### `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM tasks WHERE id = 'de7327f3-0e0a-4a5c-b6a3-210374eca07c';
```

### `supabase/migrations/20260226100739_2757541c-9eac-4d57-bde9-ec883f28b62f.sql`

#### Блок 1

- **Строки**: 2–6
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name = 'meetings.manage'
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_artifacts`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_artifacts WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_decisions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_decisions WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 3

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_private_notes`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_private_notes WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 4

- **Строки**: 6–6
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_status_current`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_status_current WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 5

- **Строки**: 7–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE employee_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
```

#### Блок 6

- **Строки**: 8–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM tasks WHERE user_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
```

### `supabase/migrations/20260306084811_cf24a8a7-def4-44fb-978b-28c8a03670d3.sql`

#### Блок 1

- **Строки**: 13–16
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE hard_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 2

- **Строки**: 27–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE soft_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 3

- **Строки**: 39–40
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `hard_skill_answer_options`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM hard_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 4

- **Строки**: 49–50
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `soft_skill_answer_options`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM soft_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 5

- **Строки**: 59–60
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `answer_categories`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM answer_categories
WHERE id IN (SELECT delete_id FROM dups);
```

### `supabase/migrations/20260312092210_125aa66b-1642-451f-afce-9d19f63dfdcf.sql`

#### Блок 1

- **Строки**: 3–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `storage`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | yes |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;
```

### `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql`

#### Блок 1

- **Строки**: 3–7
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `tasks`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
UPDATE tasks 
SET status = 'pending', updated_at = now()
WHERE id = '1f0bfe3f-8e6a-4578-be45-fe1337314a4b'
  AND task_type = 'peer_selection'
  AND status = 'completed';
```

### `supabase/migrations/20260316133648_b124982e-9a31-493d-87c1-30546edaa1f0.sql`

#### Блок 1

- **Строки**: 2–7
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE soft_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM soft_skill_answer_options WHERE id = soft_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;
```

#### Блок 2

- **Строки**: 10–15
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_results`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE hard_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM hard_skill_answer_options WHERE id = hard_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;
```

### `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql`

#### Блок 1

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `meeting_decisions`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM meeting_decisions WHERE meeting_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

#### Блок 2

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `tasks`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM tasks WHERE assignment_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

#### Блок 3

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `one_on_one_meetings`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DELETE FROM one_on_one_meetings WHERE id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

### `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql`

#### Блок 1

- **Строки**: 4–26
- **Тип операции**: `DO`
- **Целевые таблицы**: `meeting_private_notes`, `meeting_reschedules`, `meeting_manager_fields`, `meeting_artifacts`, `meeting_decisions`, `one_on_one_meetings`
- **Описание**: Анонимный блок с изменением данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | yes |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | yes |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Содержит hardcoded UUID — не будет работать в другом окружении

```sql
DO $$
DECLARE
  _meeting_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _meeting_ids
  FROM one_on_one_meetings
  WHERE employee_id = '7c04b872-6de2-418d-b959-616894d398d7'
     OR manager_id = '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef';

  IF _meeting_ids IS NULL THEN
    RAISE NOTICE 'No meetings found, nothing to delete';
    RETURN;
  END IF;

  DELETE FROM meeting_reschedules   WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_decisions      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_artifacts      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_private_notes  WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_manager_fields WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM one_on_one_meetings    WHERE id = ANY(_meeting_ids);

  RAISE NOTICE 'Deleted % meetings and related data', array_length(_meeting_ids, 1);
END $$;
```

### `supabase/migrations/20260323162734_3e36246c-96a5-47d3-bce6-8531b302d20e.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO permissions (name, description, resource, action)
VALUES ('system.admin', 'Full system administrator access including diagnostic snapshots', 'system', 'admin')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 5–7
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `role_permissions`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name = 'system.admin'
ON CONFLICT DO NOTHING;
```

### `ADD_COLUMN_SQL.sql`

#### Блок 1

- **Строки**: 17–19
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `survey_360_assignments`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE survey_360_assignments 
SET added_by_manager = false 
WHERE added_by_manager IS NULL;
```

### `DEV_DATAFIX_answer_categories_merge.sql`

#### Блок 1

- **Строки**: 27–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `hard_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE hard_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 2

- **Строки**: 41–44
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: `soft_skill_questions`
- **Описание**: Обновление существующих данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
UPDATE soft_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 3

- **Строки**: 53–54
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `hard_skill_answer_options`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM hard_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 4

- **Строки**: 63–64
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `soft_skill_answer_options`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM soft_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 5

- **Строки**: 73–74
- **Тип операции**: `DELETE`
- **Целевые таблицы**: `answer_categories`
- **Описание**: Удаление данных

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | yes |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | yes |

**Risk note**: Зависит от существующих данных — результат зависит от состояния БД

```sql
DELETE FROM answer_categories
WHERE id IN (SELECT delete_id FROM dups);
```

### `SYNC_MIGRATIONS_2026.sql`

#### Блок 1

- **Строки**: 345–356
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: `supabase_migrations`
- **Описание**: Вставка или обновление данных (upsert)

**Flags**:
| Flag | Value |
|------|-------|
| touches_uid_or_uuid | no |
| touches_foreign_keys | no |
| hardcoded_ids_or_uuids | no |
| environment_specific_values | no |
| depends_on_existing_data | no |

**Risk note**: Стандартная миграция данных

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
  ('20260116113854', 'stage_finalization_v2', '{}'),
  ('20260116164200', 'trigger_reminder_date', '{}'),
  ('20260116173336', 'meetings_snapshot', '{}'),
  ('20260122034859', 'task_status_expired', '{}'),
  ('20260126105911', 'assignment_unique_constraint', '{}'),
  ('20260126110423', 'participant_trigger', '{}'),
  ('20260128124302', 'finalize_cascade', '{}'),
  ('20260129083403', 'pg_cron', '{}'),
  ('20260129144700', 'finalize_param_rename', '{}')
ON CONFLICT (version) DO NOTHING;
```

---

## Сводка: SQL высокого риска

- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 2–3): **INSERT** на `departments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 6–7): **INSERT** на `position_categories` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 10–11): **INSERT** на `positions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 14–34): **INSERT** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 37–57): **INSERT** на `user_profiles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 2–22): **INSERT** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 25–45): **INSERT** на `user_profiles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 2–22): **INSERT** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 25–45): **INSERT** на `user_profiles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` (строки 2–10): **UPSERT** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql` (строки 80–98): **UPSERT** на `user_qualities, SET` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql` (строки 146–169): **UPSERT** на `user_assessment_results` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql` (строки 146–169): **UPSERT** на `user_assessment_results` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20250910090707_734e6f60-f42a-4af5-aba4-41a173592375.sql` (строки 2–2): **DELETE** на `survey_360_assignments` — Безусловное удаление данных
- `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql` (строки 2–4): **UPSERT** на `user_roles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 5–7): **DELETE** на `audit_log` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 10–11): **DELETE** на `user_roles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 14–14): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 15–17): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 18–18): **DELETE** на `meeting_stage_participants` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 19–19): **DELETE** на `survey_360_results` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 20–20): **DELETE** на `survey_360_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 21–21): **DELETE** на `survey_360_selections` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 22–22): **DELETE** на `skill_survey_results` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 23–23): **DELETE** на `skill_survey_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 24–24): **DELETE** на `development_plans` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 25–25): **DELETE** на `survey_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 28–29): **DELETE** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 5–40): **UPSERT** на `SET, auth` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 43–58): **UPSERT** на `users, SET` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 61–66): **UPSERT** на `user_roles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 5–40): **UPSERT** на `SET, auth` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 43–58): **UPSERT** на `users, SET` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 61–66): **UPSERT** на `user_roles` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024182157_7bfc2245-d76c-4d23-9419-9259b413ee08.sql` (строки 2–4): **UPDATE** на `auth` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024182318_2fa89074-53c7-48e5-80ea-f78aa4784b14.sql` (строки 2–5): **UPDATE** на `auth` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` (строки 35–43): **UPSERT** на `SET, auth_users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` (строки 46–48): **UPDATE** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql` (строки 2–4): **UPDATE** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql` (строки 129–129): **DELETE** на `role_permissions` — Безусловное удаление данных
- `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql` (строки 2–32): **DO** на `user_roles, users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 6–8): **DELETE** на `audit_log` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 11–12): **DELETE** на `admin_activity_logs` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 15–16): **DELETE** на `access_denied_logs` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 19–20): **DELETE** на `diagnostic_stage_participants` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 22–23): **DELETE** на `meeting_stage_participants` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 39–40): **DELETE** на `users` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 102–106): **UPSERT** на `answer_categories` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 109–115): **UPDATE** на `hard_skill_answer_options` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 118–123): **UPDATE** на `soft_skill_answer_options` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 126–128): **UPDATE** на `hard_skill_questions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 130–132): **UPDATE** на `soft_skill_questions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` (строки 3–4): **DELETE** на `hard_skill_results` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` (строки 7–9): **DELETE** на `hard_skill_answer_options` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql` (строки 62–63): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 20–33): **UPSERT** на `survey_360_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 37–52): **UPSERT** на `survey_360_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 8–32): **INSERT** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 35–59): **INSERT** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 62–65): **UPDATE** на `survey_360_assignments` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` (строки 3–3): **DELETE** на `meeting_status_current` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` (строки 4–4): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 1–1): **DELETE** на `meeting_status_current` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 2–2): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 3–3): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 1–1): **DELETE** на `meeting_decisions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 2–2): **DELETE** на `meeting_private_notes` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 3–3): **DELETE** на `meeting_status_current` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 4–4): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 5–5): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` (строки 3–3): **DELETE** на `meeting_status_current` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` (строки 4–4): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql` (строки 1–1): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 3–3): **DELETE** на `meeting_artifacts` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 4–4): **DELETE** на `meeting_decisions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 5–5): **DELETE** на `meeting_private_notes` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 6–6): **DELETE** на `meeting_status_current` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 7–7): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 8–8): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql` (строки 3–7): **UPDATE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 2–2): **DELETE** на `meeting_decisions` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 3–3): **DELETE** на `tasks` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 4–4): **DELETE** на `one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении
- `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql` (строки 4–26): **DO** на `meeting_private_notes, meeting_reschedules, meeting_manager_fields, meeting_artifacts, meeting_decisions, one_on_one_meetings` — Содержит hardcoded UUID — не будет работать в другом окружении

## Сводка: Миграции с hardcoded UUID/UID/ID

- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 2–3): UUID: 550e8400-e29b-41d4-a716-446655440001
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 6–7): UUID: 550e8400-e29b-41d4-a716-446655440002
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 10–11): UUID: 550e8400-e29b-41d4-a716-446655440003, 550e8400-e29b-41d4-a716-446655440002
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 14–34): UUID: 550e8400-e29b-41d4-a716-446655440001, 550e8400-e29b-41d4-a716-446655440003, 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 37–57): UUID: 550e8400-e29b-41d4-a716-446655440004, 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 2–22): UUID: 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 25–45): UUID: 550e8400-e29b-41d4-a716-446655440004, 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 2–22): UUID: 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 25–45): UUID: 550e8400-e29b-41d4-a716-446655440004, 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` (строки 2–10): UUID: 12345678-1234-5678-9012-123456789005, 12345678-1234-5678-9012-123456789004, 12345678-1234-5678-9012-123456789003, 12345678-1234-5678-9012-123456789007, 12345678-1234-5678-9012-123456789001, 12345678-1234-5678-9012-123456789006, 12345678-1234-5678-9012-123456789002
- `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql` (строки 80–98): UUID: 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql` (строки 146–169): UUID: 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql` (строки 146–169): UUID: 550e8400-e29b-41d4-a716-446655440000
- `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql` (строки 2–4): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 5–7): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 10–11): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 14–14): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 15–17): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 18–18): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 19–19): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 20–20): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 21–21): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 22–22): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 23–23): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 24–24): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 25–25): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` (строки 28–29): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 5–40): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df, 00000000-0000-0000-0000-000000000000
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 43–58): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 61–66): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 5–40): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df, 00000000-0000-0000-0000-000000000000
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 43–58): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 61–66): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024182157_7bfc2245-d76c-4d23-9419-9259b413ee08.sql` (строки 2–4): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024182318_2fa89074-53c7-48e5-80ea-f78aa4784b14.sql` (строки 2–5): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` (строки 35–43): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` (строки 46–48): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql` (строки 2–4): UUID: 9138f9ee-ca94-4563-9016-05e5d2b496df
- `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql` (строки 2–32): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 6–8): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 11–12): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 15–16): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 19–20): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 22–23): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` (строки 39–40): UUID: e033ec4d-0155-44c9-8aaf-b4a79adbc572
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 102–106): UUID: 00000000-0000-0000-0000-000000000001, 00000000-0000-0000-0000-000000000002
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 109–115): UUID: 00000000-0000-0000-0000-000000000001
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 118–123): UUID: 00000000-0000-0000-0000-000000000002
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 126–128): UUID: 00000000-0000-0000-0000-000000000001
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 130–132): UUID: 00000000-0000-0000-0000-000000000002
- `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` (строки 3–4): UUID: a4a0bd3e-1d8c-4d91-b344-81b6b501aea2
- `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` (строки 7–9): UUID: a4a0bd3e-1d8c-4d91-b344-81b6b501aea2
- `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql` (строки 62–63): UUID: 75494d0f-37e3-452d-98cf-6e31b23561f7
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 20–33): UUID: 7c04b872-6de2-418d-b959-616894d398d7, 2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 37–52): UUID: 7c04b872-6de2-418d-b959-616894d398d7, 4cf40061-4c6f-4379-8082-5bb2ddd8a5ef, 2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 8–32): UUID: fb6846f5-54df-4e1a-a4f6-435a9848f454, 7c04b872-6de2-418d-b959-616894d398d7, 2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 35–59): UUID: 4cf40061-4c6f-4379-8082-5bb2ddd8a5ef, 2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36, 0b17db1b-93c5-4dc4-919f-2b91a9de73da
- `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` (строки 62–65): UUID: fb6846f5-54df-4e1a-a4f6-435a9848f454, 0b17db1b-93c5-4dc4-919f-2b91a9de73da
- `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` (строки 3–3): UUID: addeb7ac-a109-429c-a3d0-57fd5a8700ea
- `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` (строки 4–4): UUID: addeb7ac-a109-429c-a3d0-57fd5a8700ea
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 1–1): UUID: 9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 2–2): UUID: 9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204
- `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` (строки 3–3): UUID: 7c04b872-6de2-418d-b959-616894d398d7
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 1–1): UUID: 02c574af-fe19-4c56-811b-1fb80ba719f9
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 2–2): UUID: 02c574af-fe19-4c56-811b-1fb80ba719f9
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 3–3): UUID: 02c574af-fe19-4c56-811b-1fb80ba719f9
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 4–4): UUID: 02c574af-fe19-4c56-811b-1fb80ba719f9
- `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` (строки 5–5): UUID: 7c04b872-6de2-418d-b959-616894d398d7
- `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` (строки 3–3): UUID: 15f16559-c295-47a9-9877-c30ab956886d
- `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` (строки 4–4): UUID: 15f16559-c295-47a9-9877-c30ab956886d
- `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql` (строки 1–1): UUID: de7327f3-0e0a-4a5c-b6a3-210374eca07c
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 3–3): UUID: 70b5ab84-e1d8-4339-a2e2-d20124509d5c, 8d2b400c-bcc3-4fc0-888a-eafa326e407b
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 4–4): UUID: 70b5ab84-e1d8-4339-a2e2-d20124509d5c, 8d2b400c-bcc3-4fc0-888a-eafa326e407b
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 5–5): UUID: 70b5ab84-e1d8-4339-a2e2-d20124509d5c, 8d2b400c-bcc3-4fc0-888a-eafa326e407b
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 6–6): UUID: 70b5ab84-e1d8-4339-a2e2-d20124509d5c, 8d2b400c-bcc3-4fc0-888a-eafa326e407b
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 7–7): UUID: 695aa5cc-c402-43a0-bdea-1ca505a34392
- `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` (строки 8–8): UUID: 695aa5cc-c402-43a0-bdea-1ca505a34392
- `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql` (строки 3–7): UUID: 1f0bfe3f-8e6a-4578-be45-fe1337314a4b
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 2–2): UUID: 2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92, f2c27675-6a98-4918-bd9c-ad3d1af1d84b
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 3–3): UUID: 2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92, f2c27675-6a98-4918-bd9c-ad3d1af1d84b
- `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` (строки 4–4): UUID: 2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92, f2c27675-6a98-4918-bd9c-ad3d1af1d84b
- `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql` (строки 4–26): UUID: 7c04b872-6de2-418d-b959-616894d398d7, 4cf40061-4c6f-4379-8082-5bb2ddd8a5ef

## Сводка: Seed / Reference Data

- `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` (строки 4–8): **UPSERT** в `departments` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` (строки 10–14): **UPSERT** в `position_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` (строки 20–25): **UPSERT** в `skills` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` (строки 27–32): **UPSERT** в `qualities` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` (строки 78–82): **UPSERT** в `achievements` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` (строки 13–17): **UPSERT** в `departments` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` (строки 19–23): **UPSERT** в `position_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` (строки 29–34): **UPSERT** в `skills` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` (строки 36–41): **UPSERT** в `qualities` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` (строки 84–88): **UPSERT** в `achievements` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql` (строки 2–4): **UPSERT** в `departments` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql` (строки 7–9): **UPSERT** в `position_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql` (строки 19–39): **INSERT** в `users` — Вставка данных из существующих таблиц
- `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql` (строки 42–62): **INSERT** в `user_profiles` — Вставка данных из существующих таблиц
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 2–3): **INSERT** в `departments` — Вставка данных
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 6–7): **INSERT** в `position_categories` — Вставка данных
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 10–11): **INSERT** в `positions` — Вставка данных
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 14–34): **INSERT** в `users` — Вставка данных
- `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` (строки 37–57): **INSERT** в `user_profiles` — Вставка данных
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 2–22): **INSERT** в `users` — Вставка данных из существующих таблиц
- `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` (строки 25–45): **INSERT** в `user_profiles` — Вставка данных
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 2–22): **INSERT** в `users` — Вставка данных из существующих таблиц
- `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` (строки 25–45): **INSERT** в `user_profiles` — Вставка данных
- `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` (строки 2–10): **UPSERT** в `users` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250909103431_98f4e799-2579-45b7-ae05-a85a9af3552f.sql` (строки 34–36): **UPSERT** в `trade_points` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250909103451_9018ea03-bf79-488c-9668-f87f959f0e25.sql` (строки 34–35): **INSERT** в `trade_points` — Вставка данных
- `supabase/migrations/20250909103544_4212f3f4-b583-4ab4-89be-886a56c56667.sql` (строки 3–5): **UPSERT** в `position_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250909103556_acc79f3d-a33d-4c90-906c-5e3614e06987.sql` (строки 3–5): **UPSERT** в `position_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250910113731_77e815ab-a42d-4513-a75f-583ee5ad7cc7.sql` (строки 22–28): **UPSERT** в `skill_survey_answer_options` — Вставка или обновление данных (upsert)
- `supabase/migrations/20250910114711_9d8eb2a2-dfea-4463-9b5c-f392ae64dcc3.sql` (строки 40–46): **UPSERT** в `skill_survey_answer_options` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql` (строки 2–4): **UPSERT** в `user_roles` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024164900_bf4e62fa-c64c-43e6-a1ab-8f742a13ddf4.sql` (строки 78–92): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024171243_b54ab4a7-8452-49e2-ad55-a3ce62d02eab.sql` (строки 2–76): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024171304_169ddc7f-9ec7-47e0-b30c-663d46dac7d0.sql` (строки 2–76): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 5–40): **UPSERT** в `SET, auth` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 43–58): **UPSERT** в `users, SET` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` (строки 61–66): **UPSERT** в `user_roles` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 5–40): **UPSERT** в `SET, auth` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 43–58): **UPSERT** в `users, SET` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` (строки 61–66): **UPSERT** в `user_roles` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` (строки 35–43): **UPSERT** в `SET, auth_users` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251101161419_de9ef741-2189-42a4-80bf-6355f6d5907b.sql` (строки 6–36): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql` (строки 82–122): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113184003_b4988151-d84c-4aeb-a8ac-fd0d1aa1a08c.sql` (строки 164–175): **UPSERT** в `permission_groups` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 12–17): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 20–25): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 28–33): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 36–41): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 44–49): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 52–57): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 60–65): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 68–73): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 76–81): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql` (строки 84–88): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251114134632_169827a9-7fd6-4a7e-9a8d-814d30c23063.sql` (строки 3–8): **UPSERT** в `SET, permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql` (строки 7–9): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql` (строки 12–14): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql` (строки 17–19): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251114175842_4c907627-8446-4794-8785-c59096034f0c.sql` (строки 73–75): **UPSERT** в `companies` — Вставка или обновление данных (upsert)
- `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` (строки 102–106): **UPSERT** в `answer_categories` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 20–33): **UPSERT** в `survey_360_assignments` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` (строки 37–52): **UPSERT** в `survey_360_assignments` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql` (строки 6–9): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql` (строки 12–15): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql` (строки 18–21): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql` (строки 24–27): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql` (строки 30–33): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260220121928_6ce31c94-7c55-4eca-b724-fa316e83da14.sql` (строки 49–50): **INSERT** в `storage` — Вставка данных
- `supabase/migrations/20260312092210_125aa66b-1642-451f-afce-9d19f63dfdcf.sql` (строки 3–5): **UPSERT** в `storage` — Вставка или обновление данных (upsert)
- `supabase/migrations/20260323162734_3e36246c-96a5-47d3-bce6-8531b302d20e.sql` (строки 1–3): **UPSERT** в `permissions` — Вставка или обновление данных (upsert)
- `SYNC_MIGRATIONS_2026.sql` (строки 345–356): **UPSERT** в `supabase_migrations` — Вставка или обновление данных (upsert)
