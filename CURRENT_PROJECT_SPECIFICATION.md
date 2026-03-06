# Актуальная спецификация проекта - Система управления компетенциями и развитием сотрудников

**Дата обновления:** 01.11.2025

## Содержание
1. [Архитектура системы](#архитектура-системы)
2. [Безопасность и шифрование](#безопасность-и-шифрование)
3. [Авторизация и сессии](#авторизация-и-сессии)
4. [Структура базы данных](#структура-базы-данных)
5. [Бизнес-логика и процессы](#бизнес-логика-и-процессы)
6. [API и Edge Functions](#api-и-edge-functions)
7. [Роли и права доступа](#роли-и-права-доступа)

---

## Архитектура системы

### Технологический стек
- **Frontend**: React 18.3.1 + TypeScript
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack Query 5.83.0
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Шифрование**: Yandex Cloud Functions API

### Основные модули
1. **Диагностика компетенций** - оценка профессиональных и личностных компетенций
2. **Встречи 1:1** - управление встречами сотрудник-руководитель
3. **Карьерные треки** - планирование карьерного развития
4. **Планы развития** - создание индивидуальных планов развития
5. **Аналитика HR** - дашборды и отчеты для HR BP
6. **Административная панель** - управление справочниками и пользователями

---

## Безопасность и шифрование

### Система шифрования персональных данных

**Провайдер**: Yandex Cloud Functions  
**Endpoint**: `https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g`

#### Шифруемые поля
- `users.first_name` - Имя
- `users.last_name` - Фамилия
- `users.middle_name` - Отчество
- `users.email` - Email
- `auth_users.email` - Email для авторизации

#### Процесс шифрования

**При создании пользователя** (`create-user` Edge Function):
```typescript
// 1. Получение данных от клиента
const { first_name, last_name, middle_name, email, ... } = requestData;

// 2. Шифрование через Yandex Cloud
const encryptResponse = await fetch(YANDEX_CLOUD_ENDPOINT, {
  method: 'POST',
  body: JSON.stringify({
    action: 'encrypt',
    data: { first_name, last_name, middle_name, email }
  })
});

// 3. Сохранение зашифрованных данных
await supabase.from('users').insert({
  first_name: encrypted.first_name,
  last_name: encrypted.last_name,
  middle_name: encrypted.middle_name,
  email: encrypted.email
});
```

**При чтении данных** (клиентская сторона):
```typescript
// Утилита: src/lib/userDataDecryption.ts
export async function decryptUserData(userData: UserData): Promise<DecryptedUserData> {
  const response = await fetch(YANDEX_CLOUD_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      action: 'decrypt',
      data: {
        first_name: userData.first_name,
        last_name: userData.last_name,
        middle_name: userData.middle_name,
        email: userData.email
      }
    })
  });
  
  return await response.json();
}
```

#### Обработка ошибок шифрования
- При ошибке дешифровки возвращаются исходные зашифрованные данные
- Plaintext email-адреса (содержащие `@` и не содержащие `=`) не дешифруются
- Fallback на исходные данные при недоступности API

---

## Авторизация и сессии

### Таблица `auth_users`
Хранит учетные данные для входа в систему.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `email` | text | Email (зашифрован) |
| `password_hash` | text | Хэш пароля (bcrypt) |
| `is_active` | boolean | Статус активности |
| `created_at` | timestamp | Дата создания |
| `updated_at` | timestamp | Дата обновления |

### Таблица `admin_sessions`
Управление сессиями пользователей (альтернатива JWT).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `email` | text | Email пользователя |
| `expires_at` | timestamp | Срок истечения (24 часа) |
| `created_at` | timestamp | Дата создания |

### Процесс авторизации

**1. Вход в систему** (`custom-login` Edge Function):
```typescript
// Проверка учетных данных
const authUser = await supabase
  .from('auth_users')
  .select('*')
  .eq('email', encryptedEmail)
  .single();

// Верификация пароля
const isValid = await bcrypt.compare(password, authUser.password_hash);

// Создание сессии
await supabase.from('admin_sessions').insert({
  user_id: authUser.id,
  email: authUser.email,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
});
```

**2. Контекст авторизации** (`src/contexts/AuthContext.tsx`):
```typescript
interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'hr_bp' | 'manager' | 'employee';
  permissions?: string[];
}

// Проверка активной сессии при загрузке
const { data: sessions } = await supabase
  .from('admin_sessions')
  .select('*')
  .gt('expires_at', new Date().toISOString())
  .order('created_at', { ascending: false })
  .limit(1);
```

**3. Защита маршрутов** (`src/components/AuthGuard.tsx`):
```typescript
const AuthGuard = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};
```

### Функция получения текущего пользователя
```sql
CREATE FUNCTION get_current_session_user() RETURNS uuid AS $$
  SELECT user_id 
  FROM admin_sessions 
  WHERE expires_at > now() 
  ORDER BY created_at DESC 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## Структура базы данных

### 1. Пользователи и организация

#### `users` - Основная таблица пользователей
| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| `id` | uuid | No | Primary key |
| `first_name` | text | No | Имя (зашифровано) |
| `last_name` | text | No | Фамилия (зашифровано) |
| `middle_name` | text | Yes | Отчество (зашифровано) |
| `email` | text | No | Email (зашифровано) |
| `manager_id` | uuid | Yes | FK -> users.id (руководитель) |
| `position_id` | uuid | Yes | FK -> positions.id |
| `grade_id` | uuid | Yes | FK -> grades.id |
| `department_id` | uuid | Yes | FK -> departments.id |
| `trade_point_id` | uuid | Yes | FK -> trade_points.id |
| `hire_date` | date | Yes | Дата найма |
| `created_at` | timestamp | No | Дата создания |
| `updated_at` | timestamp | No | Дата обновления |

#### `user_roles` - Роли пользователей
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `role` | app_role | Enum: admin, hr_bp, manager, employee |

#### `departments` - Департаменты
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название |
| `description` | text | Описание |

#### `positions` - Должности
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название |
| `position_category_id` | uuid | FK -> position_categories.id |

#### `trade_points` - Торговые точки
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название |
| `address` | text | Адрес |
| `latitude` | numeric | Широта |
| `longitude` | numeric | Долгота |
| `status` | text | Статус (Активный/Неактивный) |

### 2. Компетенции и грейды

#### `skills` - Профессиональные навыки
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название навыка |
| `description` | text | Описание |
| `category_id` | uuid | FK -> category_skills.id |

#### `qualities` - Личностные качества
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название качества |
| `description` | text | Описание |

#### `grades` - Грейды
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название грейда |
| `level` | integer | Уровень (1-5) |
| `position_id` | uuid | FK -> positions.id |
| `position_category_id` | uuid | FK -> position_categories.id |
| `parent_grade_id` | uuid | FK -> grades.id (след. грейд) |
| `certification_id` | uuid | FK -> certifications.id |
| `min_salary` | numeric | Минимальная зарплата |
| `max_salary` | numeric | Максимальная зарплата |
| `key_tasks` | text | Ключевые задачи |
| `description` | text | Описание |

#### `grade_skills` - Навыки по грейдам
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `grade_id` | uuid | FK -> grades.id |
| `skill_id` | uuid | FK -> skills.id |
| `target_level` | numeric | Целевой уровень (0-4) |

#### `grade_qualities` - Качества по грейдам
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `grade_id` | uuid | FK -> grades.id |
| `quality_id` | uuid | FK -> qualities.id |
| `target_level` | numeric | Целевой уровень (0-4) |

### 3. Диагностика компетенций

#### `diagnostic_stages` - Этапы диагностики
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `period` | text | Название периода |
| `evaluation_period` | text | Период оценки (H1_2025/H2_2025) |
| `start_date` | date | Дата начала |
| `end_date` | date | Дата окончания |
| `deadline_date` | date | Дедлайн |
| `status` | text | setup/assessment/completed |
| `progress_percent` | numeric | Прогресс (0-100) |
| `is_active` | boolean | Активен ли этап |
| `created_by` | uuid | FK -> users.id |

#### `diagnostic_stage_participants` - Участники диагностики
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `stage_id` | uuid | FK -> diagnostic_stages.id |
| `user_id` | uuid | FK -> users.id |

#### `hard_skill_questions` - Вопросы для оценки навыков
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `question_text` | text | Текст вопроса |
| `skill_id` | uuid | FK -> skills.id |
| `order_index` | integer | Порядок отображения |

#### `hard_skill_answer_options` - Варианты ответов (навыки)
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `title` | text | Название уровня |
| `description` | text | Описание |
| `step` | integer | Уровень (0-4) |

#### `hard_skill_results` - Результаты оценки навыков
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id (оцениваемый) |
| `evaluating_user_id` | uuid | FK -> users.id (оценивающий) |
| `question_id` | uuid | FK -> hard_skill_questions.id |
| `answer_option_id` | uuid | FK -> hard_skill_answer_options.id |
| `evaluation_period` | text | Период оценки |
| `comment` | text | Комментарий |

#### `soft_skill_questions` - Вопросы для оценки качеств (360)
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `question_text` | text | Текст вопроса |
| `quality_id` | uuid | FK -> qualities.id |
| `behavioral_indicators` | text | Поведенческие индикаторы |
| `category` | text | Категория вопроса |
| `order_index` | integer | Порядок отображения |

#### `soft_skill_answer_options` - Варианты ответов (360)
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `label` | text | Название уровня |
| `value` | integer | Числовое значение (0-4) |
| `description` | text | Описание |

#### `soft_skill_results` - Результаты оценки 360
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `evaluated_user_id` | uuid | FK -> users.id (оцениваемый) |
| `evaluating_user_id` | uuid | FK -> users.id (оценивающий) |
| `question_id` | uuid | FK -> soft_skill_questions.id |
| `answer_option_id` | uuid | FK -> soft_skill_answer_options.id |
| `evaluation_period` | text | Период оценки |
| `comment` | text | Комментарий |
| `is_anonymous_comment` | boolean | Анонимный ли комментарий |

#### `survey_360_assignments` - Назначения на оценку 360
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `evaluated_user_id` | uuid | FK -> users.id (оцениваемый) |
| `evaluating_user_id` | uuid | FK -> users.id (оценивающий) |
| `diagnostic_stage_id` | uuid | FK -> diagnostic_stages.id |
| `assignment_type` | text | self/manager/colleague |
| `status` | text | отправлен запрос/approved/rejected/выполнено |
| `is_manager_participant` | boolean | Является ли руководителем |
| `approved_by` | uuid | FK -> users.id |
| `approved_at` | timestamp | Дата одобрения |
| `rejected_at` | timestamp | Дата отклонения |
| `rejection_reason` | text | Причина отклонения |

#### `user_assessment_results` - Агрегированные результаты
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `diagnostic_stage_id` | uuid | FK -> diagnostic_stages.id |
| `assessment_period` | text | Период оценки |
| `skill_id` | uuid | FK -> skills.id |
| `quality_id` | uuid | FK -> qualities.id |
| `self_assessment` | numeric | Самооценка |
| `peers_average` | numeric | Средняя оценка коллег |
| `manager_assessment` | numeric | Оценка руководителя |
| `total_responses` | integer | Всего ответов |

### 4. Встречи 1:1

#### `meeting_stages` - Этапы встреч
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `period` | text | Название периода |
| `start_date` | date | Дата начала |
| `end_date` | date | Дата окончания |
| `deadline_date` | date | Дедлайн |
| `is_active` | boolean | Активен ли этап |
| `created_by` | uuid | FK -> users.id |

#### `meeting_stage_participants` - Участники встреч
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `stage_id` | uuid | FK -> meeting_stages.id |
| `user_id` | uuid | FK -> users.id |

#### `one_on_one_meetings` - Встречи 1:1
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `stage_id` | uuid | FK -> meeting_stages.id |
| `employee_id` | uuid | FK -> users.id |
| `manager_id` | uuid | FK -> users.id |
| `meeting_date` | timestamp | Дата встречи |
| `status` | text | draft/submitted/approved/returned |
| `goal_and_agenda` | text | Цель и повестка |
| `energy_gained` | text | Что дает энергию |
| `energy_lost` | text | Что забирает энергию |
| `previous_decisions_debrief` | text | Разбор предыдущих решений |
| `stoppers` | text | Стопперы |
| `manager_comment` | text | Комментарий руководителя |
| `return_reason` | text | Причина возврата |
| `submitted_at` | timestamp | Дата отправки |
| `approved_at` | timestamp | Дата утверждения |
| `returned_at` | timestamp | Дата возврата |

#### `meeting_decisions` - Решения по встречам
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `meeting_id` | uuid | FK -> one_on_one_meetings.id |
| `decision_text` | text | Текст решения |
| `is_completed` | boolean | Выполнено ли |
| `created_by` | uuid | FK -> users.id |

### 5. Задачи

#### `tasks` - Задачи пользователей
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `title` | text | Название задачи |
| `description` | text | Описание |
| `status` | text | pending/in_progress/completed |
| `priority` | text | normal/high/urgent |
| `task_type` | text | assessment/meeting/diagnostic_stage/survey_360_evaluation |
| `category` | text | Категория |
| `deadline` | date | Дедлайн |
| `assignment_id` | uuid | FK -> survey_360_assignments.id |
| `diagnostic_stage_id` | uuid | FK -> diagnostic_stages.id |
| `assignment_type` | text | Тип назначения |

### 6. Карьерное развитие

#### `career_tracks` - Карьерные треки
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название трека |
| `description` | text | Описание |
| `track_type_id` | uuid | FK -> track_types.id |
| `target_position_id` | uuid | FK -> positions.id |
| `duration_months` | integer | Длительность в месяцах |

#### `career_track_steps` - Шаги карьерного трека
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `career_track_id` | uuid | FK -> career_tracks.id |
| `grade_id` | uuid | FK -> grades.id |
| `step_order` | integer | Порядковый номер |
| `description` | text | Описание шага |
| `duration_months` | integer | Длительность шага |

#### `development_plans` - Планы развития
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `title` | text | Название плана |
| `description` | text | Описание |
| `status` | text | Активный/Завершен/Отменен |
| `start_date` | date | Дата начала |
| `end_date` | date | Дата окончания |
| `created_by` | uuid | FK -> users.id |

#### `development_tasks` - Задачи развития
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `skill_id` | uuid | FK -> skills.id |
| `quality_id` | uuid | FK -> qualities.id |
| `competency_level_id` | uuid | FK -> competency_levels.id |
| `task_order` | integer | Порядок |
| `task_name` | text | Название задачи |
| `task_goal` | text | Цель задачи |
| `how_to` | text | Как выполнить |
| `measurable_result` | text | Измеримый результат |

### 7. Аудит и безопасность

#### `audit_log` - Журнал аудита
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `admin_id` | uuid | FK -> users.id (кто совершил) |
| `target_user_id` | uuid | FK -> users.id (над кем) |
| `action_type` | text | Тип действия |
| `field` | text | Изменяемое поле |
| `old_value` | text | Старое значение |
| `new_value` | text | Новое значение |
| `details` | jsonb | Дополнительные детали |
| `created_at` | timestamp | Дата действия |

#### `admin_activity_logs` - Логи активности
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK -> users.id |
| `user_name` | text | Имя пользователя |
| `action` | text | CREATE/UPDATE/DELETE |
| `entity_type` | text | Тип сущности |
| `entity_name` | text | Название сущности |
| `details` | jsonb | Детали |
| `created_at` | timestamp | Дата действия |

#### `permissions` - Права доступа
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `name` | text | Название права |
| `resource` | text | Ресурс |
| `action` | text | Действие (create/read/update/delete) |
| `description` | text | Описание |

#### `role_permissions` - Связь ролей и прав
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Primary key |
| `role` | app_role | Роль |
| `permission_id` | uuid | FK -> permissions.id |

---

## Бизнес-логика и процессы

### 1. Процесс диагностики компетенций

#### Создание этапа диагностики
```sql
-- 1. Создается этап диагностики
INSERT INTO diagnostic_stages (period, start_date, end_date, deadline_date, status)
VALUES ('H1 2025', '2025-01-01', '2025-06-30', '2025-02-15', 'setup');

-- 2. Добавляются участники
INSERT INTO diagnostic_stage_participants (stage_id, user_id)
VALUES (stage_id, user_id);

-- 3. Триггер assign_surveys_to_diagnostic_participant создает:
-- - Самооценку 360 (assignment_type='self', status='approved')
-- - Оценку от руководителя (assignment_type='manager', status='approved')
-- - Задачу для участника (task_type='diagnostic_stage')
-- - Задачу для руководителя (task_type='survey_360_evaluation')
```

#### Выбор коллег для оценки 360
```typescript
// Пользователь выбирает коллег через интерфейс
const assignments = selectedColleagues.map(colleague => ({
  evaluated_user_id: userId,
  evaluating_user_id: colleague.id,
  diagnostic_stage_id: stageId,
  assignment_type: 'colleague',
  status: 'отправлен запрос'
}));

await supabase.from('survey_360_assignments').insert(assignments);
```

#### Прохождение опросов

**Оценка навыков (hard skills)**:
```typescript
// 1. Пользователь отвечает на вопросы
const results = questions.map(q => ({
  user_id: userId,
  evaluating_user_id: currentUserId,
  question_id: q.id,
  answer_option_id: selectedOption.id,
  evaluation_period: 'H1_2025',
  comment: userComment
}));

await supabase.from('hard_skill_results').insert(results);

// 2. Триггер update_user_skills_from_survey обновляет user_skills
// 3. Триггер aggregate_hard_skill_results создает записи в user_assessment_results
// 4. Триггер update_diagnostic_stage_status обновляет прогресс этапа
```

**Оценка качеств 360 (soft skills)**:
```typescript
// 1. Пользователь отвечает на вопросы
const results = questions.map(q => ({
  evaluated_user_id: evaluatedUserId,
  evaluating_user_id: currentUserId,
  question_id: q.id,
  answer_option_id: selectedOption.id,
  evaluation_period: 'H1_2025',
  comment: userComment,
  is_anonymous_comment: isAnonymous
}));

await supabase.from('soft_skill_results').insert(results);

// 2. Триггер update_assignment_on_survey_completion обновляет статус assignment
// 3. Триггер update_user_qualities_from_survey обновляет user_qualities
// 4. Триггер aggregate_soft_skill_results создает записи в user_assessment_results
```

#### Расчет прогресса этапа
```sql
CREATE FUNCTION calculate_diagnostic_stage_progress(stage_id_param uuid) 
RETURNS numeric AS $$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  progress numeric;
BEGIN
  -- Всего участников
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  -- Завершенные опросы навыков
  SELECT COUNT(DISTINCT ssr.user_id) INTO completed_skill_surveys
  FROM hard_skill_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Завершенные опросы 360
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM soft_skill_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Прогресс = (завершенные опросы / всего участников * 2) * 100
  progress := ((completed_skill_surveys + completed_360_surveys)::numeric / 
               (total_participants * 2)::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$$ LANGUAGE plpgsql;
```

### 2. Процесс встреч 1:1

#### Создание этапа встреч
```sql
-- 1. Создается этап встреч
INSERT INTO meeting_stages (period, start_date, end_date, deadline_date)
VALUES ('Q1 2025', '2025-01-01', '2025-03-31', '2025-02-15');

-- 2. Добавляются участники
INSERT INTO meeting_stage_participants (stage_id, user_id)
VALUES (stage_id, user_id);

-- 3. Триггер create_meeting_task_for_participant создает задачу
```

#### Заполнение формы встречи
```typescript
// 1. Сотрудник создает черновик
const meeting = {
  stage_id: stageId,
  employee_id: employeeId,
  manager_id: managerId,
  status: 'draft',
  meeting_date: new Date(),
  goal_and_agenda: '...',
  energy_gained: '...',
  energy_lost: '...',
  // ...
};

await supabase.from('one_on_one_meetings').insert(meeting);

// 2. Сотрудник отправляет на утверждение
await supabase.from('one_on_one_meetings')
  .update({ status: 'submitted', submitted_at: new Date() })
  .eq('id', meetingId);

// 3. Руководитель утверждает/возвращает
await supabase.from('one_on_one_meetings')
  .update({ 
    status: 'approved', 
    approved_at: new Date(),
    manager_comment: 'Отличная встреча!'
  })
  .eq('id', meetingId);

// 4. Триггер update_meeting_task_status обновляет задачу
```

### 3. Агрегация результатов оценки

#### Для навыков (hard_skill_results)
```sql
-- Триггер aggregate_hard_skill_results выполняет:
INSERT INTO user_assessment_results (
  user_id,
  diagnostic_stage_id,
  assessment_period,
  skill_id,
  self_assessment,
  peers_average,
  manager_assessment,
  total_responses
)
SELECT 
  user_id,
  stage_id,
  evaluation_period,
  skill_id,
  -- Самооценка
  AVG(CASE WHEN evaluating_user_id = user_id THEN answer_value ELSE NULL END),
  -- Средняя оценка коллег
  AVG(CASE WHEN evaluating_user_id != user_id AND evaluating_user_id != manager_id 
      THEN answer_value ELSE NULL END),
  -- Оценка руководителя
  AVG(CASE WHEN evaluating_user_id = manager_id THEN answer_value ELSE NULL END),
  COUNT(*)
FROM hard_skill_results
JOIN hard_skill_questions ON question_id = hard_skill_questions.id
JOIN hard_skill_answer_options ON answer_option_id = hard_skill_answer_options.id
WHERE user_id = NEW.user_id
GROUP BY skill_id;
```

#### Для качеств (soft_skill_results)
```sql
-- Триггер aggregate_soft_skill_results выполняет аналогичную агрегацию
-- но для soft_skill_results и qualities
```

### 4. Управление задачами

#### Автоматическое создание задач

**При добавлении участника диагностики**:
```sql
-- Триггер create_diagnostic_task_for_participant создает:
-- 1. Задачу для участника
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  title,
  description,
  task_type,
  category,
  deadline
) VALUES (
  participant_user_id,
  stage_id,
  'Комплексная диагностика (самооценка + выбор коллег)',
  'Необходимо пройти комплексную оценку компетенций',
  'diagnostic_stage',
  'Диагностика',
  deadline_date
);

-- 2. Задачу для руководителя
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  title,
  description,
  task_type,
  category,
  deadline
) VALUES (
  manager_user_id,
  stage_id,
  'Оценка подчинённого: ' || participant_name,
  'Необходимо пройти оценку 360',
  'survey_360_evaluation',
  'Оценка 360',
  deadline_date
);
```

**При утверждении встречи**:
```sql
-- Триггер update_meeting_task_status обновляет:
UPDATE tasks
SET status = 'completed', updated_at = now()
WHERE user_id = employee_id
  AND task_type = 'meeting'
  AND status != 'completed';
```

---

## API и Edge Functions

### 1. `custom-login` - Авторизация пользователя

**Путь**: `/functions/v1/custom-login`  
**Метод**: POST

**Запрос**:
```json
{
  "email": "admin@example.com",
  "password": "test123"
}
```

**Процесс**:
1. Шифрует email через Yandex Cloud API
2. Ищет пользователя в `auth_users` по зашифрованному email
3. Проверяет пароль через bcrypt
4. Создает сессию в `admin_sessions` (24 часа)
5. Получает роль из `user_roles`

**Ответ**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin",
    "permissions": ["manage_users", "view_reports", ...]
  },
  "session": {
    "id": "uuid",
    "expires_at": "2025-11-02T12:00:00Z"
  }
}
```

### 2. `create-user` - Создание пользователя

**Путь**: `/functions/v1/create-user`  
**Метод**: POST

**Запрос**:
```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "middle_name": "Иванович",
  "email": "ivanov@example.com",
  "password": "securePassword123",
  "position_id": "uuid",
  "grade_id": "uuid",
  "department_id": "uuid",
  "manager_id": "uuid",
  "trade_point_id": "uuid",
  "hire_date": "2025-01-15",
  "role": "employee"
}
```

**Процесс**:
1. Шифрует персональные данные через Yandex Cloud API
2. Хэширует пароль через bcrypt
3. Создает запись в `auth_users` (зашифрованный email + хэш пароля)
4. Создает запись в `users` (зашифрованные ФИО и email)
5. Создает запись в `user_roles`
6. Логирует действие в `audit_log`

**Ответ**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "ivanov@example.com"
  }
}
```

### 3. `delete-user` - Удаление пользователя

**Путь**: `/functions/v1/delete-user`  
**Метод**: POST

**Запрос**:
```json
{
  "user_id": "uuid",
  "admin_id": "uuid"
}
```

**Процесс**:
1. Проверяет права администратора
2. Деактивирует пользователя в `auth_users` (is_active = false)
3. Удаляет связанные данные (в зависимости от политики)
4. Логирует действие в `audit_log`

**Ответ**:
```json
{
  "success": true,
  "message": "Пользователь успешно удален"
}
```

### 4. `generate-development-tasks` - Генерация задач развития

**Путь**: `/functions/v1/generate-development-tasks`  
**Метод**: POST

**Запрос**:
```json
{
  "user_id": "uuid",
  "gap_analysis": {
    "skills": [
      {
        "skill_id": "uuid",
        "skill_name": "Управление проектами",
        "current_level": 2,
        "target_level": 4
      }
    ],
    "qualities": [
      {
        "quality_id": "uuid",
        "quality_name": "Лидерство",
        "current_level": 1,
        "target_level": 3
      }
    ]
  }
}
```

**Процесс**:
1. Анализирует разрывы в компетенциях
2. Выбирает готовые задачи из `development_tasks`
3. Может использовать AI для генерации персонализированных задач

**Ответ**:
```json
{
  "success": true,
  "tasks": [
    {
      "competency_type": "skill",
      "competency_id": "uuid",
      "competency_name": "Управление проектами",
      "task_name": "Пройти курс по Agile",
      "task_goal": "Освоить методологию Agile",
      "how_to": "Записаться на онлайн-курс...",
      "measurable_result": "Сертификат о прохождении курса"
    }
  ]
}
```

---

## Роли и права доступа

### Роли (enum `app_role`)
1. **admin** - Администратор системы
2. **hr_bp** - HR Business Partner
3. **manager** - Руководитель
4. **employee** - Сотрудник

### Матрица прав доступа

#### Управление пользователями
| Действие | admin | hr_bp | manager | employee |
|----------|-------|-------|---------|----------|
| Просмотр всех пользователей | ✅ | ✅ | Своя команда | Нет |
| Создание пользователей | ✅ | ✅ | Нет | Нет |
| Редактирование пользователей | ✅ | ✅ | Нет | Нет |
| Удаление пользователей | ✅ | Нет | Нет | Нет |
| Смена ролей | ✅ | Нет | Нет | Нет |

#### Диагностика
| Действие | admin | hr_bp | manager | employee |
|----------|-------|-------|---------|----------|
| Создание этапов | ✅ | ✅ | Нет | Нет |
| Добавление участников | ✅ | ✅ | Нет | Нет |
| Просмотр результатов | ✅ | ✅ | Своя команда | Свои |
| Прохождение опросов | ✅ | ✅ | ✅ | ✅ |

#### Встречи 1:1
| Действие | admin | hr_bp | manager | employee |
|----------|-------|-------|---------|----------|
| Создание этапов | ✅ | ✅ | Нет | Нет |
| Заполнение формы | ✅ | ✅ | ✅ | ✅ |
| Утверждение встреч | Нет | Нет | Своя команда | Нет |
| Просмотр встреч | ✅ | ✅ | Своя команда | Свои |

#### Справочники
| Действие | admin | hr_bp | manager | employee |
|----------|-------|-------|---------|----------|
| Управление навыками | ✅ | Нет | Нет | Нет |
| Управление качествами | ✅ | Нет | Нет | Нет |
| Управление грейдами | ✅ | Нет | Нет | Нет |
| Просмотр справочников | ✅ | ✅ | ✅ | ✅ |

### RLS политики

#### Пример: `diagnostic_stages`
```sql
-- Админы и HR могут управлять
CREATE POLICY "Admins and HR can manage diagnostic stages"
ON diagnostic_stages FOR ALL
USING (has_any_role(get_current_session_user(), ARRAY['admin', 'hr_bp']))
WITH CHECK (has_any_role(get_current_session_user(), ARRAY['admin', 'hr_bp']));

-- Руководители видят этапы своей команды
CREATE POLICY "Managers can view diagnostic stages"
ON diagnostic_stages FOR SELECT
USING (
  has_any_role(get_current_session_user(), ARRAY['admin', 'hr_bp'])
  OR EXISTS (
    SELECT 1 FROM diagnostic_stage_participants dsp
    JOIN users u ON u.id = dsp.user_id
    WHERE dsp.stage_id = diagnostic_stages.id
      AND u.manager_id = get_current_session_user()
  )
);

-- Участники видят свои этапы
CREATE POLICY "Participants can view their diagnostic stages"
ON diagnostic_stages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM diagnostic_stage_participants
    WHERE stage_id = diagnostic_stages.id
      AND user_id = get_current_session_user()
  )
);
```

### Функции проверки прав

```sql
-- Проверка роли
CREATE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Проверка одной из ролей
CREATE FUNCTION has_any_role(_user_id uuid, _roles app_role[]) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Проверка права доступа
CREATE FUNCTION has_permission(_user_id uuid, _permission_name text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role = ur.role
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.name = _permission_name
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Проверка, является ли руководителем
CREATE FUNCTION is_manager_of(_manager_id uuid, _employee_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = _employee_id AND manager_id = _manager_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## Периоды оценки

### Автоматическое определение периода
```sql
CREATE FUNCTION get_evaluation_period(created_date timestamp with time zone) 
RETURNS text AS $$
BEGIN
  IF EXTRACT(MONTH FROM created_date) <= 6 THEN
    RETURN 'H1_' || EXTRACT(YEAR FROM created_date);
  ELSE
    RETURN 'H2_' || EXTRACT(YEAR FROM created_date);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Примеры:
-- '2025-03-15' -> 'H1_2025'
-- '2025-09-20' -> 'H2_2025'
```

### Триггер установки периода
```sql
CREATE TRIGGER set_evaluation_period
BEFORE INSERT ON hard_skill_results
FOR EACH ROW
EXECUTE FUNCTION set_evaluation_period();

-- То же для soft_skill_results
```

---

## Заключение

Система представляет собой комплексное решение для управления компетенциями, развитием и оценкой сотрудников с:

✅ **Безопасностью**: Шифрование персональных данных, RLS политики, аудит действий  
✅ **Гибкостью**: Настраиваемые грейды, навыки, качества, карьерные треки  
✅ **Автоматизацией**: Триггеры для создания задач, агрегации результатов, расчета прогресса  
✅ **Масштабируемостью**: Готовность к работе с большим количеством пользователей и данных  
✅ **Аналитикой**: Агрегированные результаты, дашборды, отчеты по компетенциям

**Основные преимущества**:
- Единая система оценки навыков и качеств
- Автоматическое назначение опросов и задач
- Поддержка иерархии (сотрудник -> руководитель -> HR)
- Полная история изменений и аудит
- Защита персональных данных через внешнее API шифрования