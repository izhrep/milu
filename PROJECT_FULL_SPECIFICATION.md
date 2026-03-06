# 📋 ПОЛНОЕ ОПИСАНИЕ ПРОЕКТА "Система управления компетенциями и развитием сотрудников"

## 📑 СОДЕРЖАНИЕ

1. [База данных](#база-данных)
2. [Функции и триггеры](#функции-и-триггеры)
3. [Шифрование данных](#шифрование-данных)
4. [Политики безопасности (RLS)](#политики-безопасности-rls)
5. [Страницы приложения](#страницы-приложения)
6. [Навигация](#навигация)
7. [Разделы и функционал](#разделы-и-функционал)
8. [Edge Functions](#edge-functions)
9. [API эндпоинты](#api-эндпоинты)

---

## 🗄️ БАЗА ДАННЫХ

### **49 ТАБЛИЦ**

#### **Пользователи и организация (8 таблиц)**

##### `users`
Основная таблица пользователей с зашифрованными персональными данными.

**Поля:**
- `id` (UUID, PK)
- `first_name` (TEXT) - **Зашифровано**
- `last_name` (TEXT) - **Зашифровано**
- `middle_name` (TEXT, nullable) - **Зашифровано**
- `email` (TEXT, unique) - **Зашифровано**
- `phone` (TEXT, nullable)
- `employee_number` (TEXT, unique)
- `department_id` (UUID, FK → departments)
- `position_id` (UUID, FK → positions)
- `grade_id` (UUID, FK → grades)
- `manager_id` (UUID, FK → users)
- `trade_point_id` (UUID, FK → trade_points)
- `hire_date` (DATE)
- `birth_date` (DATE, nullable)
- `status` (BOOLEAN, default: true)
- `avatar_url` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `last_login_at` (TIMESTAMPTZ, nullable)

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE (email)
- UNIQUE (employee_number)
- INDEX (manager_id)
- INDEX (department_id)
- INDEX (position_id)

---

##### `auth_users`
Таблица аутентификации с зашифрованным email и хешем пароля.

**Поля:**
- `id` (UUID, PK)
- `email` (TEXT, unique) - **Зашифровано**
- `password_hash` (TEXT) - **BCrypt хеш**
- `is_active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Безопасность:**
- Пароль хешируется через BCrypt (cost factor: 10)
- Email шифруется через Yandex Cloud Functions API

---

##### `user_roles`
Связь пользователей и ролей (many-to-many).

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `role` (app_role ENUM)
- `created_at` (TIMESTAMPTZ)

**Enum app_role:**
- `admin` - Администратор
- `hr_bp` - HR Business Partner
- `manager` - Руководитель
- `employee` - Сотрудник
- `moderator` - Модератор
- `user` - Пользователь

**Ограничения:**
- UNIQUE (user_id, role)

---

##### `admin_sessions`
Сессии пользователей для авторизации.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `email` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ, default: now() + 24 hours)

**Логика:**
- Автоматическое истечение через 24 часа
- При каждом логине создается новая сессия

---

##### `departments`
Справочник отделов.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `positions`
Справочник должностей.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `position_category_id` (UUID, FK → position_categories)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `position_categories`
Категории должностей.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `trade_points`
Торговые точки с геокоординатами.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `address` (TEXT)
- `latitude` (NUMERIC, nullable)
- `longitude` (NUMERIC, nullable)
- `status` (TEXT, default: 'Активный')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Применение:**
- Mapbox GL для отображения на карте
- Привязка пользователей к точкам

---

#### **Компетенции и грейды (11 таблиц)**

##### `skills`
Справочник навыков (hard skills).

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `category_id` (UUID, FK → category_skills)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Примеры:**
- "Продажи консультативные"
- "Работа с CRM"
- "Презентационные навыки"

---

##### `qualities`
Справочник качеств (soft skills).

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Примеры:**
- "Клиентоориентированность"
- "Ответственность"
- "Коммуникабельность"

---

##### `category_skills`
Категории навыков.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Примеры:**
- "Продажи"
- "Управление"
- "Технические навыки"

---

##### `grades`
Грейды (уровни развития).

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT) - например: "Junior", "Middle", "Senior"
- `level` (INTEGER) - порядковый номер
- `description` (TEXT, nullable)
- `key_tasks` (TEXT, nullable) - ключевые задачи грейда
- `position_id` (UUID, FK → positions)
- `position_category_id` (UUID, FK → position_categories)
- `parent_grade_id` (UUID, FK → grades, nullable) - для иерархии
- `certification_id` (UUID, FK → certifications, nullable)
- `min_salary` (NUMERIC, nullable)
- `max_salary` (NUMERIC, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `grade_skills`
Требуемые навыки для грейда (many-to-many).

**Поля:**
- `id` (UUID, PK)
- `grade_id` (UUID, FK → grades)
- `skill_id` (UUID, FK → skills)
- `target_level` (NUMERIC) - требуемый уровень (1-5)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `grade_qualities`
Требуемые качества для грейда (many-to-many).

**Поля:**
- `id` (UUID, PK)
- `grade_id` (UUID, FK → grades)
- `quality_id` (UUID, FK → qualities)
- `target_level` (NUMERIC) - требуемый уровень (1-5)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `competency_levels`
Уровни владения компетенциями.

**Поля:**
- `id` (UUID, PK)
- `level` (INTEGER) - 1, 2, 3, 4, 5
- `name` (TEXT) - "Начальный", "Базовый", "Уверенный", "Продвинутый", "Экспертный"
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `user_skills`
Текущие навыки пользователей.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `skill_id` (UUID, FK → skills)
- `current_level` (NUMERIC) - текущий уровень (1-5)
- `target_level` (NUMERIC) - целевой уровень
- `last_assessed_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Ограничения:**
- UNIQUE (user_id, skill_id)

**Обновление:**
- Автоматически через триггер `update_user_skills_from_survey()`

---

##### `user_qualities`
Текущие качества пользователей.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `quality_id` (UUID, FK → qualities)
- `current_level` (NUMERIC) - текущий уровень (1-5)
- `target_level` (NUMERIC) - целевой уровень
- `last_assessed_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Ограничения:**
- UNIQUE (user_id, quality_id)

**Обновление:**
- Автоматически через триггер `update_user_qualities_from_survey()`

---

##### `certifications`
Справочник сертификаций.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `provider` (TEXT, nullable) - провайдер сертификации
- `cost` (NUMERIC, nullable)
- `validity_period_months` (INTEGER, nullable) - срок действия
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

#### **Диагностика компетенций (10 таблиц)**

##### `diagnostic_stages`
Этапы диагностики компетенций.

**Поля:**
- `id` (UUID, PK)
- `period` (TEXT) - "H1 2024", "H2 2024"
- `start_date` (DATE)
- `end_date` (DATE)
- `deadline_date` (DATE) - дедлайн для прохождения
- `status` (TEXT, default: 'setup') - 'setup', 'assessment', 'completed'
- `progress_percent` (NUMERIC, default: 0)
- `is_active` (BOOLEAN, default: true)
- `evaluation_period` (TEXT, nullable) - "H1_2024", "H2_2024"
- `created_by` (UUID, FK → users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Автоматика:**
- Прогресс рассчитывается через `calculate_diagnostic_stage_progress()`
- Статус обновляется автоматически

---

##### `diagnostic_stage_participants`
Участники этапа диагностики.

**Поля:**
- `id` (UUID, PK)
- `stage_id` (UUID, FK → diagnostic_stages)
- `user_id` (UUID, FK → users)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- UNIQUE (stage_id, user_id)

**Триггер:**
- При добавлении → `handle_diagnostic_participant_added()` создает assignments и задачи

---

##### `hard_skill_questions`
Вопросы для оценки навыков.

**Поля:**
- `id` (UUID, PK)
- `question_text` (TEXT)
- `skill_id` (UUID, FK → skills, nullable)
- `order_index` (INTEGER, nullable) - порядок отображения
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `hard_skill_answer_options`
Варианты ответов для оценки навыков.

**Поля:**
- `id` (UUID, PK)
- `title` (TEXT) - "Не владею", "Базовый", "Уверенный", "Продвинутый", "Экспертный"
- `numeric_value` (INTEGER) - 1, 2, 3, 4, 5
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `hard_skill_results`
Результаты оценки навыков.

**Поля:**
- `id` (UUID, PK)
- `evaluated_user_id` (UUID, FK → users) - кого оценивают
- `evaluating_user_id` (UUID, FK → users) - кто оценивает (может быть NULL для самооценки)
- `question_id` (UUID, FK → hard_skill_questions)
- `answer_option_id` (UUID, FK → hard_skill_answer_options)
- `comment` (TEXT, nullable)
- `diagnostic_stage_id` (UUID, FK → diagnostic_stages, nullable)
- `assignment_id` (UUID, FK → survey_360_assignments, nullable)
- `evaluation_period` (TEXT, nullable) - "H1_2024"
- `is_draft` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Триггеры:**
- `set_evaluation_period()` - автоматическая установка периода
- `aggregate_hard_skill_results()` - агрегация результатов
- `update_user_skills_from_survey()` - обновление профиля

---

##### `soft_skill_questions`
Вопросы для оценки 360° (качества).

**Поля:**
- `id` (UUID, PK)
- `question_text` (TEXT)
- `quality_id` (UUID, FK → qualities, nullable)
- `category` (TEXT, nullable) - группировка вопросов
- `behavioral_indicators` (TEXT, nullable) - поведенческие индикаторы
- `order_index` (INTEGER, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `soft_skill_answer_options`
Варианты ответов для оценки 360°.

**Поля:**
- `id` (UUID, PK)
- `label` (TEXT) - "Никогда", "Редко", "Иногда", "Часто", "Всегда"
- `numeric_value` (INTEGER) - 1, 2, 3, 4, 5
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `soft_skill_results`
Результаты оценки 360°.

**Поля:**
- `id` (UUID, PK)
- `evaluated_user_id` (UUID, FK → users)
- `evaluating_user_id` (UUID, FK → users)
- `question_id` (UUID, FK → soft_skill_questions)
- `answer_option_id` (UUID, FK → soft_skill_answer_options)
- `comment` (TEXT, nullable)
- `is_anonymous_comment` (BOOLEAN, default: false)
- `diagnostic_stage_id` (UUID, FK → diagnostic_stages, nullable)
- `assignment_id` (UUID, FK → survey_360_assignments, nullable)
- `evaluation_period` (TEXT, nullable)
- `is_draft` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Анонимность:**
- Комментарии коллег могут быть анонимными
- Руководитель и самооценка НЕ анонимны

---

##### `survey_360_assignments`
Назначения оценок 360°.

**Поля:**
- `id` (UUID, PK)
- `evaluated_user_id` (UUID, FK → users) - кого оценивают
- `evaluating_user_id` (UUID, FK → users) - кто оценивает
- `assignment_type` (TEXT, nullable) - 'self', 'manager', 'peer'
- `diagnostic_stage_id` (UUID, FK → diagnostic_stages, nullable)
- `status` (TEXT, default: 'отправлен запрос') - 'отправлен запрос', 'approved', 'rejected', 'completed'
- `assigned_date` (TIMESTAMPTZ, default: now())
- `approved_at` (TIMESTAMPTZ, nullable)
- `approved_by` (UUID, FK → users, nullable)
- `rejected_at` (TIMESTAMPTZ, nullable)
- `rejection_reason` (TEXT, nullable)
- `is_manager_participant` (BOOLEAN, default: false)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Ограничения:**
- UNIQUE (evaluated_user_id, evaluating_user_id)

**Типы назначений:**
- `self` - самооценка (создается автоматически)
- `manager` - оценка руководителя (создается автоматически)
- `peer` - оценка коллеги (выбирает сам сотрудник)

---

##### `user_assessment_results`
Агрегированные результаты оценки.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `diagnostic_stage_id` (UUID, FK → diagnostic_stages, nullable)
- `skill_id` (UUID, FK → skills, nullable)
- `quality_id` (UUID, FK → qualities, nullable)
- `assessment_period` (TEXT) - "H1_2024"
- `assessment_date` (TIMESTAMPTZ)
- `self_assessment` (NUMERIC, nullable) - средняя самооценка
- `manager_assessment` (NUMERIC, nullable) - оценка руководителя
- `peers_average` (NUMERIC, nullable) - средняя оценка коллег
- `total_responses` (INTEGER) - количество ответов
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Заполнение:**
- Автоматически через триггеры:
  - `aggregate_hard_skill_results()` - для навыков
  - `aggregate_soft_skill_results()` - для качеств

---

#### **Встречи 1:1 (4 таблицы)**

##### `meeting_stages`
Этапы встреч 1:1.

**Поля:**
- `id` (UUID, PK)
- `period` (TEXT) - "Q1 2024", "Q2 2024"
- `start_date` (DATE)
- `end_date` (DATE)
- `deadline_date` (DATE)
- `is_active` (BOOLEAN, default: true)
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `meeting_stage_participants`
Участники этапа встреч.

**Поля:**
- `id` (UUID, PK)
- `stage_id` (UUID, FK → meeting_stages)
- `user_id` (UUID, FK → users)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- UNIQUE (stage_id, user_id)

**Триггер:**
- При добавлении → `create_meeting_task_for_participant()` создает задачу

---

##### `one_on_one_meetings`
Данные встреч 1:1.

**Поля:**
- `id` (UUID, PK)
- `employee_id` (UUID, FK → users)
- `manager_id` (UUID, FK → users)
- `stage_id` (UUID, FK → meeting_stages)
- `meeting_date` (TIMESTAMPTZ, nullable)
- `goal_and_agenda` (TEXT, nullable) - цели и повестка
- `previous_decisions_debrief` (TEXT, nullable) - разбор предыдущих решений
- `energy_gained` (TEXT, nullable) - что добавило энергии
- `energy_lost` (TEXT, nullable) - что забрало энергию
- `stoppers` (TEXT, nullable) - стопперы в работе
- `manager_comment` (TEXT, nullable) - комментарий руководителя
- `status` (TEXT, default: 'draft') - 'draft', 'submitted', 'returned', 'approved'
- `submitted_at` (TIMESTAMPTZ, nullable)
- `approved_at` (TIMESTAMPTZ, nullable)
- `returned_at` (TIMESTAMPTZ, nullable)
- `return_reason` (TEXT, nullable) - причина возврата
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Workflow:**
1. Сотрудник заполняет (draft)
2. Отправляет руководителю (submitted)
3. Руководитель: утверждает (approved) или возвращает (returned)

---

##### `meeting_decisions`
Решения и договоренности со встреч.

**Поля:**
- `id` (UUID, PK)
- `meeting_id` (UUID, FK → one_on_one_meetings)
- `decision_text` (TEXT)
- `is_completed` (BOOLEAN, default: false)
- `created_by` (UUID, FK → users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

#### **Карьерные треки (5 таблиц)**

##### `track_types`
Типы карьерных треков.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT) - "Продажи", "Управление", "Экспертиза"
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `career_tracks`
Карьерные треки.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT) - "Продавец → Старший продавец"
- `description` (TEXT, nullable)
- `track_type_id` (UUID, FK → track_types, nullable)
- `target_position_id` (UUID, FK → positions, nullable)
- `duration_months` (INTEGER, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `career_track_steps`
Шаги карьерного трека.

**Поля:**
- `id` (UUID, PK)
- `career_track_id` (UUID, FK → career_tracks)
- `grade_id` (UUID, FK → grades)
- `step_order` (INTEGER) - порядковый номер шага
- `description` (TEXT, nullable)
- `duration_months` (INTEGER, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `user_career_progress`
Прогресс пользователей по карьерным трекам.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `career_track_id` (UUID, FK → career_tracks)
- `current_step` (INTEGER)
- `started_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `user_career_ratings`
Оценки прогресса по карьере.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `rated_by` (UUID, FK → users)
- `rating` (INTEGER) - оценка прогресса
- `comment` (TEXT, nullable)
- `rating_date` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

---

#### **Развитие (3 таблицы)**

##### `development_plans`
Планы развития.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `start_date` (DATE, nullable)
- `end_date` (DATE, nullable)
- `status` (TEXT, default: 'Активный')
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `development_tasks`
Шаблоны задач развития.

**Поля:**
- `id` (UUID, PK)
- `skill_id` (UUID, FK → skills, nullable)
- `quality_id` (UUID, FK → qualities, nullable)
- `competency_level_id` (UUID, FK → competency_levels, nullable)
- `task_order` (INTEGER, default: 1)
- `task_name` (TEXT)
- `task_goal` (TEXT) - цель задачи
- `how_to` (TEXT) - как выполнить
- `measurable_result` (TEXT) - измеримый результат
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Применение:**
- Генерация персонализированных задач через Edge Function

---

##### `tasks`
Задачи пользователей.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `status` (TEXT, default: 'pending') - 'pending', 'in_progress', 'completed'
- `priority` (TEXT, default: 'normal') - 'low', 'normal', 'high'
- `deadline` (DATE, nullable)
- `task_type` (TEXT, default: 'assessment') - 'assessment', 'meeting', 'diagnostic_stage', 'survey_360_evaluation'
- `category` (TEXT, default: 'assessment') - 'Диагностика', 'Встречи 1:1', 'Оценка 360'
- `assignment_id` (UUID, FK → survey_360_assignments, nullable)
- `assignment_type` (TEXT, nullable) - 'self', 'manager', 'peer'
- `diagnostic_stage_id` (UUID, FK → diagnostic_stages, nullable)
- `competency_ref` (UUID, nullable)
- `kpi_expected_level` (INTEGER, nullable)
- `kpi_result_level` (INTEGER, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Автосоздание:**
- Диагностика: через `handle_diagnostic_participant_added()`
- Встречи: через `create_meeting_task_for_participant()`
- Оценка 360°: через `create_task_on_assignment_approval()`

**Триггер валидации:**
- `validate_task_diagnostic_stage_id()` - проверяет наличие diagnostic_stage_id для типов diagnostic_stage и survey_360_evaluation

---

#### **Безопасность и аудит (4 таблицы)**

##### `permissions`
Справочник прав доступа.

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT, unique) - "users:read", "diagnostics:create"
- `description` (TEXT, nullable)
- `resource` (TEXT) - группировка: "users", "diagnostics", "tasks"
- `action` (TEXT) - "read", "create", "update", "delete"
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Всего прав:** ~80 прав

**Ресурсы (21 категория):**
- audit
- career
- diagnostics
- tasks
- team
- development
- users
- profiles
- surveys
- meetings
- analytics
- admin
- security
- settings
- reports
- kpi
- achievements
- certifications
- grades
- competencies
- system

---

##### `role_permissions`
Связь ролей и прав (many-to-many).

**Поля:**
- `id` (UUID, PK)
- `role` (app_role ENUM)
- `permission_id` (UUID, FK → permissions)
- `created_at` (TIMESTAMPTZ)

**Распределение прав:**
- `admin` - 100% всех прав
- `hr_bp` - ~50-60 прав (HR функции)
- `manager` - ~35-40 прав (команда, отчеты)
- `employee` - ~10-15 прав (свои данные, опросы)

---

##### `audit_log`
Журнал аудита изменений.

**Поля:**
- `id` (UUID, PK)
- `admin_id` (UUID, FK → users)
- `target_user_id` (UUID, FK → users, nullable)
- `action_type` (TEXT) - "CREATE", "UPDATE", "DELETE"
- `field` (TEXT, nullable) - измененное поле
- `old_value` (TEXT, nullable)
- `new_value` (TEXT, nullable)
- `details` (JSONB, nullable)
- `created_at` (TIMESTAMPTZ)

**Применение:**
- Логирование через `log_admin_action()`
- Просмотр в `/security` → вкладка "Audit Log"

---

##### `admin_activity_logs`
Журнал активности администраторов.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `user_name` (TEXT)
- `action` (TEXT) - "CREATE", "UPDATE", "DELETE"
- `entity_type` (TEXT) - "diagnostic_stage", "meeting_stage"
- `entity_name` (TEXT, nullable)
- `details` (JSONB, nullable)
- `created_at` (TIMESTAMPTZ)

**Триггер:**
- `log_diagnostic_stage_changes()` - автологирование изменений этапов

---

#### **Прочие таблицы (4 таблицы)**

##### `manufacturers`
Производители (для торговли).

**Поля:**
- `id` (UUID, PK)
- `name` (TEXT)
- `brand` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `survey_assignments`
Назначения опросов (старая структура).

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `survey_type` (TEXT)
- `status` (TEXT, default: 'Назначен')
- `due_date` (DATE, nullable)
- `assigned_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

##### `user_achievements`
Достижения пользователей.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `achievement_id` (UUID) - ID достижения из справочника
- `earned_at` (TIMESTAMPTZ)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

---

##### `user_kpi_results`
Результаты KPI пользователей.

**Поля:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `kpi_name` (TEXT)
- `period` (TEXT)
- `target_value` (NUMERIC)
- `actual_value` (NUMERIC)
- `achievement_percent` (NUMERIC)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

## ⚙️ ФУНКЦИИ И ТРИГГЕРЫ

### **42 ФУНКЦИИ**

#### **Авторизация и роли (10 функций)**

##### `get_current_session_user() → UUID`
Получение ID текущего пользователя из активной сессии.

**Тип:** STABLE, SECURITY DEFINER  
**Схема поиска:** public

```sql
SELECT user_id 
FROM admin_sessions 
WHERE id IN (
  SELECT id FROM admin_sessions 
  WHERE expires_at > now() 
  ORDER BY created_at DESC 
  LIMIT 1
)
LIMIT 1;
```

**Применение:**
- В RLS политиках для определения текущего пользователя
- Вместо `auth.uid()` (Supabase Auth не используется)

---

##### `has_role(_user_id UUID, _role app_role) → BOOLEAN`
Проверка наличия роли у пользователя.

**Тип:** STABLE, SECURITY DEFINER  
**Параметры:**
- `_user_id` - ID пользователя
- `_role` - роль для проверки

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
);
```

---

##### `has_any_role(_user_id UUID, _roles app_role[]) → BOOLEAN`
Проверка наличия любой из ролей.

**Параметры:**
- `_user_id` - ID пользователя
- `_roles` - массив ролей

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = ANY(_roles)
);
```

**Применение:**
```sql
-- Доступ для admin или hr_bp
has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
```

---

##### `has_permission(_user_id UUID, _permission_name TEXT) → BOOLEAN`
Проверка наличия права у пользователя.

**Тип:** STABLE, SECURITY DEFINER

```sql
SELECT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role = ur.role
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND p.name = _permission_name
);
```

---

##### `get_user_role(_user_id UUID) → app_role`
Получение роли пользователя.

```sql
SELECT role FROM user_roles
WHERE user_id = _user_id
LIMIT 1;
```

---

##### `is_current_user_admin() → BOOLEAN`
Проверка, является ли текущий пользователь администратором.

```sql
SELECT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = get_current_session_user()
    AND ur.role = 'admin'
);
```

---

##### `is_current_user_hr() → BOOLEAN`
Проверка, является ли текущий пользователь HR (admin или hr_bp).

```sql
SELECT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = get_current_session_user()
    AND ur.role IN ('admin', 'hr_bp')
);
```

---

##### `is_manager_of(_manager_id UUID, _employee_id UUID) → BOOLEAN`
Проверка, является ли пользователь руководителем другого пользователя.

```sql
SELECT EXISTS (
  SELECT 1 FROM users
  WHERE id = _employee_id AND manager_id = _manager_id
);
```

---

##### `is_manager_of_user(target_user_id UUID) → BOOLEAN`
Проверка, является ли текущий пользователь руководителем.

```sql
SELECT EXISTS (
  SELECT 1 FROM users
  WHERE id = target_user_id
    AND manager_id = get_current_session_user()
);
```

---

##### `get_users_with_roles() → TABLE`
Получение списка пользователей с ролями.

**Возвращаемые поля:**
- id, email, status, last_login_at, created_at, updated_at, role

```sql
SELECT 
  u.id, u.email, u.status, u.last_login_at,
  u.created_at, u.updated_at, ur.role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id;
```

---

#### **Права доступа (2 функции)**

##### `get_all_permissions() → SETOF permissions`
Получение всех прав доступа.

```sql
SELECT * FROM permissions ORDER BY resource, name;
```

---

##### `get_role_permissions() → SETOF role_permissions`
Получение связей ролей и прав.

```sql
SELECT * FROM role_permissions;
```

---

#### **Диагностика (10 функций)**

##### `handle_diagnostic_participant_added() → TRIGGER`
**КРИТИЧЕСКИ ВАЖНАЯ ФУНКЦИЯ** - создает assignments и задачи при добавлении участника.

**Алгоритм:**
1. Получает руководителя участника и дедлайн этапа
2. Создает **самооценку** в `survey_360_assignments`:
   - `assignment_type = 'self'`
   - `status = 'approved'`
   - `approved_by = manager_id`
3. Создает задачу для участника (если не существует):
   - `task_type = 'diagnostic_stage'`
   - `assignment_type = 'self'`
   - Название: "Пройти самооценку"
4. Если есть руководитель, создает **оценку руководителя**:
   - `assignment_type = 'manager'`
   - `status = 'approved'`
   - `is_manager_participant = true`
5. Создает задачу для руководителя (если не существует):
   - `task_type = 'survey_360_evaluation'`
   - `assignment_type = 'manager'`
   - Название: "Оценка подчинённого: ФИО"

**Триггер:**
```sql
CREATE TRIGGER trigger_handle_diagnostic_participant_added
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION handle_diagnostic_participant_added();
```

---

##### `assign_surveys_to_diagnostic_participant() → TRIGGER`
Назначение опросов участнику диагностики (упрощенная версия).

**Алгоритм:**
1. Создает самооценку
2. Создает оценку руководителя (если есть)

---

##### `auto_assign_manager_for_360() → TRIGGER`
Автоматическое назначение руководителя для оценки 360°.

**Условие:** срабатывает при создании самооценки  
**Действие:** создает `assignment_type = 'manager'` для руководителя

---

##### `calculate_diagnostic_stage_progress(stage_id_param UUID) → NUMERIC`
Расчет прогресса этапа диагностики.

**Алгоритм:**
1. Считает количество участников
2. Считает завершенные опросы навыков
3. Считает завершенные опросы 360°
4. Прогресс = (завершено / требуется) × 100

**Возврат:** процент (0-100)

---

##### `update_diagnostic_stage_status() → TRIGGER`
Обновление статуса этапа при изменении результатов.

**Статусы:**
- `0%` → 'setup'
- `0-99%` → 'assessment'
- `100%` → 'completed'

---

##### `update_diagnostic_stage_on_participant_add() → TRIGGER`
Обновление прогресса при добавлении участника.

---

##### `check_diagnostic_invariants(stage_id_param UUID) → TABLE`
Проверка инвариантов диагностики.

**Проверки:**
1. `assignment_type` допустимы (self, manager, peer)
2. Соответствие `assignment_type` между tasks и assignments
3. Отсутствие NULL в обязательных полях
4. `category = 'assessment'` для всех задач

**Возврат:** таблица с результатами проверок

---

##### `aggregate_hard_skill_results() → TRIGGER`
Агрегация результатов оценки навыков.

**Триггер:** AFTER INSERT/UPDATE на `hard_skill_results`

**Алгоритм:**
1. Удаляет старые агрегаты для этапа
2. Группирует по навыкам
3. Считает средние для:
   - Самооценка (`evaluating_user_id = evaluated_user_id`)
   - Оценка руководителя (`evaluating_user_id = manager_id`)
   - Средняя оценка коллег (остальные)
4. Записывает в `user_assessment_results`

---

##### `aggregate_soft_skill_results() → TRIGGER`
Агрегация результатов оценки 360° (качества).

**Аналогично `aggregate_hard_skill_results()`**, но для качеств.

---

##### `delete_diagnostic_tasks_on_participant_remove() → TRIGGER`
Удаление задач при удалении участника.

**Действия:**
1. Удаляет задачу участника
2. Удаляет задачу руководителя для этого участника

---

#### **Задачи (7 функций)**

##### `create_diagnostic_task_for_participant() → TRIGGER`
Создание задач диагностики для участника (старая версия).

**Замечание:** используется `handle_diagnostic_participant_added()` как основная

---

##### `create_meeting_task_for_participant() → TRIGGER`
Создание задачи встречи при добавлении участника.

**Триггер:** AFTER INSERT на `meeting_stage_participants`

**Действие:**
- Создает задачу типа `meeting`
- Название: "Встреча 1:1 - {period}"
- Дедлайн из этапа

---

##### `create_task_on_assignment_approval() → TRIGGER`
Создание задачи при утверждении assignment.

**Триггер:** AFTER INSERT/UPDATE на `survey_360_assignments`  
**Условие:** `status = 'approved'` И НЕТ `diagnostic_stage_id`

**Замечание:** для diagnostic_stage задачи создаются через `handle_diagnostic_participant_added()`

---

##### `update_task_status_on_assignment_change() → TRIGGER`
Обновление статуса задачи при изменении assignment.

**Условие:** `status = 'completed'`  
**Действие:** все связанные задачи → `status = 'completed'`

---

##### `complete_diagnostic_task_on_surveys_completion() → TRIGGER`
Завершение задачи при завершении обоих опросов.

**Условие:** заполнены И hard_skill_results И soft_skill_results  
**Действие:** задача диагностики → `status = 'completed'`

---

##### `update_meeting_task_status() → TRIGGER`
Обновление статуса задачи встречи при утверждении.

**Триггер:** AFTER UPDATE на `one_on_one_meetings`  
**Условие:** `status = 'approved'`  
**Действие:** задача → `status = 'completed'`

---

##### `validate_task_diagnostic_stage_id() → TRIGGER`
Валидация наличия `diagnostic_stage_id` для задач.

**Триггер:** BEFORE INSERT на `tasks`

**Логика:**
- Если `task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey')` И `diagnostic_stage_id IS NULL`
- Тогда RETURN NULL (блокировка вставки)

---

#### **Обновление профиля (2 функции)**

##### `update_user_skills_from_survey() → TRIGGER`
Обновление навыков пользователя при завершении опроса.

**Триггер:** AFTER INSERT/UPDATE на `hard_skill_results`  
**Условие:** `is_draft = false`

**Действие:**
1. INSERT или UPDATE в `user_skills`
2. `current_level` = среднее значение всех оценок
3. `last_assessed_at` = текущее время

---

##### `update_user_qualities_from_survey() → TRIGGER`
Обновление качеств пользователя при завершении опроса 360°.

**Аналогично `update_user_skills_from_survey()`**, но для качеств.

---

#### **Периоды оценки (2 функции)**

##### `get_evaluation_period(created_date TIMESTAMPTZ) → TEXT`
Определение периода оценки (H1/H2).

**Алгоритм:**
- Месяц 1-6 → `'H1_' || год`
- Месяц 7-12 → `'H2_' || год`

**Пример:**
- 2024-03-15 → 'H1_2024'
- 2024-09-20 → 'H2_2024'

---

##### `set_evaluation_period() → TRIGGER`
Автоматическая установка периода оценки.

**Триггер:** BEFORE INSERT на `hard_skill_results`, `soft_skill_results`

```sql
NEW.evaluation_period = get_evaluation_period(NEW.created_at);
```

---

#### **Аудит (2 функции)**

##### `log_admin_action(...) → UUID`
Запись в журнал аудита.

**Параметры:**
- `_admin_id` - кто выполнил
- `_target_user_id` - над кем
- `_action_type` - CREATE/UPDATE/DELETE
- `_field` - измененное поле
- `_old_value`, `_new_value` - значения
- `_details` - дополнительные данные (JSONB)

**Возврат:** ID записи audit_log

---

##### `log_diagnostic_stage_changes() → TRIGGER`
Автологирование изменений этапов диагностики.

**Триггеры:**
- AFTER INSERT - логирует создание
- AFTER UPDATE - логирует изменение статуса

---

#### **Утилиты (6 функций)**

##### `update_updated_at_column() → TRIGGER`
Обновление поля `updated_at`.

**Триггер:** BEFORE UPDATE на всех таблицах с `updated_at`

```sql
NEW.updated_at = now();
```

---

##### `update_survey_360_selections_updated_at() → TRIGGER`
Обновление времени в `survey_360_assignments`.

---

##### `update_assignment_on_survey_completion() → TRIGGER`
Обновление статуса assignment при завершении опроса.

**Действия:**
1. `survey_360_assignments.status = 'completed'`
2. `tasks.status = 'completed'`

---

##### `check_user_has_auth(user_email TEXT) → BOOLEAN`
Проверка наличия записи в `auth_users`.

```sql
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  JOIN public.users pu ON au.id = pu.id
  WHERE pu.email = user_email
);
```

---

##### `get_user_with_role(user_email TEXT) → TABLE`
Получение пользователя с ролью по email.

**Возврат:** id, full_name, email, role_name

---

#### **Административные (2 функции)**

##### `admin_cleanup_all_data() → JSONB`
Очистка всех данных диагностики и встреч.

**Требует:** `is_current_user_admin() = true`

**Удаляет (в порядке зависимостей):**
1. meeting_decisions
2. one_on_one_meetings
3. meeting_stage_participants
4. meeting_stages
5. diagnostic_stage_participants
6. diagnostic_stages
7. tasks
8. soft_skill_results
9. hard_skill_results
10. user_assessment_results
11. survey_360_assignments

**Возврат:** массив JSON с количеством удаленных записей по каждой таблице

---

##### `admin_delete_all_from_table(table_name TEXT) → INTEGER`
Очистка конкретной таблицы.

**Требует:** `is_current_user_admin() = true`  
**Возврат:** количество удаленных строк

---

### **ТРИГГЕРЫ**

**Всего:** 6 активных триггеров

#### **1. Диагностика**

```sql
-- Создание assignments и задач при добавлении участника
CREATE TRIGGER trigger_assign_surveys_to_diagnostic_participant
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();

-- Автоназначение руководителя для 360°
CREATE TRIGGER trigger_auto_assign_manager_for_360
AFTER INSERT ON survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION auto_assign_manager_for_360();
```

#### **2. Задачи**

```sql
-- Создание задачи при утверждении assignment
CREATE TRIGGER trigger_create_task_on_assignment_approval
AFTER INSERT OR UPDATE ON survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION create_task_on_assignment_approval();

-- Обновление статуса задачи при изменении assignment
CREATE TRIGGER trigger_update_task_status_on_assignment_change
AFTER UPDATE ON survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION update_task_status_on_assignment_change();
```

#### **3. Агрегация результатов**

```sql
-- Агрегация результатов навыков
CREATE TRIGGER trigger_aggregate_hard_skill_results
AFTER INSERT OR UPDATE ON hard_skill_results
FOR EACH ROW
EXECUTE FUNCTION aggregate_hard_skill_results();

-- Агрегация результатов 360°
CREATE TRIGGER trigger_aggregate_soft_skill_results
AFTER INSERT OR UPDATE ON soft_skill_results
FOR EACH ROW
EXECUTE FUNCTION aggregate_soft_skill_results();
```

---

## 🔐 ШИФРОВАНИЕ ДАННЫХ

### **Yandex Cloud Functions API**

**URL эндпоинта:**
```
https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g
```

**Доступные методы:**
- `POST /encrypt` - шифрование данных
- `POST /decrypt` - расшифровка данных

---

### **Шифруемые поля**

#### **Таблица `users`:**
- `first_name` - Имя
- `last_name` - Фамилия
- `middle_name` - Отчество
- `email` - Email

#### **Таблица `auth_users`:**
- `email` - Email

---

### **Процесс шифрования**

#### **При создании пользователя:**

1. **Frontend** собирает данные формы
2. Отправляет запрос к Yandex Cloud Functions:
```typescript
const encryptResponse = await fetch(`${API_URL}/encrypt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    first_name: formData.first_name,
    last_name: formData.last_name,
    middle_name: formData.middle_name,
    email: formData.email
  })
});
```

3. Получает зашифрованные значения:
```json
{
  "first_name": "encrypted_base64_string",
  "last_name": "encrypted_base64_string",
  "middle_name": "encrypted_base64_string",
  "email": "encrypted_base64_string"
}
```

4. Вызывает Edge Function `create-user` с зашифрованными данными
5. Edge Function сохраняет в Supabase

---

#### **При чтении пользователей:**

1. **Frontend** получает зашифрованные данные из Supabase
2. Отправляет запрос к Yandex Cloud Functions:
```typescript
const decryptResponse = await fetch(`${API_URL}/decrypt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    first_name: user.first_name,
    last_name: user.last_name,
    middle_name: user.middle_name,
    email: user.email
  })
});
```

3. Получает расшифрованные значения
4. Отображает пользователю

---

### **Fallback механизм**

При ошибке шифрования/расшифровки:
- **Создание:** показывается ошибка пользователю
- **Чтение:** показываются оригинальные зашифрованные значения

**Утилита `userDataDecryption.ts`:**
```typescript
export async function decryptUserData(userData: UserData): Promise<DecryptedUserData> {
  try {
    const response = await fetch(`${API_URL}/decrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: userData.first_name,
        last_name: userData.last_name,
        middle_name: userData.middle_name,
        email: userData.email
      })
    });
    
    if (!response.ok) throw new Error('Decryption failed');
    
    return await response.json();
  } catch (error) {
    console.error('Decryption error:', error);
    // Fallback: return original data
    return {
      id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      middle_name: userData.middle_name || '',
      email: userData.email
    };
  }
}
```

---

## 🔒 ПОЛИТИКИ БЕЗОПАСНОСТИ (RLS)

### **Принципы безопасности**

1. **Кастомная авторизация:** через `admin_sessions` и функцию `get_current_session_user()`
2. **Минимальные привилегии:** каждая роль видит только необходимое
3. **Иммутабельность:** критичные данные защищены от изменения
4. **Иерархический доступ:** менеджер → команда, HR → все, админ → всё
5. **Анонимность комментариев:** в оценке 360° комментарии коллег анонимны

---

### **Политики по таблицам**

#### **Таблица `users`**

```sql
-- Админ видит всех
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (is_current_user_admin());

-- Пользователь видит себя
CREATE POLICY "Users can view themselves"
ON users FOR SELECT
USING (id = get_current_session_user());

-- Менеджер видит свою команду
CREATE POLICY "Managers can view their team"
ON users FOR SELECT
USING (manager_id = get_current_session_user());
```

---

#### **Таблица `diagnostic_stages`**

```sql
-- Админ и HR управляют этапами
CREATE POLICY "Admins and HR can manage diagnostic stages"
ON diagnostic_stages FOR ALL
USING (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]))
WITH CHECK (has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role]));

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

-- Менеджеры видят этапы своей команды
CREATE POLICY "Managers can view diagnostic stages"
ON diagnostic_stages FOR SELECT
USING (
  has_any_role(get_current_session_user(), ARRAY['admin'::app_role, 'hr_bp'::app_role])
  OR EXISTS (
    SELECT 1
    FROM diagnostic_stage_participants dsp
    JOIN users u ON u.id = dsp.user_id
    WHERE dsp.stage_id = diagnostic_stages.id
      AND u.manager_id = get_current_session_user()
  )
);
```

---

#### **Таблица `hard_skill_results`**

```sql
-- Пользователь может создавать и редактировать свои оценки
CREATE POLICY "Users can insert hard_skill_results"
ON hard_skill_results FOR INSERT
WITH CHECK (
  evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);

CREATE POLICY "Users can update hard_skill_results"
ON hard_skill_results FOR UPDATE
USING (
  evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- Пользователь видит результаты, где он оценивающий или оцениваемый
CREATE POLICY "Users can view hard_skill_results"
ON hard_skill_results FOR SELECT
USING (
  evaluating_user_id = get_current_session_user()
  OR evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Пользователь может удалять свои оценки
CREATE POLICY "Users can delete hard_skill_results"
ON hard_skill_results FOR DELETE
USING (
  evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);
```

---

#### **Таблица `soft_skill_results`**

**Аналогично `hard_skill_results`**, но с дополнительной логикой анонимности комментариев:

- Поле `is_anonymous_comment` = true → комментарий скрывается от оцениваемого
- Руководитель и администратор видят все комментарии
- Коллеги видят только свои комментарии

---

#### **Таблица `survey_360_assignments`**

```sql
-- Пользователь может создавать assignments (выбирать коллег)
CREATE POLICY "Users can create 360 assignments"
ON survey_360_assignments FOR INSERT
WITH CHECK (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
);

-- Пользователь видит свои assignments
CREATE POLICY "Users can view their 360 assignments"
ON survey_360_assignments FOR SELECT
USING (
  evaluated_user_id = get_current_session_user()
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);

-- Пользователь может обновлять assignments (утверждение/отклонение)
CREATE POLICY "Users can update their 360 assignments"
ON survey_360_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = evaluated_user_id
       OR user_id = evaluating_user_id
  )
);

-- Пользователь может удалять свои assignments
CREATE POLICY "Users can delete their 360 assignments"
ON survey_360_assignments FOR DELETE
USING (
  evaluated_user_id = get_current_session_user()
  OR is_current_user_admin()
);
```

---

#### **Таблица `tasks`**

```sql
-- Пользователь управляет своими задачами
CREATE POLICY "Users can manage their tasks"
ON tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = tasks.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = tasks.user_id
  )
);
```

---

#### **Таблица `one_on_one_meetings`**

```sql
-- Сотрудник и менеджер видят и управляют встречей
CREATE POLICY "Users can view their meetings"
ON one_on_one_meetings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = employee_id OR user_id = manager_id
  )
);

CREATE POLICY "Users can manage their meetings"
ON one_on_one_meetings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = employee_id OR user_id = manager_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE user_id = employee_id OR user_id = manager_id
  )
);
```

---

#### **Справочники (публичный доступ)**

Все справочники доступны на чтение всем:

```sql
CREATE POLICY "Everyone can view {table}"
ON {table} FOR SELECT
USING (true);
```

**Таблицы:**
- skills, qualities, category_skills
- grades, grade_skills, grade_qualities
- hard_skill_questions, hard_skill_answer_options
- soft_skill_questions, soft_skill_answer_options
- departments, positions, position_categories
- trade_points, manufacturers
- certifications, competency_levels
- career_tracks, career_track_steps, track_types

**Управление:**
- Только админ может изменять (USING `is_current_user_admin()`)

---

#### **Таблица `permissions`**

```sql
-- Все могут читать права
CREATE POLICY "Allow all read access to permissions"
ON permissions FOR SELECT
USING (true);

-- Изменение запрещено (управление через миграции)
```

---

#### **Таблица `role_permissions`**

```sql
-- Все могут читать связи ролей и прав
CREATE POLICY "Everyone can view role_permissions"
ON role_permissions FOR SELECT
USING (true);

-- Админ может управлять
CREATE POLICY "Admins can manage role_permissions"
ON role_permissions FOR ALL
USING (has_role(get_current_session_user(), 'admin'::app_role))
WITH CHECK (has_role(get_current_session_user(), 'admin'::app_role));
```

---

#### **Таблица `audit_log`**

```sql
-- Все могут читать (для прозрачности)
CREATE POLICY "Allow all read access to audit_log"
ON audit_log FOR SELECT
USING (true);

-- Все могут добавлять (через функции)
CREATE POLICY "Allow all insert access to audit_log"
ON audit_log FOR INSERT
WITH CHECK (true);

-- Изменение и удаление запрещены
```

---

## 🌐 СТРАНИЦЫ ПРИЛОЖЕНИЯ

### **27 страниц (Routes)**

#### **Публичные (1)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/login` | `LoginPage` | Авторизация |

---

#### **Главная (1)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | `Index` | Главная страница, дашборд |

---

#### **Профиль и развитие (3)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/profile` | `ProfilePage` | Профиль пользователя с компетенциями |
| `/development` | `DevelopmentPage` | План развития |
| `/training` | `TrainingPage` | Обучение и курсы |

---

#### **Команда (2)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/team` | `TeamPage` | Моя команда (для менеджеров) |
| `/meetings` | `MeetingsPage` | Встречи 1:1 |

---

#### **Оценка и опросы (7)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/my-assignments` | `MyAssignmentsPage` | Мои назначения (опросы) |
| `/assessment/:assignmentId` | `UnifiedAssessmentPage` | Единая оценка (навыки + 360°) |
| `/unified-assessment/:assignmentId` | `UnifiedAssessmentPage` | Альтернативный путь |
| `/skill-survey/questions/:assignmentId` | `SkillSurveyQuestionsPage` | Опрос по навыкам |
| `/skill-survey/results` | `SkillSurveyResultsPage` | Результаты навыков |
| `/survey-360/questions/:assignmentId` | `Survey360QuestionsPage` | Опрос 360° |
| `/survey-360-results` | `Survey360ResultsPage` | Результаты 360° |
| `/assessment/results/:userId` | `AssessmentResultsPage` | Сводные результаты |

---

#### **Управление пользователями (3)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/users` | `UsersListPage` | Список пользователей |
| `/users/create` | `CreateUserPage` | Создание пользователя |
| `/users/migration` | `UsersMigrationPage` | Миграция пользователей |

---

#### **Аналитика (4)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/manager-reports` | `ManagerReportsPage` | Отчеты руководителя |
| `/manager/comparison` | `ManagerComparisonPage` | Сравнение сотрудников |
| `/hr-analytics` | `HRAnalyticsPage` | HR-аналитика |
| `/hr/diagnostic-monitoring` | `DiagnosticMonitoringPage` | Мониторинг диагностики |

---

#### **Администрирование (5)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/admin` | `AdminDashboard` | Панель администратора |
| `/admin/stages` | `StagesPage` | Управление этапами |
| `/admin/:tableId` | `ReferenceTablePage` | Справочники |
| `/admin/diagnostics` | `DiagnosticsAdminPage` | Администрирование диагностики |
| `/security` | `SecurityManagementPage` | Управление ролями и правами |

---

#### **Прочие (1)**

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/feed` | `FeedPage` | Лента новостей |

---

### **Детальное описание страниц**

#### **LoginPage (`/login`)**

**Компоненты:**
- Форма логина (email + password)
- Валидация полей
- Кнопка "Войти"

**Процесс:**
1. Пользователь вводит email и пароль
2. Отправка в Edge Function `custom-login`
3. Проверка credentials в `auth_users`
4. Создание сессии в `admin_sessions`
5. Сохранение сессии в `localStorage`
6. Редирект на главную

**Безопасность:**
- Пароль хешируется на сервере (BCrypt)
- Email расшифровывается для проверки
- Сессия истекает через 24 часа

---

#### **Index (`/`)**

**Компоненты:**
- `DashboardStats` - статистика (задачи, встречи, оценки)
- `QuickActions` - быстрые действия
- `RecentActivity` - последняя активность
- `CareerProgressWidget` - прогресс по карьерному треку
- `TaskList` - список задач

**Данные:**
- Текущий пользователь
- Активные задачи
- Статусы опросов
- Прогресс развития

---

#### **ProfilePage (`/profile`)**

**Секции:**
1. **ProfileHeader** - аватар, ФИО, должность, грейд
2. **ProfileDashboard** - вкладки:
   - Компетенции (навыки + качества)
   - Результаты оценки
   - Карьерный трек
   - История оценок

**Компоненты:**
- `CompetencyProfileWidget` - текущие компетенции
- `RadarChartResults` - радар навыков/качеств
- `GapAnalysisWidget` - разрыв с требованиями грейда
- `UserCareerTrackView` - карьерный путь

**Данные:**
- `user_skills`, `user_qualities`
- `user_assessment_results`
- `grade_skills`, `grade_qualities`
- `career_tracks`, `career_track_steps`

---

#### **DevelopmentPage (`/development`)**

**Компоненты:**
- `DevelopmentPlanCreator` - создание плана развития
- `DevelopmentTasksManager` - управление задачами развития
- `GapAnalysisWidget` - анализ пробелов

**Функционал:**
- Создание плана развития
- Генерация задач на основе gap-анализа (Edge Function)
- Отслеживание прогресса
- Связь с компетенциями

**Данные:**
- `development_plans`
- `development_tasks`
- `user_assessment_results`

---

#### **TeamPage (`/team`)**

**Доступ:** только менеджеры

**Компоненты:**
- `TeamMembersTable` - список команды
- Фильтры: по должности, грейду, отделу
- Карточки сотрудников
- Быстрый доступ к профилям

**Данные:**
- `users WHERE manager_id = current_user_id`
- Статусы опросов
- Прогресс по компетенциям

---

#### **MeetingsPage (`/meetings`)**

**Компоненты:**
- `MeetingStageManager` - управление этапами (для HR/Admin)
- `MeetingForm` - форма встречи
- История встреч
- `ManagerRespondentApproval` - утверждение (для менеджеров)

**Процесс для сотрудника:**
1. Видит активный этап
2. Заполняет форму встречи
3. Отправляет руководителю
4. Получает обратную связь

**Процесс для руководителя:**
1. Видит заполненные формы подчиненных
2. Добавляет комментарий
3. Утверждает или возвращает на доработку

**Данные:**
- `meeting_stages`
- `one_on_one_meetings`
- `meeting_decisions`

---

#### **MyAssignmentsPage (`/my-assignments`)**

**Вкладки:**
1. **Оценка 360°** - список назначений
2. **Навыки** - опросы по навыкам (убрали, теперь единый опрос)

**Компоненты:**
- `ColleagueSelectionDialog` - выбор коллег для оценки
- `RespondentStatusTable` - статусы respondents
- Кнопки "Пройти опрос"

**Данные:**
- `survey_360_assignments WHERE evaluating_user_id = current_user_id`
- Статусы: 'отправлен запрос', 'approved', 'rejected', 'completed'

---

#### **UnifiedAssessmentPage (`/assessment/:assignmentId`)**

**Единый опрос:** навыки + 360° + выбор коллег

**Компоненты:**
1. **Шаг 1:** Оценка навыков (hard_skill_questions)
2. **Шаг 2:** Оценка 360° (soft_skill_questions)
3. **Шаг 3:** Выбор коллег (только для самооценки)
4. Прогресс-бар
5. Автосохранение (draft)

**Логика:**
- `is_draft = true` → сохранение без финализации
- "Завершить" → `is_draft = false` → триггеры агрегации

**Данные:**
- `survey_360_assignments` (assignment)
- `hard_skill_questions`, `hard_skill_answer_options`
- `soft_skill_questions`, `soft_skill_answer_options`

---

#### **UsersListPage (`/users`)**

**Доступ:** HR, Admin

**Компоненты:**
- Таблица пользователей
- Фильтры: статус, отдел, должность
- Поиск по ФИО, email
- Кнопки: создать, редактировать, деактивировать

**Действия:**
- Создание пользователя → `/users/create`
- Миграция пользователей → `/users/migration`
- Редактирование (inline)
- Деактивация (Edge Function `delete-user`)

**Данные:**
- `users` + расшифровка через API
- `user_roles`
- `departments`, `positions`, `grades`

---

#### **CreateUserPage (`/users/create`)**

**Форма:**
- ФИО (зашифруется)
- Email (зашифруется)
- Телефон
- Табельный номер
- Отдел, должность, грейд
- Руководитель
- Торговая точка
- Дата найма
- Дата рождения
- Роль

**Процесс:**
1. Заполнение формы
2. Шифрование через Yandex Cloud Functions API
3. Вызов Edge Function `create-user`
4. Создание в `users` и `auth_users`
5. Назначение роли в `user_roles`

**Валидация:**
- Email уникален
- Табельный номер уникален
- Все обязательные поля заполнены

---

#### **HRAnalyticsPage (`/hr-analytics`)**

**Доступ:** HR, Admin

**Компоненты:**
- `ProgressDashboard` - общая статистика
- `CompetencyChart` - распределение компетенций
- `GrowthAreasChart` - области роста
- `DynamicsChart` - динамика развития

**Фильтры:**
- По отделам
- По должностям
- По грейдам
- По периодам

**Данные:**
- `user_assessment_results`
- `users`, `departments`, `positions`, `grades`
- Агрегация по командам

---

#### **DiagnosticMonitoringPage (`/hr/diagnostic-monitoring`)**

**Доступ:** HR, Admin

**Компоненты:**
- Список этапов диагностики
- Прогресс по каждому этапу
- Список участников
- Статусы прохождения
- Фильтры и поиск

**Данные:**
- `diagnostic_stages`
- `diagnostic_stage_participants`
- `survey_360_assignments` + статусы
- Прогресс через `calculate_diagnostic_stage_progress()`

---

#### **AdminDashboard (`/admin`)**

**Доступ:** Admin

**Секции:**
1. Справочники (грейды, должности, отделы, навыки, качества)
2. Этапы (диагностика, встречи)
3. Пользователи
4. Безопасность

**Быстрые действия:**
- Управление справочниками
- Создание этапов
- Создание пользователей
- Просмотр аудит-лога

---

#### **StagesPage (`/admin/stages`)**

**Доступ:** Admin, HR

**Компоненты:**
- `DiagnosticStageManager` - этапы диагностики
- `MeetingStageManager` - этапы встреч
- Кнопки создания
- Список участников
- Управление

**Функционал:**
- Создание этапа (период, даты)
- Добавление участников
- Активация/деактивация
- Мониторинг прогресса

---

#### **DiagnosticsAdminPage (`/admin/diagnostics`)**

**Доступ:** Admin

**Вкладки:**
1. Навыки (`SkillsManagement`)
2. Качества (`QualitiesManagement`)
3. Вопросы опросов (`SurveyQuestionsManagement`)
4. Варианты ответов (`AnswerOptionsManagement`)

**Функционал:**
- CRUD для навыков/качеств
- CRUD для вопросов
- CRUD для вариантов ответов
- Связь вопросов с компетенциями

---

#### **SecurityManagementPage (`/security`)**

**Доступ:** Admin

**Вкладки:**
1. **Пользователи** (`UsersManagementTable`)
   - Назначение ролей
   - Аудит действий пользователя
   - История изменений

2. **Роли и права** (`RolesPermissionsManager`)
   - 6 ролей
   - ~80 прав
   - 21 ресурс
   - Матрица прав
   - Статистика

3. **Аудит-лог** (`AuditLogViewer`)
   - Все действия администраторов
   - Фильтры по датам, пользователям, типам
   - Детали изменений

**Компоненты:**
- `RolesPermissionsManager` - управление правами
- `RolePermissionsStats` - статистика по ролям
- `UsersManagementTable` - управление пользователями
- `UserAuditSheet` - детальный аудит пользователя
- `AuditLogViewer` - просмотр логов

**Данные:**
- `user_roles`
- `permissions`, `role_permissions`
- `audit_log`, `admin_activity_logs`

---

## 🧭 НАВИГАЦИЯ

### **AppSidebar**

#### **Основное меню (всегда видно):**

```typescript
const mainMenu = [
  { title: "Главная", url: "/", icon: Home },
  { title: "Профиль", url: "/profile", icon: User },
  { title: "Развитие", url: "/development", icon: TrendingUp },
  { title: "Обучение", url: "/training", icon: BookOpen }
];
```

---

#### **Для сотрудников:**

```typescript
const employeeMenu = [
  { title: "Мои назначения", url: "/my-assignments", icon: CheckSquare },
  { title: "Встречи 1:1", url: "/meetings", icon: Calendar }
];
```

---

#### **Для менеджеров:**

```typescript
const managerMenu = [
  { title: "Моя команда", url: "/team", icon: Users },
  { title: "Отчеты", url: "/manager-reports", icon: FileText },
  { title: "Сравнение", url: "/manager/comparison", icon: BarChart }
];
```

**Условие отображения:**
```typescript
hasRole(currentUser, 'manager') || isManager(currentUser)
```

---

#### **Для HR/Admin:**

```typescript
const hrMenu = [
  { title: "HR-аналитика", url: "/hr-analytics", icon: PieChart },
  { title: "Мониторинг диагностики", url: "/hr/diagnostic-monitoring", icon: Activity },
  { title: "Пользователи", url: "/users", icon: Users }
];
```

**Условие отображения:**
```typescript
hasAnyRole(currentUser, ['admin', 'hr_bp'])
```

---

#### **Для админа:**

```typescript
const adminMenu = [
  { title: "Администрирование", url: "/admin", icon: Settings },
  {
    title: "Справочники",
    icon: Database,
    subMenu: [
      { title: "Грейды", url: "/admin/grades" },
      { title: "Должности", url: "/admin/positions" },
      { title: "Отделы", url: "/admin/departments" },
      { title: "Навыки", url: "/admin/skills" },
      { title: "Качества", url: "/admin/qualities" }
    ]
  },
  { title: "Этапы", url: "/admin/stages", icon: Calendar },
  { title: "Безопасность", url: "/security", icon: Shield }
];
```

**Условие отображения:**
```typescript
hasRole(currentUser, 'admin')
```

---

### **Хлебные крошки (Breadcrumbs)**

**Компонент:** `<Breadcrumbs />`

**Автогенерация на основе URL:**

```typescript
const breadcrumbsMap = {
  '/': 'Главная',
  '/profile': 'Профиль',
  '/development': 'Развитие',
  '/team': 'Моя команда',
  '/meetings': 'Встречи 1:1',
  '/my-assignments': 'Мои назначения',
  '/admin': 'Администрирование',
  '/admin/stages': 'Этапы',
  '/admin/diagnostics': 'Диагностика',
  '/security': 'Безопасность',
  '/users': 'Пользователи',
  '/hr-analytics': 'HR-аналитика'
};
```

**Примеры:**
- `/admin/stages` → Главная > Администрирование > Этапы
- `/security` → Главная > Безопасность
- `/my-assignments` → Главная > Мои назначения
- `/assessment/results/:userId` → Главная > Профиль > Результаты оценки

---

## 🎛️ РАЗДЕЛЫ И ФУНКЦИОНАЛ

### **1. Диагностика компетенций**

#### **Процесс:**

1. **Создание этапа** (HR/Admin):
   - Период: "H1 2024", "H2 2024"
   - Даты: начало, окончание, дедлайн
   - Статус: setup → assessment → completed

2. **Добавление участников**:
   - Выбор пользователей из списка
   - Массовое добавление по отделам/должностям
   - Триггер: `handle_diagnostic_participant_added()`

3. **Автосоздание заданий**:
   - **Самооценка** (self):
     - `survey_360_assignments` → status = 'approved'
     - `tasks` → "Пройти самооценку"
   - **Оценка руководителя** (manager):
     - `survey_360_assignments` → assignment_type = 'manager'
     - `tasks` → "Оценка подчинённого: ФИО"
   - **Выбор коллег** (peer):
     - Сотрудник выбирает сам через форму
     - `survey_360_assignments` → status = 'отправлен запрос'
     - Коллега утверждает/отклоняет

4. **Прохождение опросов**:
   - Единая страница `/assessment/:assignmentId`
   - Навыки (hard_skill_questions) + 360° (soft_skill_questions)
   - Автосохранение (is_draft = true)
   - Завершение (is_draft = false)

5. **Агрегация результатов**:
   - Триггеры: `aggregate_hard_skill_results()`, `aggregate_soft_skill_results()`
   - Запись в `user_assessment_results`
   - Расчет средних: self, manager, peers

6. **Обновление прогресса**:
   - Функция: `calculate_diagnostic_stage_progress()`
   - Обновление статуса этапа
   - Прогресс-бар в UI

---

#### **Данные и таблицы:**

- `diagnostic_stages` - этапы
- `diagnostic_stage_participants` - участники
- `survey_360_assignments` - назначения
- `hard_skill_questions`, `hard_skill_answer_options`
- `soft_skill_questions`, `soft_skill_answer_options`
- `hard_skill_results` - ответы навыки
- `soft_skill_results` - ответы 360°
- `user_assessment_results` - агрегаты
- `tasks` - задачи

---

### **2. Встречи 1:1**

#### **Процесс:**

1. **Создание этапа** (HR/Admin):
   - Период: "Q1 2024", "Q2 2024"
   - Даты: начало, окончание, дедлайн

2. **Добавление участников**:
   - Выбор сотрудников
   - Триггер: `create_meeting_task_for_participant()`

3. **Заполнение формы** (сотрудник):
   - Дата встречи
   - Цели и повестка
   - Разбор предыдущих решений
   - Что добавило/забрало энергии
   - Стопперы в работе
   - Статус: draft

4. **Отправка руководителю**:
   - Статус: submitted
   - Уведомление менеджеру

5. **Утверждение** (руководитель):
   - Просмотр формы
   - Добавление комментария
   - Действия:
     - Утвердить → status = 'approved'
     - Вернуть → status = 'returned' + причина

6. **Решения**:
   - Создание договоренностей (`meeting_decisions`)
   - Отметка выполнения

---

#### **Данные и таблицы:**

- `meeting_stages` - этапы
- `meeting_stage_participants` - участники
- `one_on_one_meetings` - данные встреч
- `meeting_decisions` - решения
- `tasks` - задачи встреч

---

### **3. Карьерные треки**

#### **Структура:**

1. **Типы треков** (`track_types`):
   - Продажи
   - Управление
   - Экспертиза

2. **Треки** (`career_tracks`):
   - Название: "Продавец → Старший продавец"
   - Целевая должность
   - Длительность (месяцы)

3. **Шаги трека** (`career_track_steps`):
   - Грейд на каждом шаге
   - Порядковый номер
   - Описание
   - Длительность шага

4. **Прогресс пользователя** (`user_career_progress`):
   - Текущий шаг
   - Дата начала
   - Дата завершения

---

#### **Gap-анализ:**

Сравнение текущих компетенций с требованиями следующего грейда:

```sql
-- Навыки
SELECT 
  s.name,
  COALESCE(us.current_level, 0) as current_level,
  gs.target_level,
  gs.target_level - COALESCE(us.current_level, 0) as gap
FROM grade_skills gs
JOIN skills s ON s.id = gs.skill_id
LEFT JOIN user_skills us ON us.skill_id = gs.skill_id AND us.user_id = :user_id
WHERE gs.grade_id = :next_grade_id
  AND COALESCE(us.current_level, 0) < gs.target_level;

-- Аналогично для качеств
```

**Визуализация:**
- Таблица с пробелами
- Радар-чарт (текущий vs требуемый)
- Рекомендации по развитию

---

### **4. Задачи и развитие**

#### **Типы задач:**

| task_type | Описание | Создание |
|-----------|----------|----------|
| `assessment` | Общая оценка | Вручную или автоматически |
| `diagnostic_stage` | Самооценка диагностики | `handle_diagnostic_participant_added()` |
| `survey_360_evaluation` | Оценка коллеги/руководителя | `handle_diagnostic_participant_added()` |
| `meeting` | Встреча 1:1 | `create_meeting_task_for_participant()` |

---

#### **Категории:**

- `Диагностика` - опросы компетенций
- `Встречи 1:1` - встречи с руководителем
- `Оценка 360` - оценка коллег

---

#### **Статусы:**

- `pending` - ожидает выполнения
- `in_progress` - в процессе
- `completed` - завершена

---

#### **Приоритеты:**

- `low` - низкий
- `normal` - обычный
- `high` - высокий

---

#### **assignment_type в задачах:**

**КРИТИЧЕСКИ ВАЖНО:** `assignment_type` в задачах должен соответствовать `assignment_type` в `survey_360_assignments`

- `self` - самооценка
- `manager` - оценка руководителя
- `peer` - оценка коллеги

**Инварианты:**
```sql
-- Проверка соответствия
SELECT t.id, t.assignment_type, sa.assignment_type
FROM tasks t
JOIN survey_360_assignments sa ON t.assignment_id = sa.id
WHERE t.assignment_type != sa.assignment_type;
-- Должно вернуть 0 строк
```

---

#### **Планы развития:**

**Создание:**
1. Анализ пробелов компетенций
2. Выбор навыков/качеств для развития
3. Генерация задач через Edge Function `generate-development-tasks`

**Шаблоны задач** (`development_tasks`):
- Привязка к компетенции
- Привязка к уровню
- Название, цель, как выполнить
- Измеримый результат

**Персонализация:**
- Edge Function берет шаблоны
- Подставляет конкретные компетенции пользователя
- Создает задачи в `tasks`

---

### **5. Аналитика и отчеты**

#### **HR-аналитика (`/hr-analytics`)**

**Дашборды:**

1. **Общая статистика:**
   - Количество сотрудников
   - Средний уровень компетенций
   - Прогресс по отделам
   - Завершенные оценки

2. **Распределение компетенций:**
   - По уровням (1-5)
   - По категориям навыков
   - По качествам
   - Heatmap

3. **Области роста:**
   - Навыки с наибольшим пробелом
   - Качества с низкими оценками
   - Рекомендации

4. **Динамика развития:**
   - Изменение уровней по периодам
   - Тренды по командам
   - Прогресс по карьерным трекам

**Фильтры:**
- Отделы
- Должности
- Грейды
- Менеджеры
- Периоды оценки (H1/H2)

**Экспорт:**
- CSV
- Excel
- PDF отчеты

---

#### **Отчеты руководителя (`/manager-reports`)**

**Данные по команде:**
- Список сотрудников
- Текущие компетенции
- Прогресс по грейдам
- Задачи и дедлайны
- Результаты встреч 1:1

**Сравнение сотрудников (`/manager/comparison`):**
- Выбор 2+ сотрудников
- Сравнение компетенций
- Радар-чарты
- Таблица различий

---

#### **Мониторинг диагностики (`/hr/diagnostic-monitoring`)**

**Данные:**
- Список всех этапов
- Прогресс по этапам
- Участники и статусы
- Проблемные зоны (не прошли опросы)

**Действия:**
- Отправка напоминаний
- Добавление/удаление участников
- Завершение этапа

---

### **6. Безопасность**

#### **Управление ролями и правами (`/security`)**

**Роли (6 шт.):**

| Роль | Код | Описание | Иконка |
|------|-----|----------|--------|
| Администратор | `admin` | Полный доступ ко всему | 👑 |
| HR BP | `hr_bp` | Управление персоналом, аналитика | 👔 |
| Руководитель | `manager` | Команда, отчеты, утверждения | 👨‍💼 |
| Сотрудник | `employee` | Свои данные, опросы, развитие | 👤 |
| Модератор | `moderator` | Модерация контента | 🛡️ |
| Пользователь | `user` | Базовый доступ | 📋 |

---

**Ресурсы (21 категория):**

| Ресурс | Описание | Примеры прав |
|--------|----------|--------------|
| `audit` | Аудит и логи | read, export |
| `career` | Карьерные треки | read, update |
| `diagnostics` | Диагностика | create, read, manage, export |
| `tasks` | Задачи | read, create, update, delete |
| `team` | Команда | read, manage |
| `development` | Развитие | read, create, manage |
| `users` | Пользователи | read, create, update, delete, assign_roles |
| `profiles` | Профили | read, update |
| `surveys` | Опросы | read, create, assign, view_results |
| `meetings` | Встречи 1:1 | read, create, approve |
| `analytics` | Аналитика | read, export |
| `admin` | Администрирование | full_access |
| `security` | Безопасность | manage_roles, view_audit |
| `settings` | Настройки | read, update |
| `reports` | Отчеты | read, export |
| `kpi` | KPI | read, manage |
| `achievements` | Достижения | read, grant |
| `certifications` | Сертификации | read, manage |
| `grades` | Грейды | read, manage |
| `competencies` | Компетенции | read, manage |
| `system` | Система | configure |

---

**Права (~80 шт.):**

Формат: `{resource}:{action}`

**Примеры:**
- `users:read` - просмотр пользователей
- `users:create` - создание пользователей
- `diagnostics:create` - создание этапов диагностики
- `diagnostics:manage` - управление диагностикой
- `tasks:update` - обновление задач
- `team:manage` - управление командой
- `analytics:export` - экспорт аналитики
- `security:manage_roles` - управление ролями

---

**Распределение прав:**

| Роль | Прав | % | Примеры |
|------|------|---|---------|
| `admin` | 80 | 100% | Все права |
| `hr_bp` | ~50 | 62% | users:*, diagnostics:*, analytics:*, team:read |
| `manager` | ~35 | 44% | team:*, meetings:*, reports:read, tasks:read |
| `employee` | ~15 | 19% | profiles:read, surveys:read, tasks:read, development:read |
| `moderator` | ~20 | 25% | users:read, audit:read, reports:read |
| `user` | ~10 | 13% | profiles:read, tasks:read |

---

#### **Аудит-лог**

**Типы действий:**
- `CREATE` - создание
- `UPDATE` - изменение
- `DELETE` - удаление

**Записываемые данные:**
- Кто выполнил (admin_id)
- Над кем (target_user_id)
- Что изменил (field)
- Старое и новое значение
- Дополнительные детали (JSONB)
- Время

**Просмотр:**
- Таблица с фильтрами
- Поиск по пользователям, датам, типам
- Детальный просмотр изменений
- Экспорт

---

### **7. Администрирование**

#### **Справочники**

**Список справочников:**

| ID | Название | Таблица |
|----|----------|---------|
| `grades` | Грейды | grades |
| `positions` | Должности | positions |
| `position-categories` | Категории должностей | position_categories |
| `departments` | Отделы | departments |
| `skills` | Навыки | skills |
| `skill-categories` | Категории навыков | category_skills |
| `qualities` | Качества | qualities |
| `competency-levels` | Уровни компетенций | competency_levels |
| `certifications` | Сертификации | certifications |
| `manufacturers` | Производители | manufacturers |
| `track-types` | Типы треков | track_types |
| `trade-points` | Торговые точки | trade_points |
| `hard-skill-questions` | Вопросы (навыки) | hard_skill_questions |
| `soft-skill-questions` | Вопросы (360°) | soft_skill_questions |
| `hard-skill-answers` | Ответы (навыки) | hard_skill_answer_options |
| `soft-skill-answers` | Ответы (360°) | soft_skill_answer_options |

---

**Функционал:**
- Просмотр таблицы
- Добавление записи
- Редактирование inline
- Удаление (с проверкой зависимостей)
- Поиск и фильтры
- Сортировка

---

#### **Связь грейдов и компетенций**

**Страница:** `/admin/grades`

**Функционал:**
1. Просмотр грейдов
2. Редактирование грейда
3. **Управление компетенциями:**
   - Добавление навыков к грейду (`grade_skills`)
   - Установка целевого уровня (1-5)
   - Добавление качеств к грейду (`grade_qualities`)
   - Удаление компетенций

**UI:**
- Таблица грейдов
- Модальное окно "Компетенции грейда"
- Две вкладки: Навыки, Качества
- Селект навыка + слайдер уровня
- Кнопка "Добавить"
- Список добавленных с кнопкой удаления

---

#### **Управление вопросами**

**Страница:** `/admin/diagnostics`

**Вкладки:**
1. **Навыки** - CRUD для skills
2. **Качества** - CRUD для qualities
3. **Вопросы** - hard_skill_questions, soft_skill_questions
4. **Варианты ответов** - answer_options

**Функционал вопросов:**
- Создание вопроса
- Связь с компетенцией
- Установка порядка отображения
- Поведенческие индикаторы (для 360°)
- Категории вопросов

---

#### **Очистка данных**

**Компонент:** `DataCleanupWidget`

**Функционал:**
- Очистка всех результатов диагностики
- Очистка встреч
- Очистка задач
- Вызов `admin_cleanup_all_data()`

**Безопасность:**
- Только для админа
- Подтверждение действия
- Логирование в audit_log

---

## 🔄 EDGE FUNCTIONS

### **4 Edge Functions**

#### **1. `custom-login`**

**Путь:** `supabase/functions/custom-login/index.ts`

**Назначение:** аутентификация пользователя и создание сессии

**Процесс:**
1. Принимает `{ email, password }`
2. Расшифровывает email из `users` через Yandex API
3. Ищет совпадение в `auth_users`
4. Проверяет пароль через BCrypt
5. Создает запись в `admin_sessions`
6. Возвращает `{ success: true, session: {...}, user: {...} }`

**Код:**
```typescript
const { email, password } = await req.json();

// 1. Расшифровка email
const decryptResponse = await fetch(`${YANDEX_API}/decrypt`, {
  method: 'POST',
  body: JSON.stringify({ email: encryptedEmail })
});
const { email: decryptedEmail } = await decryptResponse.json();

// 2. Поиск пользователя
const { data: authUser } = await supabase
  .from('auth_users')
  .select('*')
  .eq('id', userId)
  .single();

// 3. Проверка пароля
const isValid = await bcrypt.compare(password, authUser.password_hash);
if (!isValid) return new Response('Invalid credentials', { status: 401 });

// 4. Создание сессии
const { data: session } = await supabase
  .from('admin_sessions')
  .insert({ user_id: userId, email: decryptedEmail })
  .select()
  .single();

return new Response(JSON.stringify({ success: true, session, user }));
```

---

#### **2. `create-user`**

**Путь:** `supabase/functions/create-user/index.ts`

**Назначение:** создание пользователя с шифрованием и хешированием

**Процесс:**
1. Принимает данные формы (уже зашифрованные)
2. Генерирует временный пароль или использует переданный
3. Хеширует пароль через BCrypt
4. Создает запись в `users`
5. Создает запись в `auth_users`
6. Назначает роль в `user_roles`
7. Возвращает ID пользователя

**Код:**
```typescript
const {
  first_name, last_name, middle_name, email, // зашифрованные
  phone, employee_number, department_id, position_id, grade_id,
  manager_id, trade_point_id, hire_date, birth_date, role
} = await req.json();

// 1. Генерация пароля
const password = generateRandomPassword(); // или из запроса
const passwordHash = await bcrypt.hash(password, 10);

// 2. Создание в users
const { data: user, error: userError } = await supabase
  .from('users')
  .insert({
    first_name, last_name, middle_name, email,
    phone, employee_number, department_id, position_id,
    grade_id, manager_id, trade_point_id, hire_date, birth_date
  })
  .select()
  .single();

if (userError) throw userError;

// 3. Создание в auth_users
const { error: authError } = await supabase
  .from('auth_users')
  .insert({
    id: user.id,
    email: email, // зашифрованный
    password_hash: passwordHash
  });

if (authError) throw authError;

// 4. Назначение роли
const { error: roleError } = await supabase
  .from('user_roles')
  .insert({
    user_id: user.id,
    role: role || 'employee'
  });

if (roleError) throw roleError;

return new Response(JSON.stringify({ success: true, user_id: user.id }));
```

---

#### **3. `delete-user`**

**Путь:** `supabase/functions/delete-user/index.ts`

**Назначение:** деактивация пользователя и очистка связанных данных

**Процесс:**
1. Принимает `{ user_id }`
2. Устанавливает `users.status = false`
3. Деактивирует `auth_users.is_active = false`
4. Опционально: удаление связанных данных (задачи, результаты)
5. Логирует в audit_log
6. Возвращает подтверждение

**Код:**
```typescript
const { user_id } = await req.json();

// 1. Деактивация в users
await supabase
  .from('users')
  .update({ status: false })
  .eq('id', user_id);

// 2. Деактивация в auth_users
await supabase
  .from('auth_users')
  .update({ is_active: false })
  .eq('id', user_id);

// 3. Аудит
await supabase.rpc('log_admin_action', {
  _admin_id: currentAdminId,
  _target_user_id: user_id,
  _action_type: 'DELETE',
  _details: { reason: 'User deactivated' }
});

return new Response(JSON.stringify({ success: true }));
```

**Замечание:** физическое удаление не используется из-за зависимостей.

---

#### **4. `generate-development-tasks`**

**Путь:** `supabase/functions/generate-development-tasks/index.ts`

**Назначение:** генерация персонализированных задач развития

**Процесс:**
1. Принимает `{ user_id, plan_id, competency_gaps }`
2. Получает шаблоны из `development_tasks` для указанных компетенций
3. Создает задачи в `tasks` с подставленными данными
4. Связывает с планом развития
5. Возвращает список созданных задач

**Код:**
```typescript
const { user_id, plan_id, competency_gaps } = await req.json();
// competency_gaps = [{ skill_id, current_level, target_level }, ...]

const createdTasks = [];

for (const gap of competency_gaps) {
  // 1. Получение шаблонов
  const { data: templates } = await supabase
    .from('development_tasks')
    .select('*')
    .eq('skill_id', gap.skill_id)
    .lte('competency_level_id', gap.target_level);

  // 2. Создание задач
  for (const template of templates) {
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        user_id,
        title: template.task_name,
        description: template.task_goal,
        task_type: 'development',
        category: 'Развитие',
        competency_ref: gap.skill_id,
        kpi_expected_level: gap.target_level,
        kpi_result_level: gap.current_level
      })
      .select()
      .single();

    createdTasks.push(task);
  }
}

return new Response(JSON.stringify({ success: true, tasks: createdTasks }));
```

---

## 📊 API ЭНДПОИНТЫ

### **Yandex Cloud Functions**

**Base URL:**
```
https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g
```

---

#### **POST `/encrypt`**

**Описание:** шифрование данных

**Request:**
```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "middle_name": "Иванович",
  "email": "ivanov@example.com"
}
```

**Response:**
```json
{
  "first_name": "base64_encrypted_string_1",
  "last_name": "base64_encrypted_string_2",
  "middle_name": "base64_encrypted_string_3",
  "email": "base64_encrypted_string_4"
}
```

---

#### **POST `/decrypt`**

**Описание:** расшифровка данных

**Request:**
```json
{
  "first_name": "base64_encrypted_string_1",
  "last_name": "base64_encrypted_string_2",
  "middle_name": "base64_encrypted_string_3",
  "email": "base64_encrypted_string_4"
}
```

**Response:**
```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "middle_name": "Иванович",
  "email": "ivanov@example.com"
}
```

---

### **Supabase Edge Functions**

**Base URL:**
```
https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1
```

---

#### **POST `/custom-login`**

**Описание:** аутентификация

**Request:**
```json
{
  "email": "ivanov@example.com",
  "password": "password123"
}
```

**Response (успех):**
```json
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "user_id": "user-uuid",
    "email": "ivanov@example.com",
    "expires_at": "2024-12-02T10:00:00Z"
  },
  "user": {
    "id": "user-uuid",
    "first_name": "Иван",
    "last_name": "Иванов",
    "role": "employee"
  }
}
```

**Response (ошибка):**
```json
{
  "error": "Invalid credentials"
}
```

---

#### **POST `/create-user`**

**Описание:** создание пользователя

**Request:**
```json
{
  "first_name": "encrypted_base64",
  "last_name": "encrypted_base64",
  "middle_name": "encrypted_base64",
  "email": "encrypted_base64",
  "phone": "+79001234567",
  "employee_number": "EMP001",
  "department_id": "dept-uuid",
  "position_id": "pos-uuid",
  "grade_id": "grade-uuid",
  "manager_id": "manager-uuid",
  "hire_date": "2024-01-15",
  "role": "employee"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": "new-user-uuid"
}
```

---

#### **POST `/delete-user`**

**Описание:** деактивация пользователя

**Request:**
```json
{
  "user_id": "user-uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

#### **POST `/generate-development-tasks`**

**Описание:** генерация задач развития

**Request:**
```json
{
  "user_id": "user-uuid",
  "plan_id": "plan-uuid",
  "competency_gaps": [
    {
      "skill_id": "skill-uuid",
      "current_level": 2,
      "target_level": 4
    },
    {
      "quality_id": "quality-uuid",
      "current_level": 3,
      "target_level": 5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid-1",
      "title": "Развитие навыка продаж",
      "description": "...",
      "competency_ref": "skill-uuid"
    },
    {
      "id": "task-uuid-2",
      "title": "Улучшение коммуникации",
      "description": "...",
      "competency_ref": "quality-uuid"
    }
  ]
}
```

---

## 📝 ЗАКЛЮЧЕНИЕ

Система представляет собой комплексное решение для управления компетенциями и развитием сотрудников с следующими ключевыми характеристиками:

### **Основные возможности:**

1. **Полный цикл диагностики:** самооценка + оценка руководителя + оценка коллег (360°)
2. **Автоматизация процессов:** автосоздание заданий, агрегация результатов, обновление профилей
3. **Карьерное развитие:** треки, gap-анализ, персонализированные планы
4. **Встречи 1:1:** структурированный процесс с утверждением и решениями
5. **Аналитика:** дашборды, отчеты, динамика, сравнения
6. **Безопасность:** шифрование данных, RLS, ролевая модель, аудит

### **Технологический стек:**

- **Frontend:** React 18.3 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL) + Edge Functions
- **Шифрование:** Yandex Cloud Functions API
- **Аутентификация:** Кастомная через admin_sessions + BCrypt

### **Безопасность:**

- 6 ролей с детальными правами (~80 прав)
- RLS на всех таблицах
- Шифрование персональных данных (ФИО, email)
- Хеширование паролей (BCrypt)
- Полный аудит действий

### **Масштабируемость:**

- 49 таблиц с нормализованной структурой
- 42 функции для бизнес-логики
- 6 активных триггеров для автоматизации
- Модульная архитектура фронтенда

Система готова к production использованию и может масштабироваться для организаций любого размера.
