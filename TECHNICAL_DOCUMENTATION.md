# Техническое и функциональное описание проекта
## Система управления компетенциями и развитием персонала

Версия: 1.0  
Дата: 2025-01-29

---

## 1. ОБЩАЯ СТРУКТУРА

### 1.1 Назначение проекта
Комплексная веб-система для управления человеческими ресурсами, компетенциями и карьерным развитием сотрудников. Система включает:

- **360° оценку** — всесторонняя оценка качеств сотрудника от коллег, руководителя и самооценка
- **Оценку профессиональных навыков** — диагностика уровня владения ключевыми компетенциями
- **Карьерные треки** — структурированные пути развития с чёткими этапами и требованиями
- **Встречи 1:1** — регулярные встречи руководителя с сотрудником для обратной связи
- **Диагностические этапы** — периодические циклы оценки персонала (H1/H2)
- **Планы развития** — индивидуальные задачи и цели для роста компетенций
- **HR-аналитику** — агрегированные отчёты и метрики по персоналу

### 1.2 Основные модули
1. **Главная панель** — дашборд с задачами, быстрыми действиями и виджетами прогресса
2. **Профиль** — персональная информация, грейд, позиция, компетенции
3. **Развитие** — карьерные треки, задачи, опросники, рекомендации
4. **Обучение** — образовательные материалы и сертификации
5. **Встречи** — планирование и проведение встреч 1:1
6. **Команда** — просмотр коллег и подчинённых
7. **Лента** — активности и обновления
8. **Административная панель** — управление справочниками, пользователями, этапами
9. **Безопасность** — управление ролями, правами, аудит

---

## 2. МАРШРУТЫ И ДОСТУП

### 2.1 Публичные маршруты
| URL | Назначение | Компонент |
|-----|-----------|-----------|
| `/login` | Страница авторизации | `LoginPage` |

### 2.2 Защищённые маршруты (требуется авторизация)

#### Пользовательские маршруты
| URL | Назначение | Роли | Компонент |
|-----|-----------|------|-----------|
| `/` | Главная панель с дашбордом | Все | `Index` |
| `/profile` | Профиль пользователя | Все | `ProfilePage` |
| `/development` | Развитие (треки, задачи, опросы) | Все | `DevelopmentPage` |
| `/training` | Обучение и сертификации | Все | `TrainingPage` |
| `/meetings` | Встречи 1:1 | Все | `MeetingsPage` |
| `/team` | Команда и коллеги | Все | `TeamPage` |
| `/feed` | Лента активности | Все | `FeedPage` |
| `/my-assignments` | Мои задания (опросы) | Все | `MyAssignmentsPage` |

#### Опросники
| URL | Назначение | Роли | Компонент |
|-----|-----------|------|-----------|
| `/skill-survey/questions/:assignmentId` | Прохождение опроса навыков | Все | `SkillSurveyQuestionsPage` |
| `/skill-survey/results` | Результаты опроса навыков | Все | `SkillSurveyResultsPage` |
| `/survey-360/questions/:assignmentId` | Прохождение опроса 360° | Все | `Survey360QuestionsPage` |
| `/survey-360-results` | Результаты опроса 360° | Все | `Survey360ResultsPage` |

#### Менеджерские маршруты
| URL | Назначение | Роли | Компонент |
|-----|-----------|------|-----------|
| `/manager-reports` | Отчёты по команде | Manager, HR, Admin | `ManagerReportsPage` |
| `/manager/comparison` | Сравнение сотрудников | Manager, HR, Admin | `ManagerComparisonPage` |

#### HR-маршруты
| URL | Назначение | Роли | Компонент |
|-----|-----------|------|-----------|
| `/hr-analytics` | HR-аналитика | HR_BP, Admin | `HRAnalyticsPage` |
| `/hr/diagnostic-monitoring` | Мониторинг диагностики | HR_BP, Admin | `DiagnosticMonitoringPage` |

#### Административные маршруты
| URL | Назначение | Роли | Компонент |
|-----|-----------|------|-----------|
| `/admin` | Панель администратора | Admin | `AdminDashboard` |
| `/admin/stages` | Управление этапами | Admin | `StagesPage` |
| `/admin/diagnostics` | Управление диагностикой | Admin | `DiagnosticsAdminPage` |
| `/admin/:tableId` | Справочники | Admin | `ReferenceTablePage` |
| `/users` | Список пользователей | Admin | `UsersListPage` |
| `/users/create` | Создание пользователя | Admin | `CreateUserPage` |
| `/users/migration` | Миграция пользователей | Admin | `UsersMigrationPage` |
| `/security` | Управление безопасностью | Admin | `SecurityManagementPage` |

### 2.3 Архитектура навигации

```
App (AuthGuard)
├── Sidebar (AppSidebar)
│   ├── Главная (/)
│   ├── Профиль (/profile)
│   ├── Развитие (/development)
│   │   ├── Карьерный трек
│   │   ├── Задачи
│   │   ├── Опросники
│   │   └── Рекомендации
│   ├── Обучение (/training)
│   ├── Встречи (/meetings)
│   ├── Команда (/team)
│   ├── Лента (/feed)
│   └── [Для Admin]
│       ├── Администрирование (/admin)
│       ├── Пользователи (/users)
│       ├── Безопасность (/security)
│       └── HR-аналитика (/hr-analytics)
└── Main Content Area
```

---

## 3. МОДУЛИ И ФУНКЦИОНАЛЬНОСТЬ

### 3.1 Главная панель (Index / Dashboard)

**URL:** `/`  
**Назначение:** Персональный дашборд с обзором активности и прогресса

**Функциональность:**
- Приветствие с именем пользователя
- Виджет **QuickActions** с быстрыми действиями
- Список **TaskList** с текущими задачами пользователя
- **SkillsGradeWidget** — прогресс по навыкам
- **QualitiesGradeWidget** — прогресс по качествам
- **CareerProgressWidget** — текущий карьерный трек и прогресс
- Кнопка "Все задачи" для перехода в `/development`

**Связанные таблицы:**
- `users`, `tasks`, `user_skills`, `user_qualities`, `career_tracks`

---

### 3.2 Профиль (ProfilePage)

**URL:** `/profile`  
**Назначение:** Просмотр и редактирование личной информации

**Функциональность:**
- Отображение личных данных (ФИО, email, должность, грейд)
- Информация о подразделении и руководителе
- История изменений грейда
- Компетенции и сертификации

**Связанные таблицы:**
- `users`, `grades`, `positions`, `departments`, `user_skills`, `user_qualities`

---

### 3.3 Развитие (DevelopmentPage)

**URL:** `/development`  
**Назначение:** Управление карьерным треком, задачами и опросами

**Подразделы (табы):**

1. **Карьерный трек** (`CareerTrackDetails`)
   - Текущий карьерный трек и прогресс
   - Шаги трека, требования, сроки
   - Переход между шагами
   - Таблицы: `career_tracks`, `career_track_steps`, `user_skills`, `user_qualities`

2. **Задачи** (`TasksManager`)
   - Список задач развития
   - Фильтрация по статусу, категории, приоритету
   - Редактирование задач
   - Таблицы: `tasks`, `development_tasks`

3. **Опросники** (`SurveyAccessWidget`)
   - Доступ к опросам 360° и навыков
   - Статус выполнения опросов
   - Навигация к вопросам
   - Таблицы: `survey_360_assignments`, `skill_survey_assignments`

4. **Рекомендации** (`CareerTracksWidget`)
   - Рекомендуемые карьерные треки
   - Анализ gap analysis (разрыв компетенций)
   - Выбор и активация трека
   - Таблицы: `career_tracks`, `grade_skills`, `grade_qualities`

---

### 3.4 Опрос профессиональных навыков (SkillSurveyPage, SkillSurveyQuestionsPage)

**URL:** `/skill-survey`, `/skill-survey/questions/:assignmentId`  
**Назначение:** Оценка уровня профессиональных навыков

**Этапы:**

1. **Страница статуса** (`SkillSurveyPage`)
   - Отображение статуса самооценки
   - Отображение статуса оценки руководителя
   - Кнопка "Начать самооценку"
   - Индикация завершения и доступа к результатам

2. **Прохождение опроса** (`SkillSurveyQuestionsPage`)
   - Вопросы по 1 на экран
   - Прогресс-бар (вопрос X из N)
   - Варианты ответов (step 1-5)
   - Поле для комментария
   - Навигация "Назад" / "Следующий вопрос" / "Завершить"
   - Автосохранение ответов
   - Восстановление предыдущих ответов при возврате

3. **Результаты** (`SkillSurveyResultsPage`)
   - Агрегированные данные по навыкам
   - Сравнение самооценки и оценки руководителя
   - Диаграммы и графики
   - Экспорт в PDF/CSV

**Логика:**
- При добавлении участника в `diagnostic_stage_participants` триггер `assign_surveys_to_diagnostic_participant` создаёт:
  - Самооценку: `evaluated_user_id = evaluating_user_id = user_id`
  - Оценку руководителя: `evaluated_user_id = user_id`, `evaluating_user_id = manager_id`
- Вопросы фильтруются по `grade_skills` (навыки грейда сотрудника)
- После завершения опроса:
  - Триггер `update_skill_assignment_on_survey_completion` обновляет статус assignment на "выполнено"
  - Триггер `update_user_skills_from_survey` обновляет `user_skills`
  - Триггер `insert_assessment_results` вставляет агрегированные данные в `user_assessment_results`

**Связанные таблицы:**
- `skill_survey_assignments`, `skill_survey_questions`, `skill_survey_answer_options`
- `skill_survey_results`, `skills`, `grade_skills`, `user_skills`, `user_assessment_results`

---

### 3.5 Опрос 360° (Survey360Page, Survey360QuestionsPage)

**URL:** `/survey-360`, `/survey-360/questions/:assignmentId`  
**Назначение:** Всесторонняя оценка качеств сотрудника

**Этапы:**

1. **Страница статуса** (`Survey360Page`)
   - Статус самооценки
   - Статус оценки руководителя
   - Статус оценок коллег (минимум 1)
   - Кнопка "Начать самооценку"
   - Доступ к результатам после завершения всех оценок

2. **Выбор оценивающих** (опционально, на стадии разработки)
   - Форма выбора коллег для оценки
   - Автоматическое создание `survey_360_assignments`

3. **Прохождение опроса** (`Survey360QuestionsPage`)
   - Вопросы по 1 на экран
   - Категории вопросов (behavioral_indicators)
   - Варианты ответов (1-5)
   - Поле для комментария (опционально анонимного)
   - Прогресс-бар
   - Навигация "Назад" / "Следующий вопрос" / "Завершить"
   - Автосохранение и восстановление ответов

4. **Результаты** (`Survey360ResultsPage`)
   - Агрегированные оценки по качествам
   - Визуализация сильных/слабых сторон
   - Анонимные комментарии
   - Экспорт данных

**Логика:**
- Аналогично skill survey, триггер создаёт assignments при добавлении участника
- Вопросы фильтруются по `grade_qualities`
- Поддержка анонимных комментариев (`is_anonymous_comment`)
- После завершения:
  - Обновление статуса assignment
  - Обновление `user_qualities`
  - Агрегация в `user_assessment_results`

**Связанные таблицы:**
- `survey_360_assignments`, `survey_360_questions`, `survey_360_answer_options`
- `survey_360_results`, `qualities`, `grade_qualities`, `user_qualities`, `user_assessment_results`

---

### 3.6 Диагностические этапы (DiagnosticsAdminPage, DiagnosticMonitoringPage)

**URL:** `/admin/diagnostics`, `/hr/diagnostic-monitoring`  
**Назначение:** Управление периодическими этапами оценки персонала

**Функциональность:**

1. **Создание этапа** (Admin)
   - Название периода (например, "H1 2025")
   - Даты: start_date, end_date, deadline_date
   - Статус: setup, assessment, completed
   - Evaluation period (H1/H2)
   - Триггер `log_diagnostic_stage_changes` записывает в `admin_activity_logs`

2. **Добавление участников**
   - Выбор сотрудников для диагностики
   - Триггер `assign_surveys_to_diagnostic_participant` создаёт:
     - `skill_survey_assignments`
     - `survey_360_assignments`
   - Триггер `create_diagnostic_task_for_participant` создаёт задачу в `tasks`

3. **Мониторинг прогресса** (HR)
   - Таблица участников с прогрессом
   - Статус: "отправлен запрос", "выполнено"
   - Процент завершения (функция `calculate_diagnostic_stage_progress`)
   - Автообновление статуса этапа (триггер `update_diagnostic_stage_status`)

4. **Завершение этапа**
   - Автоматически при достижении 100% прогресса
   - Статус меняется на "completed"

**Связанные таблицы:**
- `diagnostic_stages`, `diagnostic_stage_participants`
- `skill_survey_assignments`, `survey_360_assignments`
- `tasks`, `admin_activity_logs`

**Функции:**
- `calculate_diagnostic_stage_progress(stage_id)` — вычисление процента завершения
- `update_diagnostic_stage_status()` — триггер обновления статуса
- `assign_surveys_to_diagnostic_participant()` — триггер создания заданий

---

### 3.7 Встречи 1:1 (MeetingsPage, MeetingStageManager)

**URL:** `/meetings`  
**Назначение:** Проведение регулярных встреч сотрудника и руководителя

**Функциональность:**

1. **Создание этапа встреч** (Admin/HR)
   - Период, даты, дедлайн
   - Добавление участников в `meeting_stage_participants`
   - Триггер `create_meeting_task_for_participant` создаёт задачу

2. **Заполнение формы встречи** (Сотрудник)
   - Дата встречи
   - Что даёт энергию (energy_gained)
   - Что забирает энергию (energy_lost)
   - Стопперы (stoppers)
   - Цели и повестка (goal_and_agenda)
   - Разбор предыдущих решений (previous_decisions_debrief)
   - Статус: draft → submitted

3. **Согласование** (Руководитель)
   - Просмотр формы
   - Комментарий руководителя (manager_comment)
   - Утверждение (approved) или возврат (returned)
   - Триггер `update_meeting_task_status` обновляет задачу

4. **Решения** (`meeting_decisions`)
   - Список решений, принятых на встрече
   - Отслеживание выполнения

**Связанные таблицы:**
- `meeting_stages`, `meeting_stage_participants`
- `one_on_one_meetings`, `meeting_decisions`, `tasks`

---

### 3.8 Карьерные треки (CareerTracksWidget, CareerTrackDetails)

**Назначение:** Структурированные пути карьерного развития

**Функциональность:**

1. **Просмотр доступных треков**
   - Типы треков (вертикальный, горизонтальный, экспертный)
   - Целевая позиция
   - Длительность
   - Gap analysis (разрыв компетенций)

2. **Детали трека** (`CareerTrackDetails`)
   - Шаги трека (`career_track_steps`)
   - Требования по навыкам и качествам для каждого шага
   - Прогресс пользователя
   - Текущий шаг и следующий шаг

3. **Рекомендации**
   - Алгоритм подбора треков на основе текущих компетенций
   - Сортировка по релевантности

**Связанные таблицы:**
- `career_tracks`, `career_track_steps`, `track_types`
- `user_skills`, `user_qualities`, `grade_skills`, `grade_qualities`

---

### 3.9 Задачи развития (TasksManager, DevelopmentTasksManager)

**Назначение:** Управление индивидуальными задачами развития

**Функциональность:**

1. **Список задач**
   - Фильтрация: статус, категория, приоритет
   - Deadline, описание
   - Связь с компетенциями (competency_ref)

2. **Создание задачи**
   - Название, описание
   - Категория (Диагностика, Встречи 1:1, Обучение, Развитие)
   - Приоритет (normal, high, urgent)
   - Deadline
   - Связь с assignment

3. **Редактирование и завершение**
   - Обновление статуса (pending, in_progress, completed)
   - KPI (expected_level, result_level)

4. **Автоматическое создание**
   - Триггеры создают задачи при:
     - Добавлении в diagnostic_stage_participants
     - Добавлении в meeting_stage_participants
     - Создании survey_360_assignments
     - Создании skill_survey_assignments

**Связанные таблицы:**
- `tasks`, `development_tasks`, `development_plans`

---

### 3.10 Административная панель (AdminDashboard, ReferenceTablePage)

**URL:** `/admin`, `/admin/:tableId`  
**Назначение:** Управление справочниками и системными настройками

**Справочники:**
- **Пользователи** (`users`) — управление сотрудниками
- **Роли** (`user_roles`) — назначение ролей
- **Разрешения** (`permissions`, `role_permissions`)
- **Грейды** (`grades`) — иерархия должностных уровней
- **Позиции** (`positions`) — должности
- **Подразделения** (`departments`)
- **Торговые точки** (`trade_points`) — с координатами
- **Навыки** (`skills`) — справочник компетенций
- **Категории навыков** (`category_skills`)
- **Качества** (`qualities`) — личностные качества
- **Грейд-навыки** (`grade_skills`) — требования грейда
- **Грейд-качества** (`grade_qualities`)
- **Вопросы 360** (`survey_360_questions`)
- **Вопросы навыков** (`skill_survey_questions`)
- **Варианты ответов** (`survey_360_answer_options`, `skill_survey_answer_options`)
- **Карьерные треки** (`career_tracks`, `career_track_steps`)
- **Сертификации** (`certifications`)
- **Производители** (`manufacturers`)

**Функциональность:**
- CRUD операции для всех справочников
- Интерфейс `ReferenceTableView` с настройкой через `tableConfig.ts`
- Логирование изменений в `admin_activity_logs`

---

### 3.11 Безопасность (SecurityManagementPage)

**URL:** `/security`  
**Назначение:** Управление ролями, правами и аудитом

**Разделы:**

1. **Пользователи** (`UsersManagementTable`)
   - Таблица всех пользователей
   - Назначение ролей
   - Блокировка/активация
   - Просмотр истории изменений (`UserAuditSheet`)

2. **Роли и права** (`RolesPermissionsManager`)
   - Матрица ролей и разрешений
   - Управление `role_permissions`
   - Роли: admin, hr_bp, manager, employee

3. **Аудит** (`AuditLogViewer`)
   - Таблица `audit_log`
   - Фильтрация по действиям, пользователям, датам
   - Детали изменений (old_value, new_value)

**Связанные таблицы:**
- `user_roles`, `permissions`, `role_permissions`
- `audit_log`, `admin_activity_logs`

---

## 4. БАЗА ДАННЫХ

### 4.1 Основные таблицы

#### Пользователи и организация
- **users** — основная таблица пользователей (зашифрованные ФИО, email)
- **user_roles** — роли пользователей (admin, hr_bp, manager, employee)
- **permissions** — список разрешений
- **role_permissions** — связь ролей и разрешений
- **departments** — подразделения
- **positions** — должности
- **position_categories** — категории должностей
- **grades** — грейды (уровни должностей)
- **trade_points** — торговые точки (с координатами)

#### Компетенции
- **skills** — навыки
- **category_skills** — категории навыков
- **qualities** — качества
- **competency_levels** — уровни владения компетенциями
- **user_skills** — навыки пользователей (current_level, target_level)
- **user_qualities** — качества пользователей
- **grade_skills** — требуемые навыки для грейда
- **grade_qualities** — требуемые качества для грейда

#### Опросы 360°
- **survey_360_questions** — вопросы опроса
- **survey_360_answer_options** — варианты ответов
- **survey_360_assignments** — назначения опросов
- **survey_360_results** — результаты опросов

#### Опросы навыков
- **skill_survey_questions** — вопросы опроса
- **skill_survey_answer_options** — варианты ответов
- **skill_survey_assignments** — назначения опросов
- **skill_survey_results** — результаты опросов

#### Диагностика
- **diagnostic_stages** — этапы диагностики
- **diagnostic_stage_participants** — участники этапов
- **user_assessment_results** — агрегированные результаты оценок

#### Встречи 1:1
- **meeting_stages** — этапы встреч
- **meeting_stage_participants** — участники этапов встреч
- **one_on_one_meetings** — данные встреч
- **meeting_decisions** — решения, принятые на встречах

#### Карьерные треки
- **track_types** — типы треков (вертикальный, горизонтальный)
- **career_tracks** — карьерные треки
- **career_track_steps** — шаги треков

#### Развитие
- **development_plans** — планы развития
- **development_tasks** — задачи развития
- **tasks** — задачи пользователей
- **certifications** — сертификации

#### Аудит и безопасность
- **audit_log** — журнал изменений
- **admin_activity_logs** — логи административных действий
- **admin_sessions** — сессии пользователей
- **auth_users** — локальная таблица авторизации

#### Прочие
- **manufacturers** — производители
- **survey_assignments** — общие задания опросов

### 4.2 Связи между таблицами

#### 1:N (Один ко многим)
- `users.manager_id` → `users.id` (руководитель)
- `users.department_id` → `departments.id`
- `users.position_id` → `positions.id`
- `users.grade_id` → `grades.id`
- `users.trade_point_id` → `trade_points.id`
- `positions.position_category_id` → `position_categories.id`
- `grades.position_id` → `positions.id`
- `grades.position_category_id` → `position_categories.id`
- `grades.parent_grade_id` → `grades.id`
- `skills.category_id` → `category_skills.id`
- `career_tracks.target_position_id` → `positions.id`
- `career_tracks.track_type_id` → `track_types.id`

#### N:M (Многие ко многим, через связующие таблицы)
- `users` ↔ `skills` через `user_skills`
- `users` ↔ `qualities` через `user_qualities`
- `grades` ↔ `skills` через `grade_skills`
- `grades` ↔ `qualities` через `grade_qualities`
- `users` ↔ `roles` через `user_roles`
- `roles` ↔ `permissions` через `role_permissions`
- `diagnostic_stages` ↔ `users` через `diagnostic_stage_participants`
- `meeting_stages` ↔ `users` через `meeting_stage_participants`

#### Опросы (1:N)
- `survey_360_questions.quality_id` → `qualities.id`
- `skill_survey_questions.skill_id` → `skills.id`
- `survey_360_results.question_id` → `survey_360_questions.id`
- `survey_360_results.answer_option_id` → `survey_360_answer_options.id`
- `survey_360_results.evaluated_user_id` → `users.id`
- `survey_360_results.evaluating_user_id` → `users.id`
- Аналогично для `skill_survey_results`

#### Карьерные треки (1:N)
- `career_track_steps.career_track_id` → `career_tracks.id`
- `career_track_steps.grade_id` → `grades.id`

### 4.3 Ключевые поля и индексы

#### Общие поля (почти во всех таблицах)
- `id` (UUID, PRIMARY KEY)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone, триггер `update_updated_at_column`)

#### Специфические индексы
- `users(email)` — UNIQUE
- `user_roles(user_id, role)` — UNIQUE
- `user_skills(user_id, skill_id)` — UNIQUE
- `user_qualities(user_id, quality_id)` — UNIQUE
- `grade_skills(grade_id, skill_id)` — UNIQUE
- `grade_qualities(grade_id, quality_id)` — UNIQUE
- `survey_360_assignments(evaluated_user_id, evaluating_user_id)` — UNIQUE
- `skill_survey_assignments(evaluated_user_id, evaluating_user_id)` — UNIQUE
- `diagnostic_stage_participants(stage_id, user_id)` — UNIQUE
- `meeting_stage_participants(stage_id, user_id)` — UNIQUE

### 4.4 Функции базы данных

#### Проверка ролей и прав
```sql
has_role(_user_id uuid, _role app_role) RETURNS boolean
has_permission(_user_id uuid, _permission_name text) RETURNS boolean
has_any_role(_user_id uuid, _roles app_role[]) RETURNS boolean
get_user_role(_user_id uuid) RETURNS app_role
is_manager_of(_manager_id uuid, _employee_id uuid) RETURNS boolean
is_manager_of_user(target_user_id uuid) RETURNS boolean
is_current_user_admin() RETURNS boolean
is_current_user_hr() RETURNS boolean
```

#### Управление сессиями
```sql
get_current_session_user() RETURNS uuid
check_user_has_auth(user_email text) RETURNS boolean
```

#### Оценка и диагностика
```sql
get_evaluation_period(created_date timestamp) RETURNS text
set_evaluation_period() RETURNS trigger
```

#### Создание задач (триггеры)
```sql
create_task_for_assignment() RETURNS trigger
create_task_for_skill_assignment() RETURNS trigger
create_meeting_task_for_participant() RETURNS trigger
create_diagnostic_task_for_participant() RETURNS trigger
```

#### Обновление статусов (триггеры)
```sql
update_assignment_on_survey_completion() RETURNS trigger
update_skill_assignment_on_survey_completion() RETURNS trigger
update_meeting_task_status() RETURNS trigger
update_diagnostic_stage_status() RETURNS trigger
update_diagnostic_stage_on_participant_add() RETURNS trigger
```

#### Обновление профилей (триггеры)
```sql
update_user_skills_from_survey() RETURNS trigger
update_user_qualities_from_survey() RETURNS trigger
```

#### Агрегация результатов
```sql
insert_assessment_results() RETURNS trigger
```

#### Диагностика
```sql
calculate_diagnostic_stage_progress(stage_id_param uuid) RETURNS numeric
assign_surveys_to_diagnostic_participant() RETURNS trigger
complete_diagnostic_task_on_surveys_completion() RETURNS trigger
```

#### Аудит
```sql
log_admin_action(...) RETURNS uuid
log_diagnostic_stage_changes() RETURNS trigger
```

#### Утилиты
```sql
update_updated_at_column() RETURNS trigger
get_all_permissions() RETURNS SETOF permissions
get_role_permissions() RETURNS SETOF role_permissions
get_users_with_roles() RETURNS TABLE(...)
get_user_with_role(user_email text) RETURNS TABLE(...)
```

### 4.5 Триггеры

**Таблица: survey_360_results**
- `AFTER INSERT` → `update_assignment_on_survey_completion()`
- `AFTER INSERT` → `update_user_qualities_from_survey()`
- `AFTER INSERT` → `insert_assessment_results()`
- `AFTER INSERT` → `update_diagnostic_stage_status()`
- `AFTER INSERT` → `complete_diagnostic_task_on_surveys_completion()`

**Таблица: skill_survey_results**
- `BEFORE INSERT` → `set_evaluation_period()`
- `AFTER INSERT` → `update_skill_assignment_on_survey_completion()`
- `AFTER INSERT` → `update_user_skills_from_survey()`
- `AFTER INSERT` → `insert_assessment_results()`
- `AFTER INSERT` → `update_diagnostic_stage_status()`
- `AFTER INSERT` → `complete_diagnostic_task_on_surveys_completion()`

**Таблица: survey_360_assignments**
- `AFTER INSERT` → `create_task_for_assignment()`

**Таблица: skill_survey_assignments**
- `AFTER INSERT` → `create_task_for_skill_assignment()`

**Таблица: diagnostic_stage_participants**
- `AFTER INSERT` → `create_diagnostic_task_for_participant()`
- `AFTER INSERT` → `assign_surveys_to_diagnostic_participant()`
- `AFTER INSERT` → `update_diagnostic_stage_on_participant_add()`

**Таблица: meeting_stage_participants**
- `AFTER INSERT` → `create_meeting_task_for_participant()`

**Таблица: one_on_one_meetings**
- `AFTER UPDATE` → `update_meeting_task_status()`

**Таблица: diagnostic_stages**
- `AFTER INSERT` → `log_diagnostic_stage_changes()`
- `AFTER UPDATE` → `log_diagnostic_stage_changes()` (только при изменении статуса)

**Таблица: все с updated_at**
- `BEFORE UPDATE` → `update_updated_at_column()`

### 4.6 Row-Level Security (RLS)

**Принципы:**
- Все таблицы с пользовательскими данными защищены RLS
- Используются функции `get_current_session_user()`, `is_current_user_admin()`, `is_manager_of_user()`
- Политики разделены по ролям: admin, hr_bp, manager, employee

**Примеры политик:**

**users**
- Admin может всё
- HR BP может просматривать и редактировать
- Manager видит своих подчинённых
- Employee видит себя

**survey_360_results**
```sql
-- Users can view their 360 results
FOR SELECT USING (
  evaluated_user_id = get_current_session_user() OR 
  evaluating_user_id = get_current_session_user() OR 
  is_current_user_admin() OR 
  is_manager_of_user(evaluated_user_id)
)

-- Users can insert their 360 results
FOR INSERT WITH CHECK (
  evaluating_user_id = get_current_session_user() OR 
  is_current_user_admin()
)
```

**skill_survey_results**
- Аналогично survey_360_results

**diagnostic_stage_participants**
- Admins can manage
- Participants can view their participation
- Managers can view their team participants

**tasks**
- Users can view/manage their own tasks

**audit_log**
- Все могут читать (SELECT)
- Только INSERT (через функции)

---

## 5. АВТОРИЗАЦИЯ И БЕЗОПАСНОСТЬ

### 5.1 Кастомная авторизация

**Таблицы:**
- `auth_users` — локальная таблица с паролями (хеш)
- `admin_sessions` — активные сессии пользователей (expires_at)
- `user_roles` — роли пользователей

**Процесс авторизации:**

1. **Логин** (`/login`, `LoginPage`)
   - Пользователь вводит email и password
   - Edge Function `custom-login` проверяет пароль
   - При успехе создаётся запись в `admin_sessions` (expires_at = now() + 24h)
   - В `AuthContext` сохраняется информация о пользователе

2. **Проверка сессии** (`AuthContext.tsx`)
   - При загрузке приложения запрашивается `admin_sessions` (order by created_at DESC)
   - Если сессия валидна, загружаются данные пользователя из `users`
   - ФИО расшифровываются через Yandex Cloud Function
   - Роль загружается через `get_user_role()`

3. **AuthGuard** (`AuthGuard.tsx`)
   - Защищает все маршруты кроме `/login`
   - Редирект на `/login` если нет пользователя

4. **Логаут** (`AuthContext.logout()`)
   - Удаляются все сессии пользователя из `admin_sessions`
   - Очищается состояние `user` в контексте

**Функции:**
- `get_current_session_user()` — возвращает user_id текущей активной сессии
- `is_current_user_admin()` — проверка роли admin
- `is_current_user_hr()` — проверка роли hr_bp
- `is_manager_of_user(target_user_id)` — проверка, является ли текущий пользователь руководителем

### 5.2 Роли и доступ

**Роли (enum app_role):**
- **admin** — полный доступ ко всем данным и функциям
- **hr_bp** — HR Business Partner, доступ к аналитике и управлению персоналом
- **manager** — руководитель, доступ к данным подчинённых
- **employee** — обычный сотрудник, доступ только к своим данным

**Права доступа:**

| Ресурс | Admin | HR_BP | Manager | Employee |
|--------|-------|-------|---------|----------|
| Справочники | RW | R | R | R |
| Пользователи | RW | RW | R (своих) | R (себя) |
| Грейды, позиции | RW | RW | R | R |
| Навыки, качества | RW | R | R | R |
| Диагностические этапы | RW | RW | R (своих команд) | R (своих) |
| Встречи 1:1 | RW | RW | RW (своих) | RW (своих) |
| Результаты опросов | R (всех) | R (всех) | R (своих команд) | R (своих) |
| Задачи | RW (всех) | R (всех) | R (своих команд) | RW (своих) |
| Аудит | R | R | - | - |
| Карьерные треки | RW | RW | R | R |

### 5.3 Шифрование данных

**Защищённые поля:**
- `users.first_name` — имя (зашифровано)
- `users.last_name` — фамилия (зашифровано)
- `users.middle_name` — отчество (зашифровано)
- `users.email` — email (зашифровано)

**Механизм:**
- Используется внешняя функция Yandex Cloud: `https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g`
- При создании пользователя данные шифруются (edge function `create-user`)
- При чтении данные расшифровываются (`userDataDecryption.ts`, `decryptUserData()`)
- Функция принимает `{ action: 'decrypt', data: { first_name, last_name, middle_name, email } }`
- Возвращает расшифрованные данные

**Использование:**
- `AuthContext` — при загрузке пользователя
- `useUsers` — при загрузке списка пользователей
- Все компоненты, отображающие ФИО, используют расшифрованные данные
- Функция `getFullName()` форматирует ФИО: "Фамилия Имя Отчество"

**Fallback:**
- Если расшифровка не удалась, используются исходные (зашифрованные) значения
- В интерфейсе отображается email вместо имени

---

## 6. ДИАГНОСТИКА И ОПРОСНИКИ

### 6.1 Общая логика диагностики

**Периоды оценки:**
- H1 (первое полугодие) — январь-июнь
- H2 (второе полугодие) — июль-декабрь
- Формат: `H1_2025`, `H2_2025`
- Функция `get_evaluation_period(created_date)` автоматически определяет период

**Этапы:**

1. **Setup** — настройка этапа
   - Создание diagnostic_stage
   - Добавление участников
   - Прогресс: 0%

2. **Assessment** — прохождение опросов
   - Участники проходят опросы
   - Прогресс: 1-99%

3. **Completed** — завершение
   - Все опросы пройдены
   - Прогресс: 100%

### 6.2 Поток самооценки (360° и навыки)

**Шаг 1: Добавление участника**
- HR/Admin добавляет пользователя в `diagnostic_stage_participants`
- Триггер `assign_surveys_to_diagnostic_participant` создаёт:
  - `skill_survey_assignments` (evaluated = evaluating = user_id)
  - `survey_360_assignments` (evaluated = evaluating = user_id)
  - `survey_360_assignments` (evaluated = user_id, evaluating = manager_id)
- Триггер `create_diagnostic_task_for_participant` создаёт задачу в `tasks`

**Шаг 2: Просмотр статуса**
- Пользователь заходит в `/development` → Опросники
- Видит карточки с текущим статусом:
  - Самооценка навыков
  - Оценка навыков руководителем
  - Самооценка 360°
  - Оценка 360° руководителем
  - Оценка 360° коллегами

**Шаг 3: Прохождение опроса**
- Клик "Начать самооценку"
- Переход на `/skill-survey/questions/:assignmentId` или `/survey-360/questions/:assignmentId`
- Загружаются вопросы для грейда пользователя:
  - Для навыков: `grade_skills` → `skill_survey_questions`
  - Для 360: `grade_qualities` → `survey_360_questions`
- Отображается первый вопрос (currentQuestionIndex = 0)
- Прогресс-бар: "Вопрос 1 из N"

**Шаг 4: Ответ на вопрос**
- Выбор варианта ответа
- Опционально: комментарий
- Клик "Следующий вопрос"
- Автосохранение ответа в состоянии (answers)
- Переход к следующему вопросу (currentQuestionIndex++)

**Шаг 5: Навигация**
- Кнопка "Назад" — возврат к предыдущему вопросу с восстановлением ответа
- Кнопка "Следующий вопрос" — переход к следующему (блокируется, если нет ответа)
- На последнем вопросе появляется кнопка "Завершить"

**Шаг 6: Завершение**
- Проверка: все вопросы имеют ответы
- Удаление старых результатов:
  - `DELETE FROM survey_360_results WHERE evaluated_user_id = ... AND evaluating_user_id = ...`
- Вставка новых результатов:
  - `INSERT INTO survey_360_results (evaluated_user_id, evaluating_user_id, question_id, answer_option_id, comment, evaluation_period)`
- Триггеры срабатывают:
  - `update_assignment_on_survey_completion` → статус assignment = "выполнено"
  - `update_user_skills_from_survey` → обновление user_skills
  - `insert_assessment_results` → вставка в user_assessment_results
  - `update_diagnostic_stage_status` → пересчёт прогресса этапа
  - `complete_diagnostic_task_on_surveys_completion` → завершение задачи в tasks
- Редирект на страницу результатов

### 6.3 Поток оценки руководителем

**Шаг 1: Назначение**
- При добавлении участника триггер создаёт:
  - `survey_360_assignments` (evaluated = employee, evaluating = manager)
  - `skill_survey_assignments` (evaluated = employee, evaluating = manager)
- Создаётся задача для руководителя

**Шаг 2: Уведомление**
- Руководитель видит задачу в `/my-assignments` или в списке задач
- Статус: "отправлен запрос"

**Шаг 3: Прохождение**
- Аналогично самооценке, но:
  - `evaluated_user_id = employee`
  - `evaluating_user_id = manager`
- Вопросы те же (для грейда сотрудника)

**Шаг 4: Результаты**
- После завершения сотрудник видит агрегированные данные:
  - Самооценка vs Оценка руководителя
  - Разрыв (gap) между ними

### 6.4 Поток оценки коллегами (360°)

**Особенность:** Пока не реализована автоматическая форма выбора коллег

**Текущая логика:**
- HR/Admin вручную создаёт `survey_360_assignments`:
  - `evaluated_user_id = employee`
  - `evaluating_user_id = colleague`
- Коллега получает задачу
- Прохождение аналогично самооценке

**Планируемая доработка:**
- Форма выбора коллег на странице `/survey-360`
- Автоматическое создание assignments
- Минимум 1 коллега для завершения

### 6.5 Прогресс и завершение диагностики

**Расчёт прогресса:**
```sql
calculate_diagnostic_stage_progress(stage_id):
  total_participants = COUNT(diagnostic_stage_participants)
  total_required = total_participants * 2  -- навыки + 360
  completed_skill_surveys = COUNT(DISTINCT skill_survey_results.user_id)
  completed_360_surveys = COUNT(DISTINCT survey_360_results.evaluated_user_id)
  completed_total = completed_skill_surveys + completed_360_surveys
  progress = (completed_total / total_required) * 100
  RETURN progress
```

**Обновление статуса этапа:**
- Триггер `update_diagnostic_stage_status` срабатывает при:
  - Вставке в `skill_survey_results`
  - Вставке в `survey_360_results`
  - Добавлении в `diagnostic_stage_participants`
- Пересчитывает прогресс
- Обновляет статус:
  - 0% → "setup"
  - 1-99% → "assessment"
  - 100% → "completed"

### 6.6 Экспорт и результаты

**Страницы результатов:**
- `/skill-survey/results` (`SkillSurveyResultsPage`)
- `/survey-360-results` (`Survey360ResultsPage`)

**Функциональность:**
- Агрегированные данные по навыкам/качествам
- Диаграммы (RadarChart, BarChart)
- Сравнение самооценки и оценки руководителя
- Комментарии (анонимные для 360°)
- Экспорт в PDF/CSV (через библиотеки или edge functions)

**Таблица user_assessment_results:**
- Агрегированные данные из триггера `insert_assessment_results`
- Поля:
  - `user_id`
  - `assessment_type` (survey_360, skill_survey)
  - `assessment_period` (H1_2025, H2_2025)
  - `assessment_date`
  - `skill_id` или `quality_id`
  - `skill_average` или `quality_average`
  - `total_responses`

---

## 7. UI / UX

### 7.1 Дизайн-система

**Цвета (HSL):**
- Определены в `src/index.css` и `tailwind.config.ts`
- Семантические токены:
  - `--brand-purple` — основной цвет бренда
  - `--brand-purple-light` — светлый оттенок
  - `--text-primary` — основной текст
  - `--text-secondary` — второстепенный текст
  - `--surface-primary` — основной фон
  - `--surface-secondary` — вторичный фон
  - `--accent` — акцентный цвет
- Поддержка тёмной темы (через `dark:` классы)

**Компоненты (shadcn/ui):**
- Button, Card, Input, Select, Dialog, Sheet, Tabs, Badge, Avatar, etc.
- Кастомизированы через `components/ui/`
- Варианты: default, outline, ghost, destructive

**Иконки:**
- `lucide-react` — современные SVG иконки

### 7.2 Навигационные сценарии

**Основной поток пользователя:**

1. **Авторизация** → `/login`
2. **Главная** → `/` (дашборд)
3. **Просмотр задач** → TaskList → клик "Все задачи" → `/development` → таб "Задачи"
4. **Прохождение опроса:**
   - `/development` → таб "Опросники" → "Начать самооценку"
   - → `/skill-survey/questions/:id` → ответы → "Завершить"
   - → `/skill-survey/results`
5. **Просмотр карьерного трека:**
   - `/development` → таб "Карьерный трек"
   - → детали трека, прогресс
6. **Встречи 1:1:**
   - `/meetings` → "Создать встречу" → заполнение формы → "Отправить"
   - → руководитель утверждает → статус "approved"
7. **Административные действия:**
   - `/admin` → выбор справочника → CRUD операции
   - `/security` → управление ролями, аудит

**Навигационные элементы:**
- **AppSidebar** — боковая панель с основным меню
- **Breadcrumbs** — хлебные крошки на каждой странице
- **SidebarTrigger** — кнопка для открытия/закрытия сайдбара
- **Табы** — на страницах Development, Security, Admin

### 7.3 Основные проблемы и недоработки UX

**Текущие проблемы:**

1. **Навигация в опросниках:**
   - ✅ Исправлено: кнопка "Следующий вопрос" теперь работает корректно
   - ✅ Реализовано: постраничное отображение вопросов с прогресс-баром
   - ⚠️ Требуется: улучшить UX при возврате назад (сохранение прокрутки)

2. **Выбор оценивающих для 360°:**
   - ❌ Не реализовано: форма выбора коллег
   - ❌ Временное решение: HR/Admin создаёт assignments вручную

3. **Расшифровка ФИО:**
   - ⚠️ Медленная загрузка из-за запросов к внешнему API
   - ⚠️ Нет кэширования расшифрованных данных
   - ⚠️ Fallback на зашифрованные данные не всегда корректен

4. **Прогресс диагностики:**
   - ⚠️ Прогресс не учитывает оценки коллег (только self + manager)
   - ⚠️ Нет визуализации прогресса для руководителя

5. **Результаты опросов:**
   - ⚠️ Экспорт в PDF/CSV не реализован
   - ⚠️ Нет детализации по комментариям

6. **Уведомления:**
   - ❌ Нет email/push уведомлений при назначении опросов
   - ❌ Нет уведомлений о дедлайнах

7. **Мобильная версия:**
   - ⚠️ Частично адаптивна, но требует доработки
   - ⚠️ Sidebar не всегда корректно работает на мобильных

### 7.4 Используемые шаблоны и паттерны

**Компоненты:**
- **Atomic Design** — частично (atoms, molecules, organisms)
  - Atoms: `Button`, `Badge`, `Avatar`, `Text`
  - Molecules: `Card`, `TaskItem`, `EventCard`, `UserProfile`
  - Organisms: `TaskList`, `Calendar`, `DiagnosticStepper`

**Хуки:**
- Custom hooks для бизнес-логики:
  - `useDiagnosticStages`, `useSkillSurvey`, `useSurvey360`
  - `useUsers`, `useCareerTracks`, `useCompetencyProfile`
- React Query (`@tanstack/react-query`) — для кэширования запросов

**Состояние:**
- `AuthContext` — глобальное состояние авторизации
- `useState`, `useEffect` — локальное состояние в компонентах

**Роутинг:**
- React Router DOM v6
- Вложенная структура с `AuthGuard`

---

## 8. API И ИНТЕГРАЦИИ

### 8.1 Supabase API

**Клиент:**
- `src/integrations/supabase/client.ts`
- URL: `https://zgbimzuhrsgvfrhlboxy.supabase.co`
- Публичный ключ: `eyJhbG...`

**Использование:**
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

**Основные операции:**
- `select()` — чтение данных
- `insert()` — вставка
- `update()` — обновление
- `delete()` — удаление
- `rpc()` — вызов функций

### 8.2 Edge Functions (Supabase Functions)

**Список функций:**

1. **create-user**
   - **Назначение:** Создание пользователя с шифрованием данных
   - **Входные данные:**
     ```json
     {
       "email": "user@example.com",
       "password": "password123",
       "first_name": "Иван",
       "last_name": "Иванов",
       "middle_name": "Иванович",
       "department_id": "uuid",
       "position_id": "uuid",
       "grade_id": "uuid"
     }
     ```
   - **Процесс:**
     - Шифрование ФИО через Yandex Cloud Function
     - Вставка в `users`
     - Создание записи в `auth_users` (с хешем пароля)
     - Назначение роли в `user_roles`
   - **Возврат:** `{ success: true, user_id: "uuid" }`

2. **custom-login**
   - **Назначение:** Авторизация пользователя
   - **Входные данные:**
     ```json
     {
       "email": "user@example.com",
       "password": "password123"
     }
     ```
   - **Процесс:**
     - Проверка пароля (bcrypt)
     - Создание сессии в `admin_sessions`
     - Загрузка данных пользователя и роли
   - **Возврат:**
     ```json
     {
       "success": true,
       "user": {
         "id": "uuid",
         "email": "...",
         "full_name": "...",
         "role": "employee"
       }
     }
     ```

3. **delete-user**
   - **Назначение:** Удаление пользователя
   - **Входные данные:**
     ```json
     {
       "user_id": "uuid"
     }
     ```
   - **Процесс:**
     - Удаление из `auth_users`
     - Мягкое удаление из `users` (status = false)
     - Логирование в `audit_log`
   - **Возврат:** `{ success: true }`

4. **generate-development-tasks**
   - **Назначение:** Генерация задач развития на основе gap analysis
   - **Входные данные:**
     ```json
     {
       "user_id": "uuid",
       "track_id": "uuid"
     }
     ```
   - **Процесс:**
     - Анализ разрыва компетенций (gap analysis)
     - Выбор задач из `development_tasks`
     - Создание персонализированного плана в `development_plans`
   - **Возврат:**
     ```json
     {
       "success": true,
       "plan_id": "uuid",
       "tasks": [...]
     }
     ```

### 8.3 Внешние API

**1. Yandex Cloud Functions — Шифрование/Дешифрование**

**URL:** `https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g`

**Запрос (дешифрование):**
```json
{
  "action": "decrypt",
  "data": {
    "first_name": "encrypted_string",
    "last_name": "encrypted_string",
    "middle_name": "encrypted_string",
    "email": "encrypted_string"
  }
}
```

**Ответ:**
```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "middle_name": "Иванович",
  "email": "ivanov@example.com"
}
```

**Запрос (шифрование):**
```json
{
  "action": "encrypt",
  "data": {
    "first_name": "Иван",
    "last_name": "Иванов",
    "middle_name": "Иванович",
    "email": "ivanov@example.com"
  }
}
```

**Ответ:**
```json
{
  "first_name": "encrypted_string",
  "last_name": "encrypted_string",
  "middle_name": "encrypted_string",
  "email": "encrypted_string"
}
```

**Использование:**
- `src/lib/userDataDecryption.ts` — функция `decryptUserData()`
- `src/contexts/AuthContext.tsx` — при загрузке пользователя
- `src/hooks/useUsers.ts` — при загрузке списка пользователей
- Edge Function `create-user` — при создании пользователя

**Обработка ошибок:**
- При ошибке запроса используются исходные (зашифрованные) данные
- Fallback на email вместо ФИО

---

## 9. ИЗВЕСТНЫЕ ОШИБКИ И ОГРАНИЧЕНИЯ

### 9.1 Ошибки

1. **TypeError: Cannot read properties of undefined (reading 'category')**
   - **Место:** `Survey360QuestionsPage.tsx:625`
   - **Причина:** Попытка доступа к `currentQuestion.category` до загрузки вопросов
   - **Статус:** ✅ Исправлено
   - **Решение:** Добавлена проверка `if (!currentQuestion)` в условие загрузки

2. **Кнопка "Следующий вопрос" не работала**
   - **Место:** `SkillSurveyQuestionsPage.tsx`, `Survey360QuestionsPage.tsx`
   - **Причина:** Некорректный импорт компонента `Button`
   - **Статус:** ✅ Исправлено
   - **Решение:** Импорт из `src/components/ui/button`

3. **Медленная загрузка списка пользователей**
   - **Причина:** Множественные запросы к Yandex Cloud для расшифровки ФИО
   - **Статус:** ⚠️ Требует оптимизации
   - **Решение:** Кэширование расшифрованных данных, batch-запросы

4. **RLS политики блокируют обновление admin_sessions**
   - **Место:** `AuthContext.tsx`, `LoginPage.tsx`
   - **Причина:** Политики RLS слишком строгие
   - **Статус:** ✅ Исправлено
   - **Решение:** Политика "Allow admin session operations for testing" с `true`

### 9.2 Ограничения

1. **Выбор оценивающих для 360°:**
   - Нет UI для выбора коллег
   - HR/Admin создаёт assignments вручную

2. **Уведомления:**
   - Нет email/push уведомлений
   - Нет напоминаний о дедлайнах

3. **Экспорт данных:**
   - Экспорт в PDF/CSV не реализован
   - Нет генерации отчётов

4. **Аналитика:**
   - Ограниченные метрики в HR-аналитике
   - Нет предиктивной аналитики

5. **Мобильная версия:**
   - Частично адаптивна
   - Некоторые компоненты не оптимизированы для мобильных

6. **Производительность:**
   - Нет кэширования расшифрованных данных
   - Нет пагинации в больших списках

7. **Безопасность:**
   - Пароли хешируются bcrypt, но нет двухфакторной аутентификации
   - Нет ограничения на количество попыток входа

8. **Интернационализация:**
   - Интерфейс только на русском языке
   - Нет поддержки i18n

### 9.3 Временные решения (workarounds)

1. **Fallback на зашифрованные ФИО:**
   - При ошибке расшифровки используются исходные данные
   - В интерфейсе может отображаться нечитаемый текст

2. **Политика RLS "Allow all" для некоторых таблиц:**
   - `admin_sessions`, `audit_log`, `admin_activity_logs`
   - Для тестирования и разработки
   - **Требуется:** Ужесточить политики для продакшена

3. **Хранение паролей в `auth_users`:**
   - Кастомная таблица вместо Supabase Auth
   - **Причина:** Необходимость кастомной логики авторизации
   - **Риск:** Дублирование функциональности

---

## 10. РЕКОМЕНДАЦИИ

### 10.1 Архитектура

1. **Рефакторинг авторизации:**
   - Мигрировать на нативный Supabase Auth
   - Использовать JWT токены вместо кастомных сессий
   - Убрать таблицу `auth_users` и `admin_sessions`

2. **Кэширование:**
   - Внедрить Redis/Memcached для кэширования расшифрованных данных
   - Использовать React Query для агрессивного кэширования
   - Кэшировать результаты функций RLS (`get_current_session_user()`)

3. **Микросервисная архитектура:**
   - Вынести шифрование в отдельный сервис
   - Edge Functions для аналитики и генерации отчётов
   - API Gateway для централизованного управления

4. **Оптимизация запросов:**
   - Batch-запросы для расшифровки ФИО
   - Индексы на часто используемые поля
   - Материализованные представления для аналитики

### 10.2 Навигация и UX

1. **Форма выбора оценивающих:**
   - Реализовать UI для выбора коллег в опросе 360°
   - Автоматическое создание `survey_360_assignments`
   - Ограничение: минимум 2, максимум 5 коллег

2. **Улучшение опросников:**
   - Добавить индикатор сохранения ("Сохранено")
   - Подтверждение при выходе без сохранения
   - Возможность пропускать вопросы (с маркировкой)

3. **Уведомления:**
   - Email при назначении опроса
   - Напоминания за 3, 2, 1 день до дедлайна
   - Push-уведомления (через PWA)

4. **Мобильная версия:**
   - Полная адаптация всех компонентов
   - Отдельный UX для мобильных (упрощённые формы)
   - Тестирование на реальных устройствах

5. **Прогресс и геймификация:**
   - Визуализация прогресса (ачивки, бейджи)
   - Рейтинги и лидерборды (опционально)
   - Мотивационные элементы

### 10.3 RLS и безопасность

1. **Ужесточение политик:**
   - Убрать политики "Allow all"
   - Детальные политики для каждой роли
   - Аудит всех политик на уязвимости

2. **Двухфакторная аутентификация:**
   - Поддержка 2FA (TOTP, SMS)
   - Обязательно для администраторов

3. **Логирование:**
   - Расширить `audit_log` (IP, user agent)
   - Логирование всех изменений данных (не только админских)
   - Интеграция с SIEM системами

4. **Шифрование:**
   - Миграция на локальное шифрование (без внешнего API)
   - Использование KMS (Key Management Service)
   - Шифрование всех PII (Personally Identifiable Information)

### 10.4 API и интеграции

1. **Документация API:**
   - OpenAPI/Swagger спецификация
   - Интерактивная документация (Swagger UI)
   - Примеры запросов и ответов

2. **Версионирование:**
   - API версии (v1, v2)
   - Обратная совместимость

3. **Ограничение запросов:**
   - Rate limiting (например, 100 запросов/минуту)
   - Throttling для тяжёлых операций

4. **Внешние интеграции:**
   - Интеграция с HR-системами (SAP, 1C)
   - Интеграция с LMS (Learning Management Systems)
   - Интеграция с календарями (Google Calendar, Outlook)

### 10.5 Аналитика и отчёты

1. **Расширенная аналитика:**
   - Динамика изменений компетенций во времени
   - Корреляция компетенций и KPI
   - Предиктивная аналитика (ML модели)

2. **Экспорт данных:**
   - Генерация PDF отчётов (с диаграммами)
   - Экспорт в Excel/CSV
   - Автоматическая отправка отчётов по расписанию

3. **Dashboards:**
   - HR Dashboard (метрики по всей компании)
   - Manager Dashboard (метрики по команде)
   - Employee Dashboard (персональная аналитика)

4. **Визуализация:**
   - Более интерактивные графики (D3.js, Chart.js)
   - Карты компетенций (heatmaps)
   - Графы связей (network graphs)

### 10.6 Централизованная документация

**Рекомендуемая структура:**

```
docs/
├── README.md                    # Обзор проекта
├── ARCHITECTURE.md              # Архитектура системы
├── DATABASE.md                  # Схема БД, функции, триггеры
├── API.md                       # API документация
├── DEPLOYMENT.md                # Деплой и конфигурация
├── SECURITY.md                  # Безопасность и RLS
├── CHANGELOG.md                 # История изменений
├── user-guides/                 # Руководства для пользователей
│   ├── employee.md              # Для сотрудников
│   ├── manager.md               # Для руководителей
│   ├── hr.md                    # Для HR
│   └── admin.md                 # Для администраторов
├── developer-guides/            # Руководства для разработчиков
│   ├── getting-started.md       # Быстрый старт
│   ├── code-style.md            # Стиль кода
│   ├── components.md            # Документация компонентов
│   ├── hooks.md                 # Кастомные хуки
│   └── testing.md               # Тестирование
└── diagrams/                    # Диаграммы и схемы
    ├── architecture.png
    ├── database-schema.png
    ├── user-flows.png
    └── sequence-diagrams.png
```

**Инструменты:**
- **Docusaurus** или **VitePress** для документации
- **Mermaid** для диаграмм
- **Storybook** для компонентов UI
- **TSDoc** для документации кода

---

## 11. ЗАКЛЮЧЕНИЕ

Проект представляет собой комплексную систему управления компетенциями и развитием персонала с широким функционалом:

- ✅ **360° оценка** и **оценка навыков** с автоматическим назначением
- ✅ **Карьерные треки** с gap analysis и рекомендациями
- ✅ **Встречи 1:1** с согласованием руководителем
- ✅ **Диагностические этапы** с автоматическим отслеживанием прогресса
- ✅ **RLS** для защиты данных по ролям
- ✅ **Шифрование** персональных данных
- ✅ **Аудит** всех изменений

**Основные сильные стороны:**
- Автоматизация (триггеры, функции)
- Гибкость (настройка справочников)
- Безопасность (RLS, шифрование)
- Аналитика (агрегированные результаты)

**Основные области для улучшения:**
- Производительность (кэширование, оптимизация запросов)
- UX (уведомления, мобильная версия, геймификация)
- Интеграции (внешние HR-системы, LMS)
- Аналитика (предиктивная, экспорт отчётов)

Система готова к использованию в тестовом режиме и требует доработок для полноценного промышленного развёртывания.