# Схема базы данных - Текущая версия

**Дата:** 2025-11-14  
**Версия:** 3.0 (Supabase Auth)

## Обзор

База данных использует PostgreSQL через Supabase с встроенной системой аутентификации.

## Основные компоненты

### 1. Аутентификация (Supabase Auth)

**Таблица:** `auth.users` (управляется Supabase)

Не требует создания - предоставляется Supabase из коробки.

**Связь с приложением:**
- `users.id` = `auth.users.id` (один UUID для обеих таблиц)
- Аутентификация через `supabase.auth.*` методы
- JWT токены для авторизации запросов

### 2. Пользователи и роли

#### Таблица `users`

Основная таблица с данными пользователей (расширяет auth.users).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,  -- Зашифрован
  first_name TEXT,      -- Зашифрован
  last_name TEXT,       -- Зашифрован
  middle_name TEXT,     -- Зашифрован
  status BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  position_id UUID REFERENCES positions(id),
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES users(id),
  hr_bp_id UUID REFERENCES users(id),
  grade_id UUID REFERENCES grades(id),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_position ON users(position_id);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_email ON users(email);
```

**Важно:** `users.id` совпадает с `auth.users.id` - один UUID используется в обеих таблицах.

#### Таблица `user_roles`

```sql
CREATE TYPE app_role AS ENUM ('admin', 'hr_bp', 'manager', 'employee');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- Ссылается на auth.users(id)
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
```

### 3. Система разрешений

#### Таблица `permissions`

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Примеры разрешений:**
- `security.manage` - Управление пользователями и безопасностью
- `diagnostics.manage` - Управление диагностикой
- `team.manage` - Управление командой

#### Таблица `role_permissions`

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID REFERENCES permissions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission_id)
);
```

#### Таблица `user_effective_permissions` (кэш)

```sql
CREATE TABLE user_effective_permissions (
  user_id UUID NOT NULL,
  permission_name TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_name)
);

CREATE INDEX idx_user_effective_permissions_user 
  ON user_effective_permissions(user_id);
```

### 4. Справочники

#### Отделы
```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Должности
```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_category_id UUID NOT NULL REFERENCES position_categories(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Грейды
```sql
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  position_id UUID REFERENCES positions(id),
  position_category_id UUID REFERENCES position_categories(id),
  parent_grade_id UUID REFERENCES grades(id),
  description TEXT,
  key_tasks TEXT,
  min_salary NUMERIC,
  max_salary NUMERIC,
  certification_id UUID REFERENCES certifications(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5. Диагностика

#### Этапы диагностики
```sql
CREATE TABLE diagnostic_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup',
  evaluation_period TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  progress_percent NUMERIC DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Участники диагностики
```sql
CREATE TABLE diagnostic_stage_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES diagnostic_stages(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stage_id, user_id)
);
```

### 6. Оценка (Hard Skills)

#### Вопросы
```sql
CREATE TABLE hard_skill_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  skill_id UUID REFERENCES skills(id),
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Ответы
```sql
CREATE TABLE hard_skill_answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  numeric_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Результаты
```sql
CREATE TABLE hard_skill_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluated_user_id UUID NOT NULL,
  evaluating_user_id UUID,
  question_id UUID NOT NULL REFERENCES hard_skill_questions(id),
  answer_option_id UUID NOT NULL REFERENCES hard_skill_answer_options(id),
  comment TEXT,
  diagnostic_stage_id UUID REFERENCES diagnostic_stages(id),
  assignment_id UUID REFERENCES survey_360_assignments(id),
  evaluation_period TEXT,
  is_draft BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7. Оценка 360 (Soft Skills)

#### Вопросы
```sql
CREATE TABLE soft_skill_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  quality_id UUID REFERENCES qualities(id),
  behavioral_indicators TEXT,
  category TEXT,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Результаты
```sql
CREATE TABLE soft_skill_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluated_user_id UUID NOT NULL,
  evaluating_user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES soft_skill_questions(id),
  answer_option_id UUID NOT NULL REFERENCES soft_skill_answer_options(id),
  comment TEXT,
  diagnostic_stage_id UUID REFERENCES diagnostic_stages(id),
  assignment_id UUID REFERENCES survey_360_assignments(id),
  evaluation_period TEXT,
  is_draft BOOLEAN DEFAULT true,
  is_anonymous_comment BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Назначения опросов
```sql
CREATE TABLE survey_360_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluated_user_id UUID NOT NULL,
  evaluating_user_id UUID NOT NULL,
  diagnostic_stage_id UUID REFERENCES diagnostic_stages(id),
  assignment_type TEXT,
  status TEXT NOT NULL DEFAULT 'отправлен запрос',
  is_manager_participant BOOLEAN DEFAULT false,
  assigned_date TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(evaluated_user_id, evaluating_user_id)
);
```

### 8. Задачи

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assignment_id UUID REFERENCES survey_360_assignments(id),
  diagnostic_stage_id UUID REFERENCES diagnostic_stages(id),
  assignment_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  task_type TEXT DEFAULT 'assessment',
  category TEXT DEFAULT 'assessment',
  priority TEXT DEFAULT 'normal',
  deadline DATE,
  competency_ref UUID,
  kpi_expected_level INTEGER,
  kpi_result_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 9. Встречи 1:1

#### Этапы встреч
```sql
CREATE TABLE meeting_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Встречи
```sql
CREATE TABLE one_on_one_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES meeting_stages(id),
  employee_id UUID NOT NULL,
  manager_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  meeting_date TIMESTAMPTZ,
  goal_and_agenda TEXT,
  energy_gained TEXT,
  energy_lost TEXT,
  stoppers TEXT,
  previous_decisions_debrief TEXT,
  manager_comment TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  return_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 10. Логирование и аудит

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  target_user_id UUID,
  action_type TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE access_denied_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_role app_role,
  permission_name TEXT,
  resource_type TEXT,
  resource_id UUID,
  action_attempted TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## SQL Функции

### Проверка разрешений

```sql
-- Основная функция проверки прав
CREATE OR REPLACE FUNCTION has_permission(_permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = _permission_name
  );
$$;
```

### Обновление кэша разрешений

```sql
CREATE OR REPLACE FUNCTION refresh_user_effective_permissions(target_user_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_effective_permissions WHERE user_id = target_user_id;
  
  INSERT INTO user_effective_permissions (user_id, permission_name)
  SELECT DISTINCT
    target_user_id,
    p.name
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role = ur.role
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = target_user_id;
END;
$$;
```

### Проверка участия в диагностике

```sql
CREATE OR REPLACE FUNCTION is_diagnostic_stage_participant(_stage_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants
    WHERE stage_id = _stage_id
      AND user_id = _user_id
  );
$$;
```

## Триггеры

### Автоматическое обновление updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Применяется ко многим таблицам
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Обновление кэша разрешений при изменении ролей

```sql
CREATE TRIGGER trigger_refresh_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_permissions();

CREATE TRIGGER trigger_refresh_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_role_permissions();
```

## RLS Политики

Все таблицы с пользовательскими данными имеют включённый RLS.

### Пример: users

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Пользователи видят коллег
CREATE POLICY "users_select_colleagues"
ON users FOR SELECT
USING (
  id = auth.uid() 
  OR can_view_users(auth.uid())
);

-- Только с правами могут изменять
CREATE POLICY "users_update_authorized"
ON users FOR UPDATE
USING (can_manage_users(auth.uid()));
```

### Пример: diagnostic_stages

```sql
-- Только участники или HR видят этапы
CREATE POLICY "diagnostic_stages_select_auth_policy"
ON diagnostic_stages FOR SELECT
USING (
  is_diagnostic_stage_participant(id, auth.uid())
  OR has_permission('diagnostics.manage')
);

-- Только HR может создавать
CREATE POLICY "diagnostic_stages_insert_auth_policy"
ON diagnostic_stages FOR INSERT
WITH CHECK (has_permission('diagnostics.manage'));
```

## Миграции

### История ключевых изменений

1. **2024-10-24:** Создание базовой структуры (устаревшая версия с auth_users)
2. **2024-11-13:** Миграция на Supabase Auth
   - Удалена таблица `auth_users`
   - Удалена таблица `admin_sessions`  
   - Удалено поле `users.auth_user_id`
   - `users.id` теперь совпадает с `auth.users.id`

### Текущая версия: Supabase Auth

```sql
-- users.id = auth.users.id (один UUID)
-- Нет необходимости в auth_user_id
-- Аутентификация через supabase.auth.*
```

## Индексы для производительности

```sql
-- Users
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_position ON users(position_id);
CREATE INDEX idx_users_manager ON users(manager_id);

-- Roles & Permissions
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_effective_permissions_user ON user_effective_permissions(user_id);

-- Diagnostics
CREATE INDEX idx_diagnostic_participants_stage ON diagnostic_stage_participants(stage_id);
CREATE INDEX idx_diagnostic_participants_user ON diagnostic_stage_participants(user_id);

-- Results
CREATE INDEX idx_hard_skill_results_user ON hard_skill_results(evaluated_user_id);
CREATE INDEX idx_soft_skill_results_user ON soft_skill_results(evaluated_user_id);
```

## Ссылки

- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
