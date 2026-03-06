# Полная техническая документация системы управления компетенциями и развитием персонала

**Версия:** 4.0  
**Дата:** 2025-01-15  
**Статус:** Production Ready  
**Технологии:** React 18, TypeScript, Supabase (PostgreSQL), Tailwind CSS

---

## СОДЕРЖАНИЕ

1. [Архитектура системы](#1-архитектура-системы)
2. [База данных](#2-база-данных)
3. [Триггеры и автоматизация](#3-триггеры-и-автоматизация)
4. [SQL функции и процедуры](#4-sql-функции-и-процедуры)
5. [Система ролей и прав доступа](#5-система-ролей-и-прав-доступа)
6. [API и RPC функции](#6-api-и-rpc-функции)
7. [Бизнес-логика модулей](#7-бизнес-логика-модулей)
8. [UI/UX и маршруты](#8-uiux-и-маршруты)
9. [Статусы и состояния](#9-статусы-и-состояния)
10. [Несоответствия и рекомендации](#10-несоответствия-и-рекомендации)

---

## 1. АРХИТЕКТУРА СИСТЕМЫ

### 1.1 Общая структура модулей

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  (React Components, Pages, Hooks, UI Components)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  (Business Logic, State Management, API Calls)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                       │
│  (Supabase Client, RPC Calls, Query Builders)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│  (PostgreSQL, RLS Policies, Triggers, Functions)            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Основные модули системы

| Модуль | Назначение | Основные компоненты | Таблицы БД |
|--------|-----------|---------------------|------------|
| **Users & Auth** | Управление пользователями, аутентификация | AuthGuard, UsersTableAdmin, CreateUserPage | users, user_roles, user_effective_permissions |
| **Security** | Роли, права, аудит | SecurityManagementPage, RolesPermissionsManager | permissions, role_permissions, audit_log, access_denied_logs |
| **Diagnostics** | Диагностические этапы оценки | DiagnosticsAdminPage, DiagnosticStepper, UnifiedStagesManager | diagnostic_stages, diagnostic_stage_participants, parent_stages |
| **Surveys (360°)** | Оценка 360 градусов | Survey360QuestionsPage, RespondentApprovalDialog, SurveyAccessWidget | survey_360_assignments, soft_skill_questions, soft_skill_results |
| **Skills Assessment** | Оценка профессиональных навыков | SkillSurveyQuestionsPage, SkillSurveyResultsPage | hard_skill_questions, hard_skill_results |
| **Meetings 1:1** | Встречи один на один | MeetingsPage, MeetingForm | meeting_stages, one_on_one_meetings, meeting_decisions |
| **Development** | Планы развития, задачи | DevelopmentPage, DevelopmentPlanCreator, TasksManager | development_plans, development_tasks, tasks |
| **Career Tracks** | Карьерные треки | CareerTracksWidget, UserCareerTrackView | career_tracks, career_track_steps, user_career_progress |
| **Team** | Управление командой | TeamPage, TeamMembersTable | users (manager_id relation) |
| **Analytics** | HR-аналитика | HRAnalyticsPage, ProgressDashboard | user_assessment_results, aggregated views |

### 1.3 Взаимодействие модулей

```
┌──────────────────┐
│   Diagnostics    │──┐
└──────────────────┘  │
                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Skills Survey   │─>│     Tasks        │<─│  Surveys 360°    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                      │
         │                     ▼                      │
         │            ┌──────────────────┐            │
         └───────────>│  User Results    │<───────────┘
                      └──────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │   Development    │
                      │   Plans/Tasks    │
                      └──────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Career Tracks   │
                      └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  Meetings 1:1    │ ──────> │     Tasks        │
└──────────────────┘         └──────────────────┘
```

**Ключевые потоки данных:**

1. **Diagnostic Stage Creation** → автоматическое создание участников → автоматическое создание назначений (assignments) и задач (tasks)
2. **Survey Completion** → обновление результатов (user_assessment_results) → автоматическое закрытие задач
3. **Results Aggregation** → расчет gap-анализа → рекомендации по развитию
4. **Meeting Stage Creation** → автоматическое создание участников → автоматическое создание задач на встречи

---

## 2. БАЗА ДАННЫХ

### 2.1 Полный список таблиц

#### 2.1.1 Пользователи и авторизация

##### users
**Назначение:** Основная таблица пользователей (расширяет auth.users)

**Поля:**
| Поле | Тип | Описание | Обязательное | По умолчанию |
|------|-----|----------|--------------|--------------|
| id | uuid | PK, синхронизирован с auth.users.id | ✅ | gen_random_uuid() |
| employee_number | text | Табельный номер | ✅ | - |
| email | text | Email (зашифрован) | ✅ | - |
| first_name | text | Имя (зашифровано) | ❌ | - |
| last_name | text | Фамилия (зашифровано) | ❌ | - |
| middle_name | text | Отчество (зашифровано) | ❌ | - |
| status | boolean | Активен/Неактивен | ✅ | true |
| start_date | date | Дата начала работы | ❌ | - |
| position_id | uuid | FK → positions | ❌ | - |
| department_id | uuid | FK → departments | ❌ | - |
| manager_id | uuid | FK → users (руководитель) | ❌ | - |
| hr_bp_id | uuid | FK → users (HR BP) | ❌ | - |
| grade_id | uuid | FK → grades | ❌ | - |
| last_login_at | timestamptz | Последний вход | ❌ | - |
| created_at | timestamptz | Дата создания | ✅ | now() |
| updated_at | timestamptz | Дата обновления | ✅ | now() |

**Индексы:**
- `idx_users_department` ON (department_id)
- `idx_users_position` ON (position_id)
- `idx_users_manager` ON (manager_id)
- `idx_users_email` ON (email)

**Триггеры:**
- `update_users_updated_at` BEFORE UPDATE → `update_updated_at_column()`

**RLS политики:**
- `users_select_policy`: Пользователи видят себя, коллег, руководители видят подчиненных, HR/Admin видят всех
- `users_update_own`: Пользователи могут обновлять свои данные
- `users_manage_admin`: Admin/HR могут управлять всеми

##### user_roles
**Назначение:** Роли пользователей

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| role | app_role | Роль (admin, hr_bp, manager, employee) |
| created_at | timestamptz | Дата назначения |

**Ограничения:**
- UNIQUE(user_id, role)

**Триггеры:**
- `trigger_refresh_user_permissions` AFTER INSERT/UPDATE/DELETE → обновляет user_effective_permissions

**RLS политики:**
- SELECT: доступно для всех авторизованных
- INSERT/UPDATE/DELETE: только для пользователей с правом `security.manage_users`

##### permissions
**Назначение:** Справочник прав доступа

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Уникальное имя (например, "diagnostics.create") |
| resource | text | Ресурс (diagnostics, users, meetings) |
| action | text | Действие (create, view, update, delete) |
| description | text | Описание права |

**RLS:** SELECT доступен всем, изменения запрещены через RLS (управляется миграциями)

##### role_permissions
**Назначение:** Связь ролей и прав

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| role | app_role | Роль |
| permission_id | uuid | FK → permissions |

**Ограничения:**
- UNIQUE(role, permission_id)

**Триггеры:**
- `trigger_refresh_role_permissions` AFTER INSERT/UPDATE/DELETE → обновляет все user_effective_permissions для пользователей с этой ролью

##### user_effective_permissions
**Назначение:** Кэш эффективных прав пользователя (для быстрой проверки)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| user_id | uuid | PK, FK → users |
| permission_name | text | PK, имя права |

**Индексы:**
- PRIMARY KEY (user_id, permission_name)
- `idx_user_effective_permissions_user` ON (user_id)

**Обновление:** автоматически через триггеры на user_roles и role_permissions

##### permission_groups
**Назначение:** Группировка прав для UI

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Техническое имя |
| label | text | Название для UI |
| icon | text | Иконка |
| description | text | Описание |
| display_order | integer | Порядок отображения |

##### permission_group_permissions
**Назначение:** Связь групп и прав

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| group_id | uuid | FK → permission_groups |
| permission_id | uuid | FK → permissions |

#### 2.1.2 Справочники

##### departments
**Назначение:** Подразделения компании

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| description | text | Описание |
| company_id | uuid | FK → companies |

##### positions
**Назначение:** Должности

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| position_category_id | uuid | FK → position_categories |

##### position_categories
**Назначение:** Категории должностей

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| description | text | Описание |

##### grades
**Назначение:** Грейды (уровни должностей)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| level | integer | Числовой уровень |
| description | text | Описание |
| position_id | uuid | FK → positions |
| position_category_id | uuid | FK → position_categories |
| parent_grade_id | uuid | FK → grades (для карьерного роста) |
| min_salary | numeric | Минимальная зарплата |
| max_salary | numeric | Максимальная зарплата |
| key_tasks | text | Ключевые задачи |
| certification_id | uuid | FK → certifications |

##### skills
**Назначение:** Профессиональные навыки (hard skills)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| description | text | Описание |
| category_id | uuid | FK → category_skills |

##### category_skills
**Назначение:** Категории навыков

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| description | text | Описание |

##### qualities
**Назначение:** Личностные качества (soft skills)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название |
| description | text | Описание |

##### grade_skills
**Назначение:** Требуемые навыки для грейда

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| grade_id | uuid | FK → grades |
| skill_id | uuid | FK → skills |
| target_level | numeric | Целевой уровень (0-5) |

##### grade_qualities
**Назначение:** Требуемые качества для грейда

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| grade_id | uuid | FK → grades |
| quality_id | uuid | FK → qualities |
| target_level | numeric | Целевой уровень (0-5) |

##### competency_levels
**Назначение:** Уровни компетенций (0-5)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| level | integer | Числовое значение |
| name | text | Название уровня |
| description | text | Описание |

#### 2.1.3 Диагностика

##### parent_stages
**Назначение:** Родительские этапы (периоды оценки)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| period | text | Период (H1_2025, H2_2025) |
| start_date | date | Дата начала |
| end_date | date | Дата окончания |
| deadline_date | date | Крайний срок |
| is_active | boolean | Активен |
| created_by | uuid | FK → users |

**RLS политики:**
- SELECT: пользователи с правом `diagnostics.view`
- INSERT: пользователи с правом `diagnostics.create`
- UPDATE: пользователи с правом `diagnostics.update`
- DELETE: пользователи с правом `diagnostics.delete`

##### diagnostic_stages
**Назначение:** Диагностические этапы (подэтапы)

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| parent_id | uuid | FK → parent_stages | - |
| evaluation_period | text | Период оценки | - |
| status | text | Статус (setup, assessment, completed) | 'setup' |
| progress_percent | numeric | Процент выполнения | 0 |
| is_active | boolean | Активен | true |
| created_by | uuid | FK → users | - |

**Статусы:**
- `setup` - настройка этапа
- `assessment` - идет оценка
- `completed` - завершен

**Триггеры:**
- `update_diagnostic_stage_on_participant_add` - обновляет прогресс при добавлении участника

**RLS политики:**
- SELECT: участники этапа или пользователи с правом `diagnostics.view`
- INSERT/UPDATE: пользователи с правом `diagnostics.manage`

##### diagnostic_stage_participants
**Назначение:** Участники диагностического этапа

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| stage_id | uuid | FK → diagnostic_stages |
| user_id | uuid | FK → users |

**Триггеры:**
- `assign_surveys_to_diagnostic_participant` AFTER INSERT → автоматически создает назначения на самооценку и оценку руководителем
- `create_diagnostic_task_for_participant` AFTER INSERT → создает задачу для участника
- `delete_diagnostic_tasks_on_participant_remove` AFTER DELETE → удаляет связанные задачи

**RLS политики:**
- SELECT: участник или пользователи с правом `diagnostics.view`
- INSERT/UPDATE/DELETE: пользователи с правом `diagnostics.manage_participants`

#### 2.1.4 Оценка навыков (Hard Skills)

##### hard_skill_questions
**Назначение:** Вопросы для оценки профессиональных навыков

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| question_text | text | Текст вопроса |
| skill_id | uuid | FK → skills |
| order_index | integer | Порядок отображения |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### hard_skill_answer_options
**Назначение:** Варианты ответов на вопросы по навыкам

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| title | text | Название варианта |
| description | text | Описание |
| numeric_value | integer | Числовое значение (0-5) |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### hard_skill_results
**Назначение:** Результаты оценки навыков

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| evaluated_user_id | uuid | FK → users (кого оценивают) | - |
| evaluating_user_id | uuid | FK → users (кто оценивает) | - |
| question_id | uuid | FK → hard_skill_questions | - |
| answer_option_id | uuid | FK → hard_skill_answer_options | - |
| comment | text | Комментарий | - |
| diagnostic_stage_id | uuid | FK → diagnostic_stages | - |
| assignment_id | uuid | FK → survey_360_assignments | - |
| evaluation_period | text | Период оценки | - |
| is_draft | boolean | Черновик | true |

**Триггеры:**
- `set_evaluation_period` BEFORE INSERT → автоматически устанавливает evaluation_period
- `update_user_skills_from_survey` AFTER INSERT/UPDATE → обновляет user_skills
- `aggregate_hard_skill_results` AFTER INSERT/UPDATE → агрегирует результаты в user_assessment_results
- `update_assignment_on_survey_completion` AFTER UPDATE → обновляет статус assignment при завершении
- `complete_diagnostic_task_on_surveys_completion` AFTER INSERT/UPDATE → закрывает задачи при завершении обоих опросов

**RLS политики:**
- SELECT: оцениваемый, оценивающий, руководитель оцениваемого, Admin/HR
- INSERT: только evaluating_user_id = auth.uid()
- UPDATE: только evaluating_user_id = auth.uid() или право `diagnostics.manage`

#### 2.1.5 Оценка 360° (Soft Skills)

##### soft_skill_questions
**Назначение:** Вопросы для оценки 360°

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| question_text | text | Текст вопроса |
| quality_id | uuid | FK → qualities |
| category | text | Категория вопроса |
| behavioral_indicators | text | Поведенческие индикаторы |
| order_index | integer | Порядок отображения |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### soft_skill_answer_options
**Назначение:** Варианты ответов для оценки 360°

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| label | text | Название варианта |
| description | text | Описание |
| numeric_value | integer | Числовое значение (0-5) |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### soft_skill_results
**Назначение:** Результаты оценки 360°

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| evaluated_user_id | uuid | FK → users (кого оценивают) | - |
| evaluating_user_id | uuid | FK → users (кто оценивает) | - |
| question_id | uuid | FK → soft_skill_questions | - |
| answer_option_id | uuid | FK → soft_skill_answer_options | - |
| comment | text | Комментарий | - |
| is_anonymous_comment | boolean | Анонимный комментарий | false |
| diagnostic_stage_id | uuid | FK → diagnostic_stages | - |
| assignment_id | uuid | FK → survey_360_assignments | - |
| evaluation_period | text | Период оценки | - |
| is_draft | boolean | Черновик | true |

**Триггеры:**
- `set_evaluation_period` BEFORE INSERT → автоматически устанавливает evaluation_period
- `update_user_qualities_from_survey` AFTER INSERT/UPDATE → обновляет user_qualities
- `aggregate_soft_skill_results` AFTER INSERT/UPDATE → агрегирует результаты в user_assessment_results
- `update_assignment_on_survey_completion` AFTER UPDATE → обновляет статус assignment
- `complete_diagnostic_task_on_surveys_completion` AFTER INSERT/UPDATE → закрывает задачи

**RLS политики:**
- SELECT: оцениваемый (без анонимных комментариев коллег), оценивающий, руководитель, Admin/HR
- INSERT: только evaluating_user_id = auth.uid()
- UPDATE: только evaluating_user_id = auth.uid() или право `diagnostics.manage`

##### survey_360_assignments
**Назначение:** Назначения на оценку 360°

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| evaluated_user_id | uuid | FK → users (кого оценивают) | - |
| evaluating_user_id | uuid | FK → users (кто оценивает) | - |
| diagnostic_stage_id | uuid | FK → diagnostic_stages | - |
| assignment_type | text | Тип (self, manager, peer) | - |
| status | text | Статус (pending, approved, rejected, completed) | 'pending' |
| is_manager_participant | boolean | Является ли руководителем | false |
| approved_by | uuid | FK → users (кто утвердил) | - |
| approved_at | timestamptz | Дата утверждения | - |
| rejected_at | timestamptz | Дата отклонения | - |
| rejection_reason | text | Причина отклонения | - |
| assigned_date | date | Дата назначения | now() |

**Статусы:**
- `pending` - ожидает утверждения
- `approved` - утверждено
- `rejected` - отклонено
- `completed` - завершено

**Типы назначений:**
- `self` - самооценка
- `manager` - оценка руководителем
- `peer` - оценка коллегой

**Триггеры:**
- `auto_assign_manager_for_360` AFTER INSERT → автоматически создает назначение для руководителя при создании самооценки
- `create_task_on_assignment_approval` AFTER UPDATE → создает задачу при утверждении назначения
- `update_task_status_on_assignment_change` AFTER UPDATE → обновляет статус задачи при изменении статуса назначения

**RLS политики:**
- SELECT: оцениваемый, оценивающий, руководитель, Admin/HR
- INSERT: оцениваемый (для выбора коллег), пользователи с правом `diagnostics.manage`
- UPDATE: руководитель (для утверждения), пользователи с правом `diagnostics.manage`

#### 2.1.6 Результаты оценки

##### user_assessment_results
**Назначение:** Агрегированные результаты оценки пользователя

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| diagnostic_stage_id | uuid | FK → diagnostic_stages |
| skill_id | uuid | FK → skills (NULL если quality) |
| quality_id | uuid | FK → qualities (NULL если skill) |
| assessment_period | text | Период оценки |
| assessment_date | timestamptz | Дата оценки |
| self_assessment | numeric | Самооценка (avg) |
| manager_assessment | numeric | Оценка руководителя (avg) |
| peers_average | numeric | Средняя оценка коллег (avg) |
| total_responses | integer | Количество ответов |

**Обновление:** автоматически через триггеры `aggregate_hard_skill_results` и `aggregate_soft_skill_results`

**RLS политики:**
- SELECT: владелец, руководитель, Admin/HR

#### 2.1.7 Встречи 1:1

##### meeting_stages
**Назначение:** Этапы встреч 1:1 (аналог diagnostic_stages)

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| parent_id | uuid | FK → parent_stages |
| created_by | uuid | FK → users |

**RLS политики:**
- SELECT: участники этапа или пользователи с правом `meetings.view`
- INSERT: пользователи с правом `meetings.create`
- UPDATE: пользователи с правом `meetings.update`

##### meeting_stage_participants
**Назначение:** Участники этапа встреч 1:1

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| stage_id | uuid | FK → meeting_stages |
| user_id | uuid | FK → users |

**RLS политики:**
- SELECT: участник или пользователи с правом `meetings.view`
- INSERT: пользователи с правом `meetings.create`
- DELETE: пользователи с правом `meetings.delete`

##### one_on_one_meetings
**Назначение:** Встречи 1:1 между сотрудником и руководителем

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| stage_id | uuid | FK → meeting_stages | - |
| employee_id | uuid | FK → users | - |
| manager_id | uuid | FK → users | - |
| status | text | Статус | 'draft' |
| meeting_date | timestamptz | Дата встречи | - |
| goal_and_agenda | text | Цель и повестка (заполняет сотрудник) | - |
| energy_gained | text | Что дает энергию (сотрудник) | - |
| energy_lost | text | Что отнимает энергию (сотрудник) | - |
| previous_decisions_debrief | text | Дебриф прошлых решений (сотрудник) | - |
| stoppers | text | Стопперы (сотрудник) | - |
| manager_comment | text | Комментарий руководителя | - |
| return_reason | text | Причина возврата | - |
| submitted_at | timestamptz | Дата отправки на утверждение | - |
| approved_at | timestamptz | Дата утверждения | - |
| returned_at | timestamptz | Дата возврата | - |

**Статусы:**
- `draft` - черновик (заполняет сотрудник)
- `submitted` - отправлено на утверждение
- `returned` - возвращено на доработку
- `approved` - утверждено руководителем

**RLS политики:**
- SELECT: сотрудник, руководитель, пользователи с правом `meetings.view_all`
- INSERT: сотрудник, руководитель, пользователи с правом `meetings.manage`
- UPDATE: сотрудник (если draft/returned), руководитель (если submitted), пользователи с правом `meetings.manage`

##### meeting_decisions
**Назначение:** Решения, принятые на встрече 1:1

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| meeting_id | uuid | FK → one_on_one_meetings |
| decision_text | text | Текст решения |
| is_completed | boolean | Выполнено |
| created_by | uuid | FK → users |

**RLS политики:**
- SELECT: участники встречи, пользователи с правом `meetings.view_all`
- INSERT/UPDATE: участники встречи, пользователи с правом `meetings.manage`

#### 2.1.8 Задачи

##### tasks
**Назначение:** Задачи пользователей (оценки, встречи, развитие)

**Поля:**
| Поле | Тип | Описание | По умолчанию |
|------|-----|----------|--------------|
| id | uuid | PK | gen_random_uuid() |
| user_id | uuid | FK → users | - |
| title | text | Название | - |
| description | text | Описание | - |
| status | text | Статус | 'pending' |
| task_type | text | Тип задачи | - |
| category | text | Категория | - |
| priority | text | Приоритет | - |
| deadline | timestamptz | Срок | - |
| diagnostic_stage_id | uuid | FK → diagnostic_stages | - |
| assignment_id | uuid | FK → survey_360_assignments | - |
| assignment_type | text | Тип назначения (self, manager, peer) | - |
| competency_ref | text | Ссылка на компетенцию | - |
| kpi_expected_level | numeric | Ожидаемый уровень KPI | - |
| kpi_result_level | numeric | Результат KPI | - |

**Статусы:**
- `pending` - ожидает выполнения
- `in_progress` - в процессе
- `completed` - завершено
- `cancelled` - отменено

**Типы задач:**
- `diagnostic_stage` - задача на прохождение диагностики (самооценка)
- `survey_360_evaluation` - задача на оценку 360° (коллеги, руководитель)
- `skill_survey` - задача на оценку навыков
- `meeting` - задача на встречу 1:1
- `assessment` - комплексная оценка
- `development` - задача развития

**Триггеры:**
- `validate_task_diagnostic_stage_id` BEFORE INSERT → валидирует наличие diagnostic_stage_id для определенных типов задач
- Автоматическое создание через триггеры на других таблицах

**RLS политики:**
- SELECT: владелец задачи, руководитель, Admin/HR
- INSERT: автоматически через триггеры, пользователи с правом `tasks.manage`
- UPDATE: владелец задачи, пользователи с правом `tasks.manage`
- DELETE: пользователи с правом `tasks.manage`

#### 2.1.9 Развитие и карьера

##### development_plans
**Назначение:** Планы развития

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| title | text | Название плана |
| description | text | Описание |
| status | text | Статус |
| start_date | date | Дата начала |
| end_date | date | Дата окончания |
| created_by | uuid | FK → users |

**RLS политики:**
- SELECT: владелец, пользователи с правом `development.view_all`
- INSERT: владелец, пользователи с правом `development.manage`
- UPDATE: владелец, пользователи с правом `development.manage`

##### development_tasks
**Назначение:** Шаблоны задач развития

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| task_name | text | Название задачи |
| task_goal | text | Цель |
| how_to | text | Как выполнить |
| measurable_result | text | Измеримый результат |
| skill_id | uuid | FK → skills |
| quality_id | uuid | FK → qualities |
| competency_level_id | uuid | FK → competency_levels |
| task_order | integer | Порядок |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### career_tracks
**Назначение:** Карьерные треки

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| name | text | Название трека |
| description | text | Описание |
| target_position_id | uuid | FK → positions |
| track_type_id | uuid | FK → track_types |
| duration_months | integer | Длительность (месяцы) |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### career_track_steps
**Назначение:** Шаги карьерного трека

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| career_track_id | uuid | FK → career_tracks |
| grade_id | uuid | FK → grades |
| step_order | integer | Порядок шага |
| duration_months | integer | Длительность шага |
| description | text | Описание |

**RLS:** SELECT доступен всем, управление - Admin/HR

##### user_career_progress
**Назначение:** Прогресс пользователя по карьерному треку

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| career_track_id | uuid | FK → career_tracks |
| current_step_id | uuid | FK → career_track_steps |
| status | text | Статус |
| selected_at | timestamptz | Дата выбора трека |

**RLS политики:**
- SELECT: владелец, руководитель, Admin/HR
- INSERT/UPDATE: владелец, пользователи с правом `development.manage`

##### user_career_ratings
**Назначение:** Рейтинги пользователя для карьерного роста

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| career_track_id | uuid | FK → career_tracks |
| grade_id | uuid | FK → grades |
| evaluation_period | text | Период оценки |
| s_hard | numeric | Оценка hard skills |
| s_soft | numeric | Оценка soft skills |
| s_final | numeric | Итоговая оценка |
| calculated_at | timestamptz | Дата расчета |

#### 2.1.10 Логирование и аудит

##### audit_log
**Назначение:** Журнал действий администраторов

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| admin_id | uuid | FK → users |
| target_user_id | uuid | FK → users |
| action_type | text | Тип действия |
| field | text | Измененное поле |
| old_value | text | Старое значение |
| new_value | text | Новое значение |
| details | jsonb | Дополнительная информация |
| created_at | timestamptz | Дата действия |

**RLS политики:**
- SELECT: только Admin
- INSERT: системная (через функцию log_admin_action)

##### admin_activity_logs
**Назначение:** Детальный лог активности администраторов

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| user_name | text | Имя пользователя |
| action | text | Действие |
| entity_type | text | Тип сущности |
| entity_name | text | Название сущности |
| details | jsonb | Детали |
| created_at | timestamptz | Дата |

**RLS политики:**
- SELECT: только Admin
- INSERT: системная

##### access_denied_logs
**Назначение:** Журнал отказов в доступе

**Поля:**
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| permission_name | text | Требуемое право |
| resource_type | text | Тип ресурса |
| resource_id | uuid | ID ресурса |
| action_attempted | text | Попытка действия |
| user_role | app_role | Роль пользователя |
| ip_address | inet | IP адрес |
| user_agent | text | User Agent |
| created_at | timestamptz | Дата |

**RLS политики:**
- SELECT: только Admin
- INSERT: системная (через функцию log_access_denied)

---

## 3. ТРИГГЕРЫ И АВТОМАТИЗАЦИЯ

### 3.1 Триггеры обновления timestamps

**Функция:** `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

**Применяется к таблицам:**
- users
- diagnostic_stages
- survey_360_assignments
- one_on_one_meetings
- meeting_decisions
- tasks
- development_plans
- career_tracks
- grades
- skills
- qualities
- и другие справочники

**Событие:** BEFORE UPDATE
**Назначение:** Автоматическое обновление поля updated_at при любом изменении записи

### 3.2 Триггеры диагностики

#### assign_surveys_to_diagnostic_participant
**Таблица:** diagnostic_stage_participants  
**Событие:** AFTER INSERT  
**Функция:** `assign_surveys_to_diagnostic_participant()`

**Логика:**
1. При добавлении участника в diagnostic_stage_participants
2. Автоматически создает 2 записи в survey_360_assignments:
   - Самооценку (evaluated_user_id = evaluating_user_id = NEW.user_id, assignment_type = 'self', status = 'approved')
   - Оценку руководителем (если есть manager_id), assignment_type = 'manager', status = 'approved'
3. Утверждающим (approved_by) назначается руководитель

#### create_diagnostic_task_for_participant
**Таблица:** diagnostic_stage_participants  
**Событие:** AFTER INSERT  
**Функция:** `create_diagnostic_task_for_participant()`

**Логика:**
1. При добавлении участника создает задачу для сотрудника:
   - title: "Пройти самооценку"
   - task_type: 'diagnostic_stage'
   - category: 'Диагностика'
   - status: 'pending'
   - assignment_type: 'self'
   - Привязывает к самооценке через assignment_id
2. Если есть руководитель, создает задачу для руководителя:
   - title: "Оценка подчинённого: [ФИО]"
   - task_type: 'survey_360_evaluation'
   - category: 'Оценка 360'
   - assignment_type: 'manager'

#### delete_diagnostic_tasks_on_participant_remove
**Таблица:** diagnostic_stage_participants  
**Событие:** AFTER DELETE  
**Функция:** `delete_diagnostic_tasks_on_participant_remove()`

**Логика:**
1. При удалении участника удаляет его задачи на диагностику
2. Удаляет задачу руководителя на оценку этого участника

#### update_diagnostic_stage_on_participant_add
**Таблица:** diagnostic_stage_participants  
**Событие:** AFTER INSERT/UPDATE/DELETE  
**Функция:** `update_diagnostic_stage_on_participant_add()`

**Логика:**
1. Вызывает `calculate_diagnostic_stage_progress(stage_id)` для расчета прогресса
2. Обновляет diagnostic_stages.progress_percent
3. Обновляет diagnostic_stages.status на основе прогресса:
   - 0% → 'setup'
   - 1-99% → 'assessment'
   - 100% → 'completed'

### 3.3 Триггеры оценки навыков

#### set_evaluation_period
**Таблица:** hard_skill_results, soft_skill_results  
**Событие:** BEFORE INSERT  
**Функция:** `set_evaluation_period()`

**Логика:**
```sql
NEW.evaluation_period = get_evaluation_period(NEW.created_at);
-- Возвращает 'H1_2025' или 'H2_2025' в зависимости от месяца
```

#### update_user_skills_from_survey
**Таблица:** hard_skill_results  
**Событие:** AFTER INSERT/UPDATE  
**Функция:** `update_user_skills_from_survey()`

**Логика:**
1. Срабатывает только если is_draft = false
2. Обновляет или создает запись в user_skills
3. Вычисляет среднее значение current_level по всем ответам пользователя на вопросы по этому навыку
4. Устанавливает target_level = current_level + 1

#### update_user_qualities_from_survey
**Таблица:** soft_skill_results  
**Событие:** AFTER INSERT/UPDATE  
**Функция:** `update_user_qualities_from_survey()`

**Логика:**
1. Срабатывает только если is_draft = false
2. Обновляет или создает запись в user_qualities
3. Вычисляет среднее значение current_level по всем ответам
4. Устанавливает target_level = current_level + 1

#### aggregate_hard_skill_results
**Таблица:** hard_skill_results  
**Событие:** AFTER INSERT/UPDATE  
**Функция:** `aggregate_hard_skill_results()`

**Логика:**
1. Удаляет старые агрегированные данные для этого пользователя и этапа
2. Группирует результаты по skill_id
3. Вычисляет для каждого навыка:
   - self_assessment: AVG для evaluating_user_id = evaluated_user_id
   - manager_assessment: AVG для evaluating_user_id = manager_id
   - peers_average: AVG для остальных оценивающих
   - total_responses: COUNT
4. Сохраняет в user_assessment_results

#### aggregate_soft_skill_results
**Таблица:** soft_skill_results  
**Событие:** AFTER INSERT/UPDATE  
**Функция:** `aggregate_soft_skill_results()`

**Логика:** Аналогична aggregate_hard_skill_results, но для quality_id

### 3.4 Триггеры назначений (assignments)

#### auto_assign_manager_for_360
**Таблица:** survey_360_assignments  
**Событие:** AFTER INSERT  
**Функция:** `auto_assign_manager_for_360()`

**Логика:**
1. Если создается самооценка (evaluating_user_id = evaluated_user_id)
2. И у оцениваемого есть руководитель
3. Автоматически создает назначение для руководителя:
   - assignment_type = 'manager'
   - status = 'approved'
   - is_manager_participant = true

#### create_task_on_assignment_approval
**Таблица:** survey_360_assignments  
**Событие:** AFTER UPDATE  
**Функция:** `create_task_on_assignment_approval()`

**Логика:**
1. Срабатывает при изменении status на 'approved'
2. Только для назначений БЕЗ diagnostic_stage_id (ручные назначения)
3. Создает задачу для evaluating_user_id:
   - Для самооценки: title = "Самооценка 360"
   - Для оценки коллеги: title = "Оценка 360: [ФИО]"
4. Привязывает задачу к assignment через assignment_id

#### update_assignment_on_survey_completion
**Таблица:** hard_skill_results, soft_skill_results  
**Событие:** AFTER UPDATE  
**Функция:** `update_assignment_on_survey_completion()`

**Логика:**
1. Срабатывает при is_draft = false
2. Обновляет связанный survey_360_assignment:
   - status = 'completed'

#### update_task_status_on_assignment_change
**Таблица:** survey_360_assignments  
**Событие:** AFTER UPDATE  
**Функция:** `update_task_status_on_assignment_change()`

**Логика:**
1. Срабатывает при изменении status на 'completed'
2. Обновляет связанную задачу:
   - tasks.status = 'completed'

#### complete_diagnostic_task_on_surveys_completion
**Таблица:** hard_skill_results, soft_skill_results  
**Событие:** AFTER INSERT/UPDATE  
**Функция:** `complete_diagnostic_task_on_surveys_completion()`

**Логика:**
1. Проверяет, есть ли у evaluated_user_id результаты ОБОИХ типов опросов (hard AND soft)
2. Если есть, обновляет задачу типа 'assessment' на status = 'completed'

### 3.5 Триггеры прав доступа

#### trigger_refresh_user_permissions
**Таблица:** user_roles  
**Событие:** AFTER INSERT/UPDATE/DELETE  
**Функция:** `trigger_refresh_user_permissions()`

**Логика:**
1. Вызывает `refresh_user_effective_permissions(NEW.user_id или OLD.user_id)`
2. Функция пересчитывает все effective permissions для пользователя:
   - Удаляет старые записи из user_effective_permissions
   - Собирает все permissions через user_roles → role_permissions → permissions
   - Вставляет новые записи

#### trigger_refresh_role_permissions
**Таблица:** role_permissions  
**Событие:** AFTER INSERT/UPDATE/DELETE  
**Функция:** `trigger_refresh_role_permissions()`

**Логика:**
1. Вызывает `refresh_role_effective_permissions(NEW.role или OLD.role)`
2. Функция находит всех пользователей с этой ролью
3. Вызывает refresh_user_effective_permissions для каждого

### 3.6 Триггеры валидации

#### validate_task_diagnostic_stage_id
**Таблица:** tasks  
**Событие:** BEFORE INSERT  
**Функция:** `validate_task_diagnostic_stage_id()`

**Логика:**
1. Проверяет, что для задач типа diagnostic_stage, survey_360_evaluation, skill_survey
2. Обязательно заполнено diagnostic_stage_id
3. Если не заполнено, RETURN NULL блокирует вставку

---

## 4. SQL ФУНКЦИИ И ПРОЦЕДУРЫ

### 4.1 Функции авторизации и прав доступа

#### has_permission(_user_id uuid, _permission_name text) → boolean
**Назначение:** Проверка наличия права у пользователя

**Параметры:**
- `_user_id` - ID пользователя
- `_permission_name` - название права (например, "diagnostics.create")

**Возвращает:** TRUE если право есть, FALSE если нет

**Сигнатура:**
```sql
CREATE OR REPLACE FUNCTION has_permission(
  _user_id uuid,
  _permission_name text
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
```

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM user_effective_permissions
  WHERE user_id = _user_id
    AND permission_name = _permission_name
);
```

**Использование:**
- В RLS политиках: `WITH CHECK (has_permission(auth.uid(), 'diagnostics.create'))`
- Во фронтенде через RPC: `supabase.rpc('has_permission', { _user_id, _permission_name })`
- В usePermission hook

#### get_current_user_id() → uuid
**Назначение:** Получить ID текущего авторизованного пользователя

**Сигнатура:**
```sql
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
```

**Логика:**
```sql
SELECT auth.uid();
```

**Использование:** В RLS политиках вместо прямого `auth.uid()`

#### get_user_role(_user_id uuid) → app_role
**Назначение:** Получить роль пользователя

**Параметры:**
- `_user_id` - ID пользователя

**Возвращает:** Роль (admin, hr_bp, manager, employee) или NULL

**Логика:**
```sql
SELECT role
FROM user_roles
WHERE user_id = _user_id
LIMIT 1;
```

#### is_users_manager(_manager_id uuid, _user_id uuid) → boolean
**Назначение:** Проверить, является ли первый пользователь руководителем второго

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM users
  WHERE id = _user_id
    AND manager_id = _manager_id
);
```

#### can_view_users(_user_id uuid) → boolean
**Назначение:** Может ли пользователь просматривать список пользователей

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM user_effective_permissions
  WHERE user_id = _user_id
    AND permission_name IN ('users.view', 'security.manage_users')
);
```

#### can_manage_users(_user_id uuid) → boolean
**Назначение:** Может ли пользователь управлять пользователями

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM user_effective_permissions
  WHERE user_id = _user_id
    AND permission_name = 'security.manage_users'
);
```

### 4.2 Функции диагностики

#### is_diagnostic_stage_participant(_stage_id uuid, _user_id uuid) → boolean
**Назначение:** Проверить, является ли пользователь участником диагностического этапа

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM diagnostic_stage_participants
  WHERE stage_id = _stage_id
    AND user_id = _user_id
);
```

**Использование:** В RLS политиках для ограничения доступа к данным этапа

#### calculate_diagnostic_stage_progress(stage_id_param uuid) → numeric
**Назначение:** Вычислить процент выполнения диагностического этапа

**Логика:**
1. Подсчитывает количество участников этапа (total_participants)
2. total_required = total_participants * 2 (навыки + 360)
3. Подсчитывает completed_skill_surveys (уникальные evaluated_user_id с is_draft=false)
4. Подсчитывает completed_360_surveys (аналогично)
5. progress = (completed_skill_surveys + completed_360_surveys) / total_required * 100

**Возвращает:** Процент (0-100), округленный до 2 знаков

#### check_diagnostic_invariants(stage_id_param uuid) → TABLE
**Назначение:** Проверка целостности данных диагностики

**Возвращает таблицу:**
- check_name (text): название проверки
- status (text): OK, FAIL, WARNING
- details (jsonb): детали найденных проблем

**Проверки:**
1. assignment_type_values: допустимы только self, manager, peer
2. assignment_type_match: соответствие между tasks и assignments
3. required_fields: отсутствие NULL в обязательных полях
4. category_check: category должна быть 'assessment'

#### check_diagnostic_data_consistency() → TABLE
**Назначение:** Проверка согласованности данных диагностики

**Проверки:**
1. assignments_without_tasks: назначения без задач
2. tasks_without_assignments: задачи без назначений
3. status_mismatch: несоответствие статусов tasks и assignments
4. duplicate_assignments: дублирующиеся назначения

### 4.3 Функции встреч 1:1

#### is_meeting_participant(_meeting_id uuid, _user_id uuid) → boolean
**Назначение:** Проверить, является ли пользователь участником встречи

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM one_on_one_meetings
  WHERE id = _meeting_id
    AND (employee_id = _user_id OR manager_id = _user_id)
);
```

#### is_meeting_stage_participant(_stage_id uuid, _user_id uuid) → boolean
**Назначение:** Проверить, является ли пользователь участником этапа встреч

**Логика:**
```sql
SELECT EXISTS (
  SELECT 1
  FROM meeting_stage_participants
  WHERE stage_id = _stage_id
    AND user_id = _user_id
);
```

#### check_meetings_data_consistency() → TABLE
**Назначение:** Проверка согласованности данных встреч

**Проверки:**
1. participants_without_meetings: участники без встреч
2. meetings_without_participants: встречи без участников
3. participants_without_tasks: участники без задач
4. meetings_invalid_status_transitions: некорректные переходы статусов
5. decisions_without_meetings: решения без встреч

### 4.4 Функции карьерных треков

#### calculate_career_gap(p_user_id uuid, p_grade_id uuid) → TABLE
**Назначение:** Расчет gap-анализа для перехода на грейд

**Параметры:**
- `p_user_id` - ID пользователя
- `p_grade_id` - ID целевого грейда

**Возвращает таблицу:**
- competency_type (text): 'skill' или 'quality'
- competency_id (uuid): ID навыка/качества
- competency_name (text): название
- current_level (numeric): текущий уровень пользователя
- target_level (numeric): требуемый уровень для грейда
- gap (numeric): разница (target - current)
- is_ready (boolean): готов ли (current >= target)

**Логика:**
1. Для навыков: берет grade_skills для грейда
2. Сопоставляет с user_assessment_results.self_assessment
3. Вычисляет gap
4. Аналогично для качеств через grade_qualities

#### recommend_career_tracks(p_user_id uuid, p_limit integer) → TABLE
**Назначение:** Рекомендация карьерных треков для пользователя

**Возвращает таблицу:**
- track_id (uuid)
- track_name (text)
- track_type_name (text)
- target_position_name (text)
- compatibility_score (numeric): оценка совместимости (0-100)
- total_gap (numeric): суммарный gap по всем шагам
- steps_count (integer): количество шагов

**Логика подсчета compatibility_score:**
1. +50 если target_position_id совпадает с позицией пользователя
2. +20 иначе
3. +30 если у трека есть шаги
4. Сортировка: по compatibility_score DESC, total_gap ASC

#### get_recommended_development_tasks(p_user_id uuid, p_grade_id uuid, p_limit integer) → TABLE
**Назначение:** Получить рекомендуемые задачи развития

**Возвращает:**
- task_id, task_name, task_goal, how_to, measurable_result
- competency_type, competency_id, competency_name
- current_level, target_level, gap

**Логика:**
1. Вызывает calculate_career_gap
2. Фильтрует только компетенции с gap > 0
3. Находит development_tasks по skill_id или quality_id
4. Возвращает до 2 задач на каждую компетенцию
5. Сортирует по gap DESC

#### check_career_data_consistency() → TABLE
**Назначение:** Проверка согласованности данных карьерных треков

**Проверки:**
1. tracks_without_steps: треки без шагов
2. grades_without_competencies: грейды без навыков/качеств
3. invalid_step_order: шаги с порядком < 1
4. progress_invalid_tracks: прогресс по несуществующим трекам

### 4.5 Функции логирования

#### log_admin_action(...) → uuid
**Назначение:** Логирование действия администратора

**Параметры:**
- `_admin_id` - ID администратора
- `_target_user_id` - ID целевого пользователя
- `_action_type` - тип действия
- `_field` - измененное поле (опционально)
- `_old_value` - старое значение (опционально)
- `_new_value` - новое значение (опционально)
- `_details` - дополнительные детали в JSONB (опционально)

**Возвращает:** ID созданной записи в audit_log

**Логика:**
```sql
INSERT INTO audit_log (...) VALUES (...) RETURNING id;
```

#### log_access_denied(...) → void
**Назначение:** Логирование отказа в доступе

**Параметры:**
- `_permission_name` - требуемое право
- `_resource_type` - тип ресурса (опционально)
- `_resource_id` - ID ресурса (опционально)
- `_action_attempted` - попытка действия (опционально)

**Логика:**
1. Получает current_user_id через get_current_user_id()
2. Получает роль пользователя
3. Записывает в access_denied_logs

### 4.6 Вспомогательные функции

#### get_evaluation_period(created_date timestamptz) → text
**Назначение:** Определить период оценки (H1 или H2)

**Логика:**
```sql
IF EXTRACT(MONTH FROM created_date) <= 6 THEN
  RETURN 'H1_' || EXTRACT(YEAR FROM created_date);
ELSE
  RETURN 'H2_' || EXTRACT(YEAR FROM created_date);
END IF;
```

**Пример:** '2025-03-15' → 'H1_2025', '2025-08-20' → 'H2_2025'

#### get_stage_status_by_dates(start_date date, end_date date) → text
**Назначение:** Определить статус этапа по датам

**Логика:**
```sql
IF CURRENT_DATE < start_date THEN
  RETURN 'upcoming';
ELSIF CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date THEN
  RETURN 'active';
ELSE
  RETURN 'completed';
END IF;
```

#### get_user_manager_id(_user_id uuid) → uuid
**Назначение:** Получить ID руководителя пользователя

**Логика:**
```sql
SELECT manager_id FROM users WHERE id = _user_id;
```

#### get_user_department_id(_user_id uuid) → uuid
**Назначение:** Получить ID отдела пользователя

#### get_hr_bp_company_department_ids(_user_id uuid) → TABLE(department_id uuid)
**Назначение:** Получить все отделы компании, к которой относится HR BP

**Логика:**
```sql
SELECT d2.id
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN departments d1 ON d1.id = u.department_id
JOIN departments d2 ON d2.company_id = d1.company_id
WHERE ur.user_id = _user_id
  AND ur.role = 'hr_bp';
```

#### get_users_with_roles() → TABLE
**Назначение:** Получить список пользователей с их ролями

**Возвращает:**
- id, email, status, last_login_at, created_at, updated_at, role

**Логика:**
```sql
SELECT u.*, ur.role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id;
```

#### get_all_permissions() → SETOF permissions
**Назначение:** Получить все разрешения

#### get_role_permissions() → SETOF role_permissions
**Назначение:** Получить все связи ролей и разрешений

#### get_user_with_role(user_email text) → TABLE
**Назначение:** Получить пользователя с ролью по email

**Возвращает:**
- id, full_name, email, role_name

### 4.7 Функции refresh (обновление кэша)

#### refresh_user_effective_permissions(target_user_id uuid) → void
**Назначение:** Обновить эффективные разрешения пользователя

**Логика:**
1. Удалить все записи из user_effective_permissions для пользователя
2. Собрать все permissions через user_roles → role_permissions → permissions
3. Вставить новые записи

#### refresh_role_effective_permissions(target_role app_role) → void
**Назначение:** Обновить эффективные разрешения для всех пользователей с ролью

**Логика:**
1. Найти всех пользователей с этой ролью
2. Вызвать refresh_user_effective_permissions для каждого

---

## 5. СИСТЕМА РОЛЕЙ И ПРАВ ДОСТУПА

### 5.1 Роли (app_role enum)

```sql
CREATE TYPE app_role AS ENUM ('admin', 'hr_bp', 'manager', 'employee');
```

| Роль | Название | Описание | Количество permissions |
|------|---------|----------|------------------------|
| **admin** | Администратор | Полный доступ к системе | ВСЕ (76) |
| **hr_bp** | HR Business Partner | HR-функции, диагностика, аналитика | 45 |
| **manager** | Руководитель | Управление командой, оценка подчиненных | 28 |
| **employee** | Сотрудник | Базовые функции | 15 |

### 5.2 Полный список permissions

#### 5.2.1 Security (Безопасность)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| security.manage_users | Управление пользователями | ✅ | ❌ | ❌ | ❌ |
| security.manage_roles | Управление ролями | ✅ | ❌ | ❌ | ❌ |
| security.view_audit | Просмотр аудита | ✅ | ❌ | ❌ | ❌ |
| security.manage | Полный доступ к безопасности | ✅ | ❌ | ❌ | ❌ |

#### 5.2.2 Users (Пользователи)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| users.view | Просмотр списка пользователей | ✅ | ✅ | ✅ | ❌ |
| users.view_team | Просмотр своей команды | ✅ | ✅ | ✅ | ❌ |
| users.view_all | Просмотр всех пользователей | ✅ | ✅ | ❌ | ❌ |
| users.create | Создание пользователей | ✅ | ✅ | ❌ | ❌ |
| users.update | Обновление пользователей | ✅ | ✅ | ❌ | ❌ |
| users.update_own | Обновление своего профиля | ✅ | ✅ | ✅ | ✅ |
| users.delete | Удаление пользователей | ✅ | ❌ | ❌ | ❌ |

#### 5.2.3 Diagnostics (Диагностика)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| diagnostics.view | Просмотр диагностики | ✅ | ✅ | ✅ | ✅* |
| diagnostics.create | Создание этапов | ✅ | ✅ | ❌ | ❌ |
| diagnostics.update | Изменение этапов | ✅ | ✅ | ❌ | ❌ |
| diagnostics.delete | Удаление этапов | ✅ | ✅ | ❌ | ❌ |
| diagnostics.manage | Полное управление | ✅ | ✅ | ❌ | ❌ |
| diagnostics.manage_participants | Управление участниками | ✅ | ✅ | ❌ | ❌ |

*Employee видит только этапы, в которых является участником

#### 5.2.4 Surveys (Опросы)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| surveys.take_own | Прохождение своих опросов | ✅ | ✅ | ✅ | ✅ |
| surveys.view_results | Просмотр своих результатов | ✅ | ✅ | ✅ | ✅ |
| surveys.view_team_results | Просмотр результатов команды | ✅ | ✅ | ✅ | ❌ |
| surveys.view_all_results | Просмотр всех результатов | ✅ | ✅ | ❌ | ❌ |
| surveys.manage_questions | Управление вопросами | ✅ | ✅ | ❌ | ❌ |
| surveys.approve_respondents | Утверждение респондентов | ✅ | ✅ | ✅ | ❌ |

#### 5.2.5 Skills (Навыки)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| skills.view | Просмотр навыков | ✅ | ✅ | ✅ | ✅ |
| skills.manage | Управление навыками | ✅ | ✅ | ❌ | ❌ |

#### 5.2.6 Qualities (Качества)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| qualities.view | Просмотр качеств | ✅ | ✅ | ✅ | ✅ |
| qualities.manage | Управление качествами | ✅ | ✅ | ❌ | ❌ |

#### 5.2.7 Meetings (Встречи 1:1)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| meetings.view | Просмотр своих встреч | ✅ | ✅ | ✅ | ✅ |
| meetings.view_team | Просмотр встреч команды | ✅ | ✅ | ✅ | ❌ |
| meetings.view_all | Просмотр всех встреч | ✅ | ✅ | ❌ | ❌ |
| meetings.create | Создание этапов встреч | ✅ | ✅ | ❌ | ❌ |
| meetings.update | Изменение этапов | ✅ | ✅ | ❌ | ❌ |
| meetings.delete | Удаление этапов | ✅ | ✅ | ❌ | ❌ |
| meetings.manage | Полное управление | ✅ | ✅ | ❌ | ❌ |

#### 5.2.8 Development (Развитие)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| development.view_own | Просмотр своих планов | ✅ | ✅ | ✅ | ✅ |
| development.view_team | Просмотр планов команды | ✅ | ✅ | ✅ | ❌ |
| development.view_all | Просмотр всех планов | ✅ | ✅ | ❌ | ❌ |
| development.manage | Управление планами развития | ✅ | ✅ | ✅ | ❌ |
| development.manage_tasks | Управление задачами развития | ✅ | ✅ | ❌ | ❌ |

#### 5.2.9 Career (Карьера)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| career.view_tracks | Просмотр карьерных треков | ✅ | ✅ | ✅ | ✅ |
| career.manage_tracks | Управление треками | ✅ | ✅ | ❌ | ❌ |

#### 5.2.10 Tasks (Задачи)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| tasks.view_own | Просмотр своих задач | ✅ | ✅ | ✅ | ✅ |
| tasks.view_team | Просмотр задач команды | ✅ | ✅ | ✅ | ❌ |
| tasks.view_all | Просмотр всех задач | ✅ | ✅ | ❌ | ❌ |
| tasks.manage | Управление задачами | ✅ | ✅ | ❌ | ❌ |

#### 5.2.11 Analytics (Аналитика)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| analytics.view_own | Просмотр своей аналитики | ✅ | ✅ | ✅ | ✅ |
| analytics.view_team | Просмотр аналитики команды | ✅ | ✅ | ✅ | ❌ |
| analytics.view_all | Просмотр всей аналитики | ✅ | ✅ | ❌ | ❌ |

#### 5.2.12 Grades (Грейды)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| grades.view | Просмотр грейдов | ✅ | ✅ | ✅ | ✅ |
| grades.manage | Управление грейдами | ✅ | ✅ | ❌ | ❌ |

#### 5.2.13 Departments (Отделы)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| departments.view | Просмотр отделов | ✅ | ✅ | ✅ | ✅ |
| departments.manage | Управление отделами | ✅ | ✅ | ❌ | ❌ |

#### 5.2.14 Positions (Должности)

| Право | Действие | Admin | HR BP | Manager | Employee |
|-------|---------|-------|-------|---------|----------|
| positions.view | Просмотр должностей | ✅ | ✅ | ✅ | ✅ |
| positions.manage | Управление должностями | ✅ | ✅ | ❌ | ❌ |

### 5.3 Применение прав в RLS политиках

#### Примеры RLS политик с has_permission

**diagnostic_stages - SELECT:**
```sql
CREATE POLICY "diagnostic_stages_select_auth_policy"
ON diagnostic_stages FOR SELECT
USING (
  is_diagnostic_stage_participant(id, auth.uid())
  OR has_permission(auth.uid(), 'diagnostics.manage')
);
```

**users - UPDATE:**
```sql
CREATE POLICY "users_update_own"
ON users FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_admin"
ON users FOR UPDATE
USING (has_permission(auth.uid(), 'users.update'))
WITH CHECK (has_permission(auth.uid(), 'users.update'));
```

**survey_360_assignments - INSERT:**
```sql
CREATE POLICY "survey_360_assignments_insert"
ON survey_360_assignments FOR INSERT
WITH CHECK (
  evaluated_user_id = auth.uid()
  OR has_permission(auth.uid(), 'diagnostics.manage')
);
```

**one_on_one_meetings - SELECT:**
```sql
CREATE POLICY "one_on_one_meetings_select_auth_policy"
ON one_on_one_meetings FOR SELECT
USING (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR has_permission(auth.uid(), 'meetings.view_all')
);
```

### 5.4 Использование во фронтенде

#### usePermission hook

**Расположение:** `src/hooks/usePermission.ts`

```typescript
export const usePermission = (permissionName: string) => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('has_permission', {
        _user_id: user.id,
        _permission_name: permissionName
      });

      setHasPermission(data ?? false);
      setIsLoading(false);
    };

    checkPermission();
  }, [user, permissionName]);

  return { hasPermission, isLoading };
};
```

**Использование в компонентах:**

```typescript
const { hasPermission, isLoading } = usePermission('diagnostics.create');

if (isLoading) return <Spinner />;
if (!hasPermission) return null;

return <CreateDiagnosticButton />;
```

#### usePermissions hook (множественная проверка)

```typescript
export const usePermissions = (permissionNames: string[]) => {
  // ... возвращает объект { [permissionName]: boolean }
};
```

**Пример:**

```typescript
const permissions = usePermissions([
  'diagnostics.create',
  'diagnostics.update',
  'diagnostics.delete'
]);

<Button disabled={!permissions['diagnostics.create']}>
  Создать этап
</Button>
```

### 5.5 Permission Groups (группировка для UI)

**Таблица:** permission_groups

| ID | Name | Label | Icon | Display Order |
|----|------|-------|------|---------------|
| ... | security | Безопасность | Shield | 1 |
| ... | users | Пользователи | Users | 2 |
| ... | diagnostics | Диагностика | Activity | 3 |
| ... | surveys | Опросы | FileText | 4 |
| ... | meetings | Встречи | Calendar | 5 |
| ... | development | Развитие | TrendingUp | 6 |
| ... | analytics | Аналитика | BarChart | 7 |

**Использование в SecurityManagementPage:**

Компонент RolesPermissionsManager группирует permissions по группам для удобного отображения в UI при назначении прав ролям.

---

## 6. API И RPC ФУНКЦИИ

### 6.1 Список всех RPC функций

**Типизация:** `src/types/supabase-rpc.ts`

```typescript
export interface SupabaseRPCFunctions {
  // Authorization
  has_permission: {
    args: { _user_id: string; _permission_name: string };
    returns: boolean;
  };
  get_user_role: {
    args: { _user_id: string };
    returns: 'admin' | 'hr_bp' | 'manager' | 'employee' | null;
  };
  is_users_manager: {
    args: { _manager_id: string; _user_id: string };
    returns: boolean;
  };
  // ... (полный список см. в файле)
}
```

### 6.2 Детальное описание основных RPC

#### 6.2.1 Authorization Functions

##### has_permission
**Endpoint:** `supabase.rpc('has_permission', { _user_id, _permission_name })`

**Параметры:**
- `_user_id`: UUID пользователя
- `_permission_name`: строка вида "resource.action" (например, "diagnostics.create")

**Возвращает:** boolean

**Требования RLS:** нет (SECURITY DEFINER)

**Типичные сценарии:**
- Проверка перед отображением кнопок/компонентов
- Условный рендеринг функционала
- Валидация перед API запросами

**Пример:**
```typescript
const { data: canCreate } = await supabase.rpc('has_permission', {
  _user_id: user.id,
  _permission_name: 'diagnostics.create'
});

if (canCreate) {
  // show create button
}
```

##### get_user_role
**Endpoint:** `supabase.rpc('get_user_role', { _user_id })`

**Возвращает:** 'admin' | 'hr_bp' | 'manager' | 'employee' | null

**Использование:** Определение роли для условной логики

##### get_users_with_roles
**Endpoint:** `supabase.rpc('get_users_with_roles')`

**Возвращает:** массив объектов с полями:
- id, email, status, last_login_at, created_at, updated_at, role

**Использование:** Получение списка пользователей с ролями для админ-панели

#### 6.2.2 Permissions Management

##### get_all_permissions
**Endpoint:** `supabase.rpc('get_all_permissions')`

**Возвращает:** массив всех permissions

**Использование:** Отображение списка доступных прав в UI управления ролями

##### get_role_permissions
**Endpoint:** `supabase.rpc('get_role_permissions')`

**Возвращает:** массив связей role ↔ permission

**Использование:** Отображение текущих прав ролей

#### 6.2.3 Diagnostics Functions

##### calculate_diagnostic_stage_progress
**Endpoint:** `supabase.rpc('calculate_diagnostic_stage_progress', { stage_id_param })`

**Параметры:**
- `stage_id_param`: UUID диагностического этапа

**Возвращает:** numeric (0-100)

**Использование:** Отображение прогресса выполнения этапа

##### check_diagnostic_invariants
**Endpoint:** `supabase.rpc('check_diagnostic_invariants', { stage_id_param })`

**Возвращает:** массив объектов { check_name, status, details }

**Использование:** Диагностика и отладка, проверка целостности данных

##### check_diagnostic_data_consistency
**Endpoint:** `supabase.rpc('check_diagnostic_data_consistency')`

**Возвращает:** массив проблем согласованности

**Использование:** Диагностика всей системы диагностики

##### is_diagnostic_stage_participant
**Endpoint:** `supabase.rpc('is_diagnostic_stage_participant', { _stage_id, _user_id })`

**Возвращает:** boolean

**Использование:** Проверка доступа к этапу

#### 6.2.4 Meetings Functions

##### is_meeting_participant
**Endpoint:** `supabase.rpc('is_meeting_participant', { _meeting_id, _user_id })`

**Возвращает:** boolean

**Использование:** Проверка доступа к встрече

##### is_meeting_stage_participant
**Endpoint:** `supabase.rpc('is_meeting_stage_participant', { _stage_id, _user_id })`

**Возвращает:** boolean

**Использование:** Проверка доступа к этапу встреч

##### check_meetings_data_consistency
**Endpoint:** `supabase.rpc('check_meetings_data_consistency')`

**Возвращает:** массив проблем согласованности

#### 6.2.5 Career Functions

##### calculate_career_gap
**Endpoint:** `supabase.rpc('calculate_career_gap', { p_user_id, p_grade_id })`

**Параметры:**
- `p_user_id`: UUID пользователя
- `p_grade_id`: UUID целевого грейда

**Возвращает:** массив объектов { competency_type, competency_id, competency_name, current_level, target_level, gap, is_ready }

**Использование:** Отображение gap-анализа в UI карьерного развития

**Пример вызова:**
```typescript
const { data: gapAnalysis } = await supabase.rpc('calculate_career_gap', {
  p_user_id: userId,
  p_grade_id: targetGradeId
});

// gapAnalysis = [
//   { competency_type: 'skill', competency_name: 'React', current_level: 3, target_level: 4, gap: 1, is_ready: false },
//   { competency_type: 'quality', competency_name: 'Leadership', current_level: 4, target_level: 4, gap: 0, is_ready: true }
// ]
```

##### recommend_career_tracks
**Endpoint:** `supabase.rpc('recommend_career_tracks', { p_user_id, p_limit })`

**Параметры:**
- `p_user_id`: UUID пользователя
- `p_limit`: количество треков (по умолчанию 5)

**Возвращает:** массив рекомендованных треков с оценкой совместимости

**Использование:** Рекомендации карьерных треков на DevelopmentPage

##### get_recommended_development_tasks
**Endpoint:** `supabase.rpc('get_recommended_development_tasks', { p_user_id, p_grade_id, p_limit })`

**Возвращает:** массив рекомендованных задач развития с привязкой к компетенциям

**Использование:** Генерация плана развития

#### 6.2.6 Audit Functions

##### log_admin_action
**Endpoint:** `supabase.rpc('log_admin_action', { ... })`

**Параметры:** см. раздел 4.5

**Возвращает:** UUID созданной записи

**Использование:** Вызывается автоматически при админ-действиях

##### log_access_denied
**Endpoint:** `supabase.rpc('log_access_denied', { ... })`

**Использование:** Автоматическое логирование при отказе в доступе

#### 6.2.7 Utility Functions

##### get_evaluation_period
**Endpoint:** `supabase.rpc('get_evaluation_period', { created_date })`

**Возвращает:** строка вида "H1_2025" или "H2_2025"

##### get_user_with_role
**Endpoint:** `supabase.rpc('get_user_with_role', { user_email })`

**Возвращает:** объект { id, full_name, email, role_name }

**Использование:** Поиск пользователя по email с ролью

##### get_stage_status_by_dates
**Endpoint:** `supabase.rpc('get_stage_status_by_dates', { start_date, end_date })`

**Возвращает:** 'upcoming' | 'active' | 'completed'

### 6.3 Типичные паттерны вызовов

#### Проверка прав перед действием

```typescript
const handleCreateStage = async () => {
  const { data: canCreate } = await supabase.rpc('has_permission', {
    _user_id: user.id,
    _permission_name: 'diagnostics.create'
  });

  if (!canCreate) {
    toast.error("Недостаточно прав");
    return;
  }

  // proceed with creation
};
```

#### Загрузка данных с проверкой доступа

```typescript
const loadDiagnosticStage = async (stageId: string) => {
  const { data: isParticipant } = await supabase.rpc('is_diagnostic_stage_participant', {
    _stage_id: stageId,
    _user_id: user.id
  });

  if (!isParticipant) {
    navigate('/');
    return;
  }

  const { data: stage } = await supabase
    .from('diagnostic_stages')
    .select('*')
    .eq('id', stageId)
    .single();
};
```

#### Расчет прогресса

```typescript
const updateProgress = async (stageId: string) => {
  const { data: progress } = await supabase.rpc('calculate_diagnostic_stage_progress', {
    stage_id_param: stageId
  });

  // update UI with progress
};
```

---

## 7. БИЗНЕС-ЛОГИКА МОДУЛЕЙ

### 7.1 Модуль "Диагностика" (Diagnostics)

#### 7.1.1 Основные сущности
- **Parent Stages** - родительские периоды (H1_2025, H2_2025)
- **Diagnostic Stages** - диагностические этапы (подэтапы родительского периода)
- **Diagnostic Stage Participants** - участники этапа
- **Survey Assignments** - назначения на оценку
- **Tasks** - задачи для участников

#### 7.1.2 Жизненный цикл диагностического этапа

**Шаг 1: Создание родительского периода (Parent Stage)**
- **Кто:** HR BP или Admin
- **Где:** `/admin/stages`
- **Поля:**
  - period (H1_2025, H2_2025)
  - start_date, end_date, deadline_date
  - is_active (только один активный период)
- **Результат:** Создана запись в parent_stages

**Шаг 2: Создание диагностического этапа**
- **Кто:** HR BP или Admin
- **Где:** `/admin/diagnostics`
- **Поля:**
  - parent_id (ссылка на родительский период)
  - evaluation_period (копируется из parent_stages.period)
- **Статус:** 'setup'
- **Результат:** Создана запись в diagnostic_stages

**Шаг 3: Добавление участников**
- **Кто:** HR BP или Admin
- **Где:** `/admin/diagnostics` → вкладка "Участники"
- **Действие:** Выбор пользователей для добавления в diagnostic_stage_participants
- **Автоматика (триггер assign_surveys_to_diagnostic_participant):**
  1. Создаются 2 записи в survey_360_assignments:
     - Самооценка: evaluated_user_id = evaluating_user_id = user_id, assignment_type = 'self', status = 'approved'
     - Оценка руководителем: evaluating_user_id = manager_id, assignment_type = 'manager', status = 'approved'
  2. approved_by = manager_id для обеих записей
- **Автоматика (триггер create_diagnostic_task_for_participant):**
  1. Создается задача для участника: task_type = 'diagnostic_stage', title = "Пройти самооценку"
  2. Если есть руководитель, создается задача для руководителя: task_type = 'survey_360_evaluation', title = "Оценка подчинённого: [ФИО]"
- **Статус этапа:** остается 'setup' (прогресс 0%)

**Шаг 4: Прохождение самооценки (Employee)**
- **Кто:** Участник этапа
- **Где:** `/` (главная) → виджет SurveyAccessWidget → кнопка "Пройти самооценку"
- **Условие отображения кнопки:**
  - Есть активный diagnostic_stage
  - Пользователь является участником (diagnostic_stage_participants)
  - НЕТ завершенных результатов (is_draft = false) в hard_skill_results ИЛИ soft_skill_results для этого этапа
- **Переход:** `/assessment/:assignmentId` (UnifiedAssessmentPage)
- **Действие:**
  1. Обновление задачи на 'in_progress'
  2. Прохождение объединенного опроса (360° + навыки)
  3. Выбор 3-5 коллег для оценки 360°
- **Сохранение:**
  - Черновик: is_draft = true (можно редактировать)
  - Отправка: is_draft = false
- **Автоматика при is_draft = false:**
  - Триггер `set_evaluation_period` → устанавливает evaluation_period
  - Триггер `update_user_skills_from_survey` → обновляет user_skills
  - Триггер `update_user_qualities_from_survey` → обновляет user_qualities
  - Триггер `aggregate_hard_skill_results` → агрегирует в user_assessment_results
  - Триггер `aggregate_soft_skill_results` → агрегирует в user_assessment_results
  - Триггер `update_assignment_on_survey_completion` → обновляет assignment.status = 'completed'
  - Триггер `update_task_status_on_assignment_change` → обновляет task.status = 'completed'
  - Триггер `complete_diagnostic_task_on_surveys_completion` → если есть ОБА типа результатов, закрывает задачу типа 'assessment'
- **Статус этапа:** 'assessment', прогресс увеличивается

**Шаг 5: Утверждение коллег руководителем**
- **Кто:** Руководитель участника
- **Где:** `/team` → вкладка "Утверждение респондентов 360°"
- **Компонент:** ManagerRespondentApproval
- **Действие:**
  - Просмотр списка выбранных коллег (status = 'pending')
  - Утверждение (status = 'approved') или отклонение (status = 'rejected', с указанием причины)
- **Автоматика при утверждении (триггер create_task_on_assignment_approval):**
  - Создается задача для утвержденного коллеги: task_type = 'survey_360_evaluation', title = "Оценка 360: [ФИО оцениваемого]"

**Шаг 6: Оценка коллегами**
- **Кто:** Утвержденные коллеги
- **Где:** `/my-assignments` → список назначений
- **Переход:** `/survey-360/questions/:assignmentId`
- **Действие:** Прохождение оценки 360° (только soft skills)
- **Автоматика:** аналогична самооценке

**Шаг 7: Оценка руководителем**
- **Кто:** Руководитель участника
- **Где:** `/my-assignments` или `/team`
- **Переход:** `/assessment/:assignmentId`
- **Действие:** Полная оценка подчиненного (360° + навыки)
- **Автоматика:** аналогична самооценке

**Шаг 8: Завершение этапа**
- **Условие:** Все участники завершили оценку (прогресс 100%)
- **Автоматика (триггер update_diagnostic_stage_on_participant_add):**
  - diagnostic_stages.status = 'completed'
  - diagnostic_stages.progress_percent = 100
- **Результат:** Доступны результаты для просмотра

#### 7.1.3 Расчет прогресса

**Функция:** `calculate_diagnostic_stage_progress(stage_id)`

**Формула:**
```
total_participants = COUNT(diagnostic_stage_participants)
total_required = total_participants * 2  // навыки + 360

completed_skill_surveys = COUNT(DISTINCT evaluated_user_id FROM hard_skill_results WHERE is_draft=false)
completed_360_surveys = COUNT(DISTINCT evaluated_user_id FROM soft_skill_results WHERE is_draft=false)

completed_total = completed_skill_surveys + completed_360_surveys
progress = (completed_total / total_required) * 100
```

**Пример:**
- 10 участников
- total_required = 20
- 8 завершили навыки, 6 завершили 360
- completed_total = 14
- progress = 70%

#### 7.1.4 Отображение в интерфейсе

**Для сотрудника (Employee):**
- **Главная (`/`)**: Виджет SurveyAccessWidget
  - Если есть активный этап и участник:
    - Кнопка "Пройти самооценку" (если нет результатов)
    - Или "Самооценка уже пройдена" (если есть)
  - Список задач (TaskList)
- **Мои назначения (`/my-assignments`)**: Список всех назначений (самооценка, оценка коллег)
- **Результаты (`/assessment/results/:userId`)**: Просмотр своих результатов (роза компетенций)

**Для руководителя (Manager):**
- **Команда (`/team`)**: 
  - Список подчиненных с прогрессом оценки
  - Вкладка "Утверждение респондентов 360°"
  - Кнопки для оценки подчиненных
- **Мои назначения (`/my-assignments`)**: Список оценок подчиненных
- **Отчеты по команде (`/manager-reports`)**: Сводные результаты команды
- **Сравнение сотрудников (`/manager/comparison`)**: Сравнительная таблица

**Для HR BP:**
- **Мониторинг диагностики (`/hr/diagnostic-monitoring`)**: 
  - Общий прогресс по всем этапам
  - Детальная статистика по участникам
  - Проблемы и узкие места
- **HR-аналитика (`/hr-analytics`)**: 
  - Аналитика по компетенциям
  - Динамика развития
  - Зоны роста

**Для Admin:**
- **Управление этапами (`/admin/diagnostics`)**: 
  - Создание/редактирование этапов
  - Управление участниками
  - Проверка целостности данных
- **Управление вопросами**: Редактирование вопросов опросов

### 7.2 Модуль "Оценка 360°" (Survey 360)

#### 7.2.1 Типы оценок

| Тип | assignment_type | Описание | Создание |
|-----|----------------|----------|----------|
| Самооценка | self | Оценка самого себя | Автоматически при добавлении в diagnostic_stage_participants |
| Оценка руководителем | manager | Оценка непосредственным руководителем | Автоматически при добавлении в participants |
| Оценка коллегой | peer | Оценка выбранным коллегой | Создается пользователем при прохождении самооценки |

#### 7.2.2 Workflow оценки коллегами

**1. Выбор коллег (при прохождении самооценки)**
- **Компонент:** ColleagueSelectionDialog (в UnifiedAssessmentPage)
- **Условия:**
  - Минимум 3, максимум 5 коллег
  - Коллеги из того же department
  - Исключается сам пользователь и его руководитель
- **Действие:** Создание записей в survey_360_assignments
  - evaluated_user_id = текущий пользователь
  - evaluating_user_id = выбранный коллега
  - assignment_type = 'peer'
  - status = 'pending'
  - diagnostic_stage_id = текущий этап

**2. Утверждение руководителем**
- **Компонент:** ManagerRespondentApproval (на TeamPage)
- **Действие:** 
  - Просмотр списка выбранных коллег
  - Кнопки "Утвердить" / "Отклонить"
  - При утверждении:
    - status = 'approved'
    - approved_at = now()
    - approved_by = manager_id
    - Триггер создает задачу для коллеги
  - При отклонении:
    - status = 'rejected'
    - rejected_at = now()
    - rejection_reason = причина

**3. Прохождение оценки коллегой**
- **Где:** `/survey-360/questions/:assignmentId`
- **Условие:** status = 'approved'
- **Компонент:** Survey360QuestionsPage
- **Действие:** Ответы на вопросы 360° (только soft skills)
- **Анонимность:** 
  - Сами оценки (numeric_value) НЕ анонимны
  - Комментарии могут быть анонимными (is_anonymous_comment = true)
  - При просмотре результатов оцениваемый видит:
    - Среднюю оценку коллег (peers_average)
    - Не анонимные комментарии
    - НЕ видит, кто именно поставил какую оценку

**4. Просмотр результатов**
- **Компонент:** Survey360ResultsPage
- **Данные:**
  - Самооценка (self_assessment)
  - Оценка руководителя (manager_assessment)
  - Средняя оценка коллег (peers_average)
  - Количество ответивших коллег (total_responses)
  - Не анонимные комментарии коллег

#### 7.2.3 Статусы назначений

| Статус | Описание | Действия |
|--------|----------|----------|
| pending | Ожидает утверждения руководителем | Руководитель может утвердить/отклонить |
| approved | Утверждено руководителем | Коллега может пройти оценку |
| rejected | Отклонено руководителем | Не активно, показывается причина |
| completed | Оценка пройдена (is_draft = false) | Только просмотр |

### 7.3 Модуль "Встречи 1:1" (Meetings)

#### 7.3.1 Структура этапов

**Parent Stage (общий период встреч):**
- period: "H1_2025", "H2_2025"
- start_date, end_date, deadline_date
- is_active: только один активный период

**Meeting Stage (этап встреч):**
- parent_id → parent_stages
- Связь с участниками через meeting_stage_participants

**Meeting Stage Participants:**
- stage_id → meeting_stages
- user_id → users (сотрудник)
- **Важно:** Только участники могут создавать встречи в рамках этапа

#### 7.3.2 Жизненный цикл встречи

**Шаг 1: Создание этапа встреч**
- **Кто:** HR BP или Admin
- **Где:** `/admin/stages`
- **Действие:** 
  - Выбор родительского периода (parent_id)
  - Создание записи в meeting_stages
  - Добавление участников в meeting_stage_participants

**Шаг 2: Создание встречи сотрудником**
- **Кто:** Участник этапа (employee)
- **Где:** `/meetings`
- **Условие:** 
  - Есть активный этап (parent_stages.is_active = true)
  - Пользователь является участником (meeting_stage_participants)
- **Компонент:** MeetingForm (в диалоге)
- **Действие:**
  - Заполнение полей:
    - meeting_date (дата встречи)
    - goal_and_agenda (цель и повестка)
    - energy_gained (что дает энергию)
    - energy_lost (что отнимает энергию)
    - previous_decisions_debrief (дебриф прошлых решений)
    - stoppers (стопперы)
  - Добавление минимум 1 решения (meeting_decisions):
    - decision_text (текст решения)
- **Статус:** 'draft'
- **Сохранение:** Можно сохранить черновик и вернуться позже

**Шаг 3: Отправка на утверждение**
- **Кто:** Employee (автор встречи)
- **Условие:** Все поля заполнены, минимум 1 решение
- **Действие:** 
  - status = 'submitted'
  - submitted_at = now()
- **Результат:** Руководитель получает уведомление (задача или уведомление)

**Шаг 4: Рассмотрение руководителем**
- **Кто:** Manager (manager_id встречи)
- **Где:** `/meetings` → вкладка "Встречи подчиненных"
- **Компонент:** MeetingForm (режим просмотра/редактирования)
- **Действия руководителя:**
  - Просмотр всех полей, заполненных сотрудником
  - Добавление комментария (manager_comment)
  - Редактирование/дополнение решений (meeting_decisions)
  - **Варианты:**
    - **Утвердить:**
      - status = 'approved'
      - approved_at = now()
      - Автоматически закрывается связанная задача
    - **Вернуть на доработку:**
      - status = 'returned'
      - returned_at = now()
      - return_reason = причина возврата
      - Сотрудник получает уведомление

**Шаг 5: Доработка (если returned)**
- **Кто:** Employee
- **Действие:**
  - Просмотр комментария руководителя (manager_comment, return_reason)
  - Внесение правок
  - Повторная отправка:
    - status = 'submitted'
    - submitted_at = now()
    - Цикл возвращается к Шагу 4

**Шаг 6: После утверждения**
- **Статус:** 'approved'
- **Возможности:**
  - Просмотр истории встреч
  - Просмотр прошлых решений для дебрифа в следующей встрече
  - Создание новой встречи в рамках этапа
  - Отслеживание выполнения решений (is_completed)

#### 7.3.3 Статусы встреч

| Статус | Описание | Кто может редактировать |
|--------|----------|-------------------------|
| draft | Черновик | Employee (автор) |
| submitted | Отправлено на утверждение | Никто (только чтение) |
| returned | Возвращено на доработку | Employee (автор) |
| approved | Утверждено | Никто (только чтение, редактирование решений) |

#### 7.3.4 Решения (Meeting Decisions)

**Структура:**
- decision_text: текст решения
- is_completed: флаг выполнения
- created_by: автор решения

**Возможности:**
- Добавление решений: сотрудник при создании, руководитель при рассмотрении
- Редактирование: оба участника встречи
- Отметка о выполнении: is_completed = true
- Просмотр прошлых решений: в поле previous_decisions_debrief при создании новой встречи

#### 7.3.5 Отображение в интерфейсе

**Для сотрудника:**
- **Встречи (`/meetings`)**:
  - Вкладка "Мои встречи"
  - Кнопка "Создать встречу" (если активный этап и участник)
  - Список встреч с фильтрацией по статусу
  - Индикаторы статусов:
    - draft: серый, "Черновик"
    - submitted: синий, "На утверждении"
    - returned: оранжевый, "Возвращено", показывает return_reason
    - approved: зеленый, "Утверждено"

**Для руководителя:**
- **Встречи (`/meetings`)**:
  - Вкладка "Мои встречи" (свои встречи как сотрудник)
  - Вкладка "Встречи подчиненных"
    - Список встреч подчиненных
    - Фильтр по статусу (submitted, approved, returned)
    - Кнопки "Утвердить" / "Вернуть" для submitted
    - Просмотр деталей

**Для HR BP / Admin:**
- **Управление этапами (`/admin/stages`)**:
  - Создание parent_stages и meeting_stages
  - Добавление/удаление участников
  - Статистика по этапам
- **Мониторинг:**
  - Просмотр всех встреч
  - Статистика прохождения

### 7.4 Модуль "Задачи" (Tasks)

#### 7.4.1 Типы задач

| task_type | Описание | Создание | Условие завершения |
|-----------|----------|----------|-------------------|
| diagnostic_stage | Пройти диагностику (самооценка) | Автоматически при добавлении в diagnostic_stage_participants | Оба опроса (навыки + 360) пройдены (is_draft = false) |
| survey_360_evaluation | Оценка 360° (коллега, руководитель) | Автоматически при утверждении назначения | Опрос пройден (is_draft = false) |
| skill_survey | Оценка навыков | Автоматически | Опрос пройден |
| meeting | Встреча 1:1 | Автоматически при добавлении в meeting_stage_participants | Встреча утверждена (one_on_one_meetings.status = 'approved') |
| assessment | Комплексная оценка | Автоматически | Оба опроса пройдены |
| development | Задача развития | Вручную или по рекомендациям | Вручную пользователем |

#### 7.4.2 Статусы задач

| Статус | Описание | Переходы |
|--------|----------|----------|
| pending | Ожидает выполнения | → in_progress, completed, cancelled |
| in_progress | В процессе | → completed, cancelled |
| completed | Завершено | - |
| cancelled | Отменено | - |

#### 7.4.3 Автоматическое управление задачами

**Создание задач:**
- **Диагностика:** При добавлении участника (триггер `create_diagnostic_task_for_participant`)
- **Оценка коллегами:** При утверждении назначения (триггер `create_task_on_assignment_approval`)
- **Встречи:** При добавлении участника в meeting_stage_participants

**Обновление статуса:**
- **При начале прохождения:** Вручную или автоматически status = 'in_progress'
- **При завершении опроса:** Триггер `update_task_status_on_assignment_change` → status = 'completed'
- **При завершении обоих опросов:** Триггер `complete_diagnostic_task_on_surveys_completion` → задача типа 'assessment' → 'completed'

**Удаление задач:**
- **При удалении участника:** Триггер `delete_diagnostic_tasks_on_participant_remove`

#### 7.4.4 Отображение задач

**Компонент:** TaskList (на главной странице)

**Фильтрация:**
- По статусу (pending, in_progress, completed)
- По типу (diagnostic_stage, meeting, development)
- По дедлайну

**Действия:**
- Клик на задачу → переход к соответствующей странице:
  - diagnostic_stage → `/assessment/:assignmentId`
  - survey_360_evaluation → `/survey-360/questions/:assignmentId`
  - meeting → `/meetings`
- Отметка "Выполнено" (для задач развития)

**Индикаторы:**
- Приоритет (priority): high, medium, low
- Дедлайн: красный цвет если просрочено
- Категория (category): "Диагностика", "Оценка 360", "Встречи", "Развитие"

### 7.5 Модуль "Развитие" (Development)

#### 7.5.1 Карьерные треки (Career Tracks)

**Структура:**
- **career_tracks**: Трек (например, "Путь к Senior Developer")
  - name: название
  - description: описание
  - target_position_id: целевая должность
  - track_type_id: тип трека
  - duration_months: продолжительность
- **career_track_steps**: Шаги трека
  - career_track_id: FK → career_tracks
  - grade_id: грейд на этом шаге
  - step_order: порядковый номер
  - duration_months: длительность шага
  - description: описание шага
- **user_career_progress**: Прогресс пользователя
  - user_id: FK → users
  - career_track_id: выбранный трек
  - current_step_id: текущий шаг
  - status: active, completed, paused
  - selected_at: дата выбора

**Функции:**
1. **recommend_career_tracks(p_user_id, p_limit):**
   - Возвращает рекомендованные треки на основе:
     - Текущей позиции пользователя
     - Gap-анализа по каждому шагу трека
   - Сортировка по compatibility_score и total_gap

2. **calculate_career_gap(p_user_id, p_grade_id):**
   - Для каждой компетенции (навык/качество) целевого грейда:
     - current_level: из user_assessment_results.self_assessment
     - target_level: из grade_skills/grade_qualities
     - gap: target - current
     - is_ready: current >= target

**Отображение:**
- **DevelopmentPage:** Виджет CareerTracksWidget
  - Рекомендованные треки
  - Текущий трек (если выбран)
  - Прогресс по шагам
- **UserCareerTrackView:** Детальный просмотр трека
  - Шаги трека
  - Gap-анализ для каждого шага
  - Рекомендации по развитию

#### 7.5.2 Планы развития (Development Plans)

**Структура:**
- **development_plans:**
  - user_id: для кого план
  - title: название
  - description: описание
  - start_date, end_date: период
  - status: active, completed, cancelled
  - created_by: кто создал (сам пользователь или HR/manager)

**Создание:**
- **Вручную:** DevelopmentPlanCreator (на DevelopmentPage)
- **На основе gap-анализа:** Автоматические рекомендации

**Управление:**
- **Пользователь:** Создание, просмотр, обновление своих планов
- **Руководитель:** Просмотр, создание, обновление планов подчиненных
- **HR BP:** Просмотр, создание, обновление всех планов

#### 7.5.3 Задачи развития (Development Tasks)

**Шаблоны (development_tasks):**
- task_name: название задачи
- task_goal: цель
- how_to: как выполнить
- measurable_result: измеримый результат
- skill_id / quality_id: привязка к компетенции
- competency_level_id: уровень компетенции
- task_order: порядок выполнения

**Создание задач:**
1. **Автоматические рекомендации:**
   - Функция `get_recommended_development_tasks(p_user_id, p_grade_id, p_limit)`
   - Возвращает задачи для компетенций с gap > 0
   - До 2 задач на компетенцию
2. **Вручную:**
   - DevelopmentTasksManager
   - Привязка к development_plan

**Выполнение:**
- Создание записи в tasks с task_type = 'development'
- Отслеживание прогресса
- Отметка о выполнении

**Отображение:**
- **DevelopmentPage:**
  - Виджет GapAnalysisWidget: показывает текущий gap
  - Рекомендованные задачи на основе gap-анализа
  - Список активных планов развития
- **TasksManager:** Управление задачами развития

### 7.6 Модуль "Команда" (Team)

#### 7.6.1 Структура команды

**Иерархия:**
- **Руководитель (Manager):**
  - users.manager_id → указывает на руководителя
  - Один руководитель может иметь много подчиненных
  - Получается через JOIN: `users u1 JOIN users u2 ON u1.manager_id = u2.id`

**Отображение:**
- **TeamPage:** Список подчиненных
  - Компонент TeamMembersTable
  - Фильтрация по департаменту, должности, грейду
  - Поиск по имени

#### 7.6.2 Функционал для руководителя

**Просмотр команды:**
- **Список подчиненных:**
  - ФИО, должность, грейд, email, статус
  - Прогресс диагностики (если активный этап)
  - Ссылки на профили
- **Утверждение респондентов 360°:**
  - ManagerRespondentApproval
  - Список выбранных коллег для каждого подчиненного
  - Утверждение/отклонение
- **Оценка подчиненных:**
  - Список назначений на оценку (survey_360_assignments с assignment_type = 'manager')
  - Переход к оценке `/assessment/:assignmentId`

**Отчеты:**
- **Сводные результаты команды (`/manager-reports`):**
  - Компонент ManagerReportsPage
  - Сводка по компетенциям команды
  - Зоны роста команды
  - Топ навыков и зоны развития
- **Сравнение сотрудников (`/manager/comparison`):**
  - ManagerComparisonPage
  - Таблица сравнения компетенций
  - Выбор сотрудников для сравнения
  - Экспорт в Excel

**Встречи 1:1:**
- **Просмотр встреч подчиненных:**
  - Список встреч со статусами
  - Утверждение/возврат встреч
  - Добавление комментариев

#### 7.6.3 Права доступа

**RLS политики для users:**
```sql
-- Руководитель видит своих подчиненных
CREATE POLICY "users_select_team"
ON users FOR SELECT
USING (
  manager_id = auth.uid()
  OR id = auth.uid()
  OR has_permission(auth.uid(), 'users.view_all')
);
```

**Проверка в коде:**
```typescript
const isManager = useMemo(() => {
  return teamMembers.some(m => m.manager_id === user?.id);
}, [teamMembers, user]);
```

### 7.7 Модуль "Аналитика" (Analytics)

#### 7.7.1 HR-аналитика

**Компонент:** HRAnalyticsPage

**Доступ:** HR BP, Admin (право `analytics.view_all`)

**Разделы:**
1. **Дашборд прогресса:**
   - ProgressDashboard
   - Общий прогресс по компетенциям
   - Тренды развития
   - Сравнение по периодам

2. **Анализ компетенций:**
   - CompetencyChart
   - Распределение уровней компетенций
   - Топ навыков и качеств
   - Зоны роста организации

3. **Динамика развития:**
   - DynamicsChart
   - Изменение компетенций по периодам
   - Кто прогрессирует, кто регрессирует
   - Эффективность обучения

4. **Зоны роста:**
   - GrowthAreasChart
   - Компетенции с наибольшим gap
   - Рекомендации по обучению
   - Приоритеты развития

**Источники данных:**
- user_assessment_results (агрегированные результаты)
- Группировка по skill_id, quality_id
- Фильтрация по department, position, grade
- Сравнение self_assessment, manager_assessment, peers_average

#### 7.7.2 Мониторинг диагностики

**Компонент:** DiagnosticMonitoringPage

**Доступ:** HR BP, Admin (право `diagnostics.view`)

**Функционал:**
1. **Общий прогресс:**
   - Список всех этапов диагностики
   - Процент завершения каждого этапа
   - Количество участников
   - Статус (setup, assessment, completed)

2. **Детализация по этапу:**
   - Список участников
   - Статус каждого участника:
     - ✅ Самооценка пройдена
     - ✅ Оценка руководителя пройдена
     - Количество утвержденных коллег
     - Количество пройденных оценок коллег
   - Проблемы (не завершенные оценки, просроченные дедлайны)

3. **Проверка целостности:**
   - Кнопка "Проверить данные"
   - Вызов `check_diagnostic_data_consistency()`
   - Отображение найденных проблем:
     - Назначения без задач
     - Задачи без назначений
     - Несоответствия статусов
     - Дублирующиеся назначения

4. **Статистика:**
   - Общее количество участников
   - Завершенных оценок
   - Средний прогресс
   - Просроченные дедлайны

**Источники данных:**
- diagnostic_stages (с расчетом прогресса через `calculate_diagnostic_stage_progress`)
- diagnostic_stage_participants
- survey_360_assignments
- tasks (для отслеживания выполнения)

#### 7.7.3 Результаты пользователя

**Компонент:** AssessmentResultsPage

**URL:** `/assessment/results/:userId`

**Доступ:**
- Владелец: всегда
- Руководитель: для подчиненных
- HR BP / Admin: для всех

**Отображение:**
1. **Роза компетенций (RadarChartResults):**
   - Радиальная диаграмма
   - Оси: навыки и качества
   - Линии:
     - Самооценка (синяя)
     - Оценка руководителя (зеленая)
     - Средняя оценка коллег (оранжевая)
     - Целевой уровень (пунктирная)

2. **Детальные результаты:**
   - **По навыкам (SubSkillsDetailedReport):**
     - Список навыков
     - Оценки: self, manager, peers
     - Gap (разница с целевым уровнем)
     - Рекомендации
   - **По качествам (CommentsGroupedReport):**
     - Список качеств
     - Оценки
     - Комментарии (не анонимные)

3. **Сводка (ProfileAggregatedResults):**
   - Средние значения
   - Сильные стороны (top 5)
   - Зоны развития (bottom 5)
   - Рекомендации по развитию

**Источники данных:**
- user_assessment_results (для текущего diagnostic_stage_id)
- soft_skill_results (для комментариев)
- hard_skill_results (для комментариев)
- grade_skills, grade_qualities (для целевых уровней)

---

## 8. UI/UX И МАРШРУТЫ

### 8.1 Маршруты приложения

**Определение:** `src/App.tsx`

#### 8.1.1 Публичные маршруты

| URL | Компонент | Описание |
|-----|-----------|----------|
| `/auth` | AuthPage | Страница авторизации (email/password) |

#### 8.1.2 Защищенные маршруты (требуют авторизации)

**Основные страницы:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/` | Index | Все | Главная панель (дашборд) |
| `/profile` | ProfilePage | Все | Профиль пользователя |
| `/development` | DevelopmentPage | Все | Развитие (треки, планы, задачи) |
| `/training` | TrainingPage | Все | Обучение и сертификации |
| `/meetings` | MeetingsPage | Все | Встречи 1:1 |
| `/team` | TeamPage | Manager, HR, Admin | Команда и подчинённые |
| `/feed` | FeedPage | Все | Лента активности |

**Опросы и оценка:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/assessment/:assignmentId` | UnifiedAssessmentPage | Все | Объединённый опрос (360 + навыки) |
| `/skill-survey/questions/:assignmentId` | SkillSurveyQuestionsPage | Все | Опрос по навыкам |
| `/skill-survey/results` | SkillSurveyResultsPage | Все | Результаты опроса по навыкам |
| `/survey-360/questions/:assignmentId` | Survey360QuestionsPage | Все | Опрос 360° |
| `/survey-360-results` | Survey360ResultsPage | Все | Результаты 360° |
| `/assessment/results/:userId` | AssessmentResultsPage | Все* | Результаты оценки (роза компетенций) |
| `/assessment-completed` | AssessmentCompletedPage | Все | Страница завершения оценки |

*Доступ к результатам: владелец, руководитель, HR/Admin

**Задачи и назначения:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/my-assignments` | MyAssignmentsPage | Все | Мои назначенные оценки |

**Отчёты и аналитика:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/reports` | ReportsPage | Manager, HR, Admin | Общие отчёты |
| `/manager-reports` | ManagerReportsPage | Manager, HR, Admin | Отчёты по команде |
| `/manager/comparison` | ManagerComparisonPage | Manager, HR, Admin | Сравнение сотрудников |
| `/hr-analytics` | HRAnalyticsPage | HR BP, Admin | HR-аналитика |
| `/hr/diagnostic-monitoring` | DiagnosticMonitoringPage | HR BP, Admin | Мониторинг диагностики |

**Управление пользователями:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/users` | UsersListPage | Admin | Список пользователей |
| `/users/create` | CreateUserPage | Admin, HR | Создание пользователя |
| `/users/migration` | UsersMigrationPage | Admin | Миграция пользователей |
| `/security` | SecurityManagementPage | Admin | Управление ролями и правами |

**Админ-панель:**

| URL | Компонент | Роли | Описание |
|-----|-----------|------|----------|
| `/admin` | AdminDashboard | Admin | Главная админ-панели |
| `/admin/stages` | StagesPage | Admin, HR | Управление этапами встреч |
| `/admin/diagnostics` | DiagnosticsAdminPage | Admin, HR | Управление диагностикой |
| `/admin/:tableId` | ReferenceTablePage | Admin, HR | Справочники (грейды, навыки, качества и т.д.) |

**Справочники (tableId):**
- grades
- skills
- qualities
- category_skills
- departments
- positions
- position_categories
- career_tracks
- competency_levels
- hard_skill_questions
- soft_skill_questions
- hard_skill_answer_options
- soft_skill_answer_options

### 8.2 Компоненты и их назначение

#### 8.2.1 Layout компоненты

**AppSidebar:**
- Боковое меню навигации
- Адаптивное (сворачивается на мобильных)
- Динамическое отображение пунктов меню на основе ролей и прав
- Использует `usePermission` для проверки доступа

**NavigationMenu:**
- Горизонтальное меню (опционально)
- Дублирует функции AppSidebar

**AuthGuard:**
- Защита маршрутов
- Проверка авторизации через AuthContext
- Редирект на `/auth` если не авторизован

**Breadcrumbs:**
- Хлебные крошки навигации
- Автоматическое формирование на основе текущего URL

#### 8.2.2 Виджеты главной страницы (Index)

**DashboardStats:**
- Сводная статистика:
  - Количество активных задач
  - Прогресс диагностики
  - Предстоящие встречи
  - Завершённые оценки

**TaskList:**
- Список задач пользователя
- Фильтрация по статусу, типу, дедлайну
- Сортировка по приоритету
- Быстрые действия (отметить выполненным, открыть)

**SurveyAccessWidget:**
- Виджет доступа к опросам
- Проверяет наличие активного diagnostic_stage
- Проверяет, является ли пользователь участником
- Проверяет наличие завершённых результатов (hard_skill_results ИЛИ soft_skill_results с is_draft = false)
- Отображает:
  - Кнопку "Пройти самооценку" (если нет результатов)
  - Или "Самооценка уже пройдена" (если есть результаты)

**CareerTracksWidget:**
- Рекомендованные карьерные треки
- Вызов `recommend_career_tracks(user.id, 3)`
- Отображение совместимости и gap
- Кнопка "Выбрать трек"

**CompetencyProfileWidget:**
- Мини-роза компетенций
- Последние результаты оценки
- Ссылка на полные результаты

**RecentActivity:**
- Лента недавней активности:
  - Завершённые оценки
  - Утверждённые встречи
  - Новые задачи
  - Изменения в команде

#### 8.2.3 Компоненты диагностики

**UnifiedStagesManager:**
- Управление этапами диагностики (Admin/HR)
- Создание parent_stages и diagnostic_stages
- Просмотр списка этапов
- Активация/деактивация

**DiagnosticStepper:**
- Пошаговый визард прохождения диагностики
- Шаги:
  1. Самооценка навыков
  2. Самооценка 360°
  3. Выбор коллег
  4. Подтверждение
- Индикатор прогресса

**UnifiedAssessmentPage:**
- Объединённая страница оценки (навыки + 360)
- Табы для переключения между опросами
- Автосохранение черновика
- Валидация перед отправкой
- Диалог выбора коллег (ColleagueSelectionDialog)

**AssessmentValidation:**
- Проверка корректности заполнения оценки
- Валидация:
  - Все вопросы отвечены
  - Выбрано 3-5 коллег
  - Комментарии не пустые (если обязательны)

#### 8.2.4 Компоненты оценки 360°

**ColleagueSelectionDialog:**
- Диалог выбора коллег для оценки 360°
- Показывает список коллег из того же department
- Исключает самого пользователя и руководителя
- Минимум 3, максимум 5 коллег
- Поиск и фильтрация

**ManagerRespondentApproval:**
- Компонент утверждения респондентов для руководителя
- Список выбранных коллег для каждого подчинённого
- Кнопки "Утвердить" / "Отклонить"
- Поле для причины отклонения
- Статусы: pending, approved, rejected

**RespondentApprovalDialog:**
- Диалог просмотра деталей назначения
- Информация об оцениваемом и оценивающем
- История утверждений/отклонений

**RespondentStatusTable:**
- Таблица статусов респондентов
- Колонки: ФИО, статус, дата утверждения, причина отклонения
- Фильтрация по статусу

**Survey360QuestionsPage:**
- Страница прохождения оценки 360° (только soft skills)
- Список вопросов с вариантами ответов
- Поле для комментариев
- Чекбокс "Анонимный комментарий"
- Автосохранение черновика

**Survey360ResultsPage:**
- Страница результатов 360°
- Роза компетенций (RadarChartResults)
- Детальные результаты по качествам
- Комментарии (не анонимные)

#### 8.2.5 Компоненты навыков

**SkillSurveyQuestionsPage:**
- Страница оценки навыков (hard skills)
- Список вопросов по навыкам
- Варианты ответов (0-5)
- Поле для комментариев

**SkillSurveyResultsPage:**
- Результаты оценки навыков
- Детальная таблица по навыкам
- Сравнение self, manager, peers
- Комментарии

**SkillsGradeWidget:**
- Виджет навыков для грейда
- Список требуемых навыков для выбранного грейда
- Целевые уровни
- Текущие уровни пользователя
- Gap-анализ

**ExpandableSkillCard:**
- Раскрывающаяся карточка навыка
- Название, описание
- Текущий и целевой уровень
- Прогресс-бар

#### 8.2.6 Компоненты качеств

**QualitiesGradeWidget:**
- Виджет качеств для грейда
- Список требуемых качеств
- Целевые уровни
- Текущие уровни
- Gap-анализ

**ExpandableQualityCard:**
- Раскрывающаяся карточка качества
- Аналогично ExpandableSkillCard

#### 8.2.7 Компоненты встреч

**MeetingForm:**
- Форма создания/редактирования встречи 1:1
- Режимы: создание, редактирование, просмотр
- Поля:
  - meeting_date (выбор даты)
  - goal_and_agenda (текстовое поле)
  - energy_gained (текстовое поле)
  - energy_lost (текстовое поле)
  - previous_decisions_debrief (текстовое поле)
  - stoppers (текстовое поле)
  - manager_comment (только для руководителя)
- Список решений (meeting_decisions):
  - Добавление нового решения
  - Редактирование существующего
  - Отметка о выполнении
- Кнопки:
  - "Сохранить черновик" (status = 'draft')
  - "Отправить на утверждение" (status = 'submitted')
  - "Утвердить" (для руководителя, status = 'approved')
  - "Вернуть на доработку" (для руководителя, status = 'returned', требует return_reason)

**MeetingsPage:**
- Страница встреч 1:1
- Табы:
  - "Мои встречи" (для сотрудника)
  - "Встречи подчинённых" (для руководителя)
- Фильтрация по статусу
- Кнопка "Создать встречу" (если активный этап и участник)
- Список встреч с индикаторами статусов
- Клик на встречу → открытие диалога с MeetingForm

**Логика отображения кнопки "Создать встречу":**
1. Проверяет наличие активного meeting_stage (через parent_stages.is_active = true)
2. Проверяет, является ли пользователь участником (meeting_stage_participants)
3. Если оба условия выполнены, показывает кнопку
4. При клике открывает диалог с MeetingForm

#### 8.2.8 Компоненты команды

**TeamMembersTable:**
- Таблица подчинённых
- Колонки:
  - ФИО
  - Должность
  - Грейд
  - Email
  - Статус
  - Прогресс диагностики (если активный этап)
- Действия:
  - Просмотр профиля
  - Оценить (если есть назначение)
  - Просмотр результатов

**ManagerComparisonTable:**
- Таблица сравнения сотрудников
- Выбор сотрудников для сравнения (мультиселект)
- Колонки:
  - Компетенция (навык/качество)
  - Оценки каждого выбранного сотрудника
  - Средняя по выбранным
  - Средняя по команде
- Фильтрация по типу компетенции (навыки/качества)
- Экспорт в Excel

#### 8.2.9 Компоненты развития

**DevelopmentPlanCreator:**
- Форма создания плана развития
- Поля:
  - title
  - description
  - start_date, end_date
- Добавление задач к плану

**DevelopmentTasksManager:**
- Управление задачами развития
- Список задач плана
- Добавление новой задачи
- Отметка о выполнении

**CareerTrackDetails:**
- Детальный просмотр карьерного трека
- Шаги трека
- Для каждого шага:
  - Грейд
  - Длительность
  - Требуемые компетенции
  - Gap-анализ

**UserCareerTrackView:**
- Просмотр выбранного трека пользователя
- Текущий шаг
- Прогресс
- Рекомендации по переходу на следующий шаг

**GapAnalysisWidget:**
- Виджет gap-анализа
- Вызов `calculate_career_gap(user.id, target_grade_id)`
- Список компетенций с gap > 0
- Сортировка по убыванию gap
- Рекомендуемые задачи развития

#### 8.2.10 Компоненты результатов

**RadarChartResults:**
- Радиальная диаграмма компетенций
- Библиотека: recharts
- Оси: навыки и качества
- Линии:
  - self_assessment
  - manager_assessment
  - peers_average
  - target_level (пунктирная)
- Легенда
- Интерактивность (hover)

**ProfileAggregatedResults:**
- Сводка результатов оценки
- Средние значения:
  - Самооценка
  - Оценка руководителя
  - Оценка коллег
- Топ-5 сильных сторон
- Топ-5 зон развития
- Общая оценка прогресса

**SubSkillsDetailedReport:**
- Детальный отчёт по навыкам
- Таблица:
  - Навык
  - Самооценка
  - Оценка руководителя
  - Средняя коллег
  - Целевой уровень
  - Gap
  - Комментарии
- Сортировка по gap
- Фильтрация по категории

**CommentsGroupedReport:**
- Отчёт по комментариям
- Группировка по компетенциям
- Для каждой компетенции:
  - Список комментариев (не анонимных)
  - Источник (самооценка, руководитель, коллега)
  - Дата

**AssessmentDetailsReport:**
- Детальный отчёт оценки
- Объединяет SubSkillsDetailedReport и CommentsGroupedReport
- Фильтры:
  - По типу компетенции (навыки/качества)
  - По источнику оценки (self/manager/peers)
  - По периоду

#### 8.2.11 Админ-компоненты

**UsersTableAdmin:**
- Таблица управления пользователями (Admin)
- Колонки:
  - ФИО, email, статус, роль, должность, грейд
- Действия:
  - Редактировать
  - Назначить роль
  - Деактивировать
  - Просмотр аудита

**RolesPermissionsManager:**
- Управление ролями и правами (SecurityManagementPage)
- Таблица ролей с количеством пользователей
- Для каждой роли:
  - Список назначенных прав (grouped by permission_groups)
  - Добавление/удаление прав
- Предупреждение при изменении прав Admin

**UserAuditSheet:**
- Боковая панель с аудитом действий пользователя
- История изменений (audit_log)
- Фильтрация по типу действия
- Детали каждого изменения (old_value, new_value)

**AuditLogViewer:**
- Просмотр полного журнала аудита
- Фильтры:
  - По пользователю
  - По типу действия
  - По дате
- Экспорт

**RolePermissionsStats:**
- Статистика по ролям и правам
- Количество пользователей на каждую роль
- Количество прав на каждую роль
- Графики распределения

**UnifiedStagesManager:**
- Управление этапами диагностики и встреч
- Создание parent_stages
- Создание diagnostic_stages / meeting_stages
- Управление участниками
- Проверка целостности

**GradeDetailsDialog:**
- Диалог деталей грейда
- Информация о грейде
- Требуемые навыки (grade_skills)
- Требуемые качества (grade_qualities)
- Карьерные треки, включающие этот грейд

#### 8.2.12 Справочники (Reference Tables)

**ReferenceTableView:**
- Универсальный компонент для отображения справочников
- Таблица с колонками на основе конфигурации
- CRUD операции
- Поиск и фильтрация

**Конфигурация:** `src/components/admin/tableConfig.ts`

**Поддерживаемые справочники:**
- grades (грейды)
- skills (навыки)
- qualities (качества)
- category_skills (категории навыков)
- departments (отделы)
- positions (должности)
- position_categories (категории должностей)
- career_tracks (карьерные треки)
- competency_levels (уровни компетенций)
- hard_skill_questions (вопросы по навыкам)
- soft_skill_questions (вопросы 360°)
- hard_skill_answer_options (варианты ответов навыки)
- soft_skill_answer_options (варианты ответов 360°)

**Специализированные компоненты:**
- **GradesManager:** Управление грейдами с дополнительными полями (зарплаты, сертификации)
- **SkillsManagement:** Управление навыками с привязкой к категориям
- **QualitiesManagement:** Управление качествами
- **SurveyQuestionsManagement:** Управление вопросами опросов с привязкой к компетенциям
- **AnswerOptionsManagement:** Управление вариантами ответов
- **CategorySkillsManagement:** Управление категориями навыков
- **CareerTracksManager:** Управление карьерными треками со связанными шагами

### 8.3 Сценарии использования для разных ролей

#### 8.3.1 Employee (Сотрудник)

**Типичный день:**

1. **Вход:** `/auth` → авторизация → редирект на `/`

2. **Главная (`/`):**
   - Виджет SurveyAccessWidget:
     - Если есть активный этап и пользователь участник:
       - Если НЕТ результатов (hard_skill_results OR soft_skill_results с is_draft=false):
         - Кнопка "Пройти самооценку"
       - Иначе: "Самооценка уже пройдена"
   - TaskList:
     - Задачи на оценку (diagnostic_stage, survey_360_evaluation)
     - Задачи на встречи
     - Задачи развития
   - CareerTracksWidget: рекомендованные треки
   - RecentActivity: недавние действия

3. **Прохождение самооценки:**
   - Клик "Пройти самооценку" → обновление задачи на 'in_progress' → `/assessment/:assignmentId`
   - UnifiedAssessmentPage:
     - Таб "Оценка навыков": ответы на вопросы по hard skills
     - Таб "Оценка 360°": ответы на вопросы по soft skills
     - Сохранение черновика (is_draft = true)
     - Выбор коллег (ColleagueSelectionDialog): 3-5 коллег из department
     - Отправка (is_draft = false)
   - Автоматика:
     - Создание записей в survey_360_assignments для выбранных коллег (status = 'pending')
     - Агрегация результатов в user_assessment_results
     - Обновление assignment.status = 'completed'
     - Обновление task.status = 'completed'

4. **Оценка коллеги:**
   - `/my-assignments` → список назначений
   - Клик на назначение (status = 'approved') → `/survey-360/questions/:assignmentId`
   - Survey360QuestionsPage: ответы на вопросы 360°
   - Сохранение (is_draft = false)
   - Автоматика: обновление assignment и task

5. **Просмотр результатов:**
   - `/assessment/results/:userId` (свой userId)
   - AssessmentResultsPage:
     - RadarChartResults: роза компетенций
     - SubSkillsDetailedReport: детали по навыкам
     - CommentsGroupedReport: комментарии
     - ProfileAggregatedResults: сводка

6. **Встреча 1:1:**
   - `/meetings`
   - Проверка: активный meeting_stage AND участник (meeting_stage_participants)
   - Кнопка "Создать встречу" → диалог MeetingForm
   - Заполнение полей, добавление решений
   - Сохранение черновика (status = 'draft')
   - Отправка на утверждение (status = 'submitted')
   - Ожидание ответа руководителя
   - Если returned: доработка и повторная отправка

7. **Развитие:**
   - `/development`
   - CareerTracksWidget: выбор трека
   - GapAnalysisWidget: просмотр gap
   - Рекомендованные задачи развития
   - Создание плана развития (DevelopmentPlanCreator)
   - Выполнение задач, отметка о выполнении

#### 8.3.2 Manager (Руководитель)

**Типичный день:**

1. **Вход:** `/auth` → `/` (дашборд)

2. **Главная:**
   - Свои задачи (как сотрудник)
   - Задачи на оценку подчинённых (survey_360_evaluation)
   - Задачи на утверждение встреч

3. **Команда (`/team`):**
   - Вкладка "Команда":
     - TeamMembersTable: список подчинённых
     - Прогресс диагностики каждого
     - Кнопки "Оценить" (если есть назначение)
   - Вкладка "Утверждение респондентов 360°":
     - ManagerRespondentApproval
     - Список выбранных коллег для каждого подчинённого
     - Утверждение/отклонение
     - При утверждении: создаётся задача для коллеги

4. **Оценка подчинённого:**
   - `/my-assignments` → назначение (assignment_type = 'manager')
   - `/assessment/:assignmentId`
   - UnifiedAssessmentPage: полная оценка (навыки + 360)
   - Сохранение (is_draft = false)

5. **Встречи подчинённых (`/meetings`):**
   - Вкладка "Встречи подчинённых"
   - Фильтр: submitted
   - Клик на встречу → диалог MeetingForm (режим просмотра/редактирования)
   - Добавление manager_comment
   - Редактирование решений
   - Варианты:
     - "Утвердить" → status = 'approved'
     - "Вернуть" → status = 'returned', return_reason

6. **Отчёты (`/manager-reports`):**
   - ManagerReportsPage
   - Сводка по команде
   - Топ навыков команды
   - Зоны роста

7. **Сравнение сотрудников (`/manager/comparison`):**
   - ManagerComparisonPage
   - Выбор подчинённых для сравнения
   - Таблица компетенций
   - Экспорт в Excel

#### 8.3.3 HR BP (HR Business Partner)

**Типичный день:**

1. **Вход:** `/auth` → `/`

2. **Управление этапами (`/admin/diagnostics`):**
   - UnifiedStagesManager
   - Создание нового parent_stage (период H1_2025, H2_2025)
   - Создание diagnostic_stage
   - Добавление участников:
     - Выбор пользователей
     - Массовое добавление в diagnostic_stage_participants
     - Автоматика: создание назначений и задач
   - Мониторинг прогресса

3. **Мониторинг диагностики (`/hr/diagnostic-monitoring`):**
   - DiagnosticMonitoringPage
   - Общий прогресс по всем этапам
   - Детализация по участникам
   - Проблемы (не завершённые оценки)
   - Проверка целостности данных:
     - Кнопка "Проверить данные"
     - Вызов `check_diagnostic_data_consistency()`
     - Отображение проблем

4. **HR-аналитика (`/hr-analytics`):**
   - HRAnalyticsPage
   - ProgressDashboard: общий прогресс
   - CompetencyChart: распределение компетенций
   - DynamicsChart: динамика развития
   - GrowthAreasChart: зоны роста
   - Фильтры: по отделу, должности, грейду

5. **Управление справочниками (`/admin/:tableId`):**
   - Редактирование навыков (/admin/skills)
   - Редактирование качеств (/admin/qualities)
   - Управление грейдами (/admin/grades)
   - Управление вопросами (/admin/hard_skill_questions, /admin/soft_skill_questions)
   - Управление карьерными треками (/admin/career_tracks)

6. **Создание пользователей (`/users/create`):**
   - CreateUserPage
   - Форма создания нового пользователя
   - Назначение роли
   - Назначение должности, грейда, отдела

7. **Управление встречами (`/admin/stages`):**
   - Создание parent_stages для встреч
   - Создание meeting_stages
   - Добавление участников

#### 8.3.4 Admin (Администратор)

**Типичный день:**

1. **Вход:** `/auth` → `/admin` (AdminDashboard)

2. **Управление пользователями (`/users`):**
   - UsersListPage
   - UsersTableAdmin: полный список пользователей
   - Действия:
     - Редактировать пользователя
     - Назначить роль
     - Деактивировать
     - Просмотр аудита (UserAuditSheet)

3. **Управление ролями и правами (`/security`):**
   - SecurityManagementPage
   - Компоненты:
     - RolesPermissionsManager:
       - Таблица ролей
       - Список прав для каждой роли
       - Добавление/удаление прав
       - Предупреждение при изменении Admin
     - RolePermissionsStats: статистика
     - AuditLogViewer: журнал аудита
     - UserAuditSheet: аудит пользователя
   - Действия:
     - Назначение прав роли
     - Просмотр эффективных прав (user_effective_permissions)
     - Проверка логов отказов (access_denied_logs)

4. **Управление диагностикой:**
   - То же, что HR BP
   - Дополнительно:
     - Удаление этапов
     - Ручное редактирование данных
     - Проверка целостности всей системы

5. **Управление всеми справочниками:**
   - Все таблицы доступны через `/admin/:tableId`
   - Полный CRUD
   - Импорт/экспорт данных

6. **Аудит и логи:**
   - `/security` → вкладка "Журнал аудита"
   - Просмотр всех действий администраторов (audit_log)
   - Просмотр активности (admin_activity_logs)
   - Просмотр отказов в доступе (access_denied_logs)

7. **Миграция данных (`/users/migration`):**
   - UsersMigrationPage
   - Импорт пользователей из файла
   - Валидация данных
   - Массовое создание

### 8.4 Компоненты дизайн-системы

**Расположение:** `src/components/ui/` (shadcn/ui)

**Основные компоненты:**
- **button**: Кнопки (варианты: default, destructive, outline, secondary, ghost, link)
- **card**: Карточки
- **dialog**: Модальные окна
- **dropdown-menu**: Выпадающие меню
- **form**: Формы (react-hook-form + zod)
- **input**: Текстовые поля
- **select**: Селекты
- **table**: Таблицы
- **tabs**: Вкладки
- **toast** / **sonner**: Уведомления
- **sidebar**: Боковое меню
- **sheet**: Боковая панель
- **badge**: Значки
- **avatar**: Аватары
- **progress**: Прогресс-бары
- **calendar**: Календарь
- **chart**: Графики (recharts)
- **tooltip**: Подсказки
- **alert**: Алерты
- **checkbox**: Чекбоксы
- **radio-group**: Радиокнопки
- **switch**: Переключатели
- **slider**: Ползунки
- **accordion**: Аккордеоны
- **collapsible**: Раскрывающиеся блоки

**Кастомизация:** `tailwind.config.ts`, `src/index.css`

**Темизация:** Использование CSS переменных
```css
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --secondary: ...;
  --accent: ...;
  --muted: ...;
  --destructive: ...;
  --border: ...;
  ...
}
```

**Важно:** ВСЕ цвета должны быть в HSL формате. НЕ использовать прямые цвета (white, black, blue и т.д.), только через CSS переменные.

---

## 9. СТАТУСЫ И СОСТОЯНИЯ

### 9.1 diagnostic_stages.status

| Статус | Описание | Условие | Переход |
|--------|----------|---------|---------|
| setup | Настройка этапа | progress_percent = 0 | → assessment (при прогрессе > 0) |
| assessment | Идёт оценка | 0 < progress_percent < 100 | → completed (при прогрессе = 100) |
| completed | Завершён | progress_percent = 100 | - |

**Обновление:** Автоматически через триггер `update_diagnostic_stage_on_participant_add`

### 9.2 survey_360_assignments.status

| Статус | Описание | Кто устанавливает | Переход |
|--------|----------|-------------------|---------|
| pending | Ожидает утверждения | Автоматически при создании (для peer) | → approved, rejected |
| approved | Утверждено руководителем | Руководитель (для peer), Автоматически (для self, manager) | → completed |
| rejected | Отклонено руководителем | Руководитель | - |
| completed | Оценка пройдена | Автоматически при is_draft = false | - |

**Обновление:**
- pending → approved/rejected: Вручную руководителем (ManagerRespondentApproval)
- approved → completed: Автоматически (триггер `update_assignment_on_survey_completion`)

### 9.3 one_on_one_meetings.status

| Статус | Описание | Кто может редактировать | Переход |
|--------|----------|------------------------|---------|
| draft | Черновик | Employee (автор) | → submitted |
| submitted | Отправлено на утверждение | Никто (только чтение) | → approved, returned |
| returned | Возвращено на доработку | Employee (автор) | → submitted |
| approved | Утверждено | Никто (только чтение) | - |

**Обновление:**
- draft → submitted: Employee при отправке
- submitted → approved: Manager при утверждении
- submitted → returned: Manager при возврате

### 9.4 tasks.status

| Статус | Описание | Как устанавливается | Переход |
|--------|----------|---------------------|---------|
| pending | Ожидает выполнения | По умолчанию при создании | → in_progress, completed, cancelled |
| in_progress | В процессе | Вручную или автоматически | → completed, cancelled |
| completed | Завершено | Автоматически или вручную | - |
| cancelled | Отменено | Вручную | - |

**Обновление:**
- pending → in_progress: Вручную при начале выполнения
- in_progress/pending → completed: 
  - Автоматически при завершении связанного assignment (триггер `update_task_status_on_assignment_change`)
  - Автоматически при завершении обоих опросов (триггер `complete_diagnostic_task_on_surveys_completion`)
  - Вручную для задач развития

### 9.5 development_plans.status

| Статус | Описание |
|--------|----------|
| active | Активный |
| completed | Завершённый |
| cancelled | Отменённый |

**Обновление:** Вручную

### 9.6 parent_stages.is_active

| Значение | Описание |
|----------|----------|
| true | Активный период (только один) |
| false | Неактивный период |

**Обновление:** Вручную через UI

### 9.7 Маппинг статусов (statusMapper.ts)

**Файл:** `src/lib/statusMapper.ts`

**Назначение:** Централизованная система маппинга статусов (БД на английском, UI на русском)

**Константы:**
```typescript
export const DB_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  REJECTED: 'rejected',
  DRAFT: 'draft',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Согласовано',
  completed: 'Выполнено',
  in_progress: 'В процессе',
  rejected: 'Отклонено',
  draft: 'Черновик',
};
```

**Функции:**
```typescript
// Получить русский лейбл из английского статуса
export const getStatusLabel = (dbStatus: string): string => {
  return STATUS_LABELS[dbStatus] || dbStatus;
};

// Проверить, завершён ли статус
export const isCompleted = (status: string): boolean => {
  return status === DB_STATUS.COMPLETED;
};

// Проверить, ожидает ли (включая утверждённые)
export const isPending = (status: string): boolean => {
  return status === DB_STATUS.PENDING || status === DB_STATUS.APPROVED;
};
```

**Использование:**
```typescript
import { getStatusLabel, DB_STATUS, isCompleted } from '@/lib/statusMapper';

// В UI
<Badge>{getStatusLabel(assignment.status)}</Badge>

// В условиях
if (isCompleted(task.status)) {
  // ...
}

// В запросах к БД
supabase.from('tasks').update({ status: DB_STATUS.COMPLETED })
```

---

## 10. НЕСООТВЕТСТВИЯ И РЕКОМЕНДАЦИИ

### 10.1 Выявленные несоответствия

#### 10.1.1 SurveyAccessWidget: логика отображения кнопки

**Проблема:**
- Изначально условие было `hasSoftSkillResults && hasHardSkillResults` (AND)
- Это означало, что кнопка скрывалась только если оба опроса завершены
- Если пользователь прошёл только hard skills, кнопка всё ещё отображалась

**Исправление:**
- Изменено на `hasSoftSkillResults || hasHardSkillResults` (OR)
- Теперь кнопка скрывается, если хотя бы один из опросов завершён

**Статус:** ✅ Исправлено

#### 10.1.2 Создание встреч 1:1: проверка участника

**Проблема:**
- Кнопка "Создать встречу" отображалась для всех, кто имеет активный meeting_stage
- Но создавать встречи могут только участники (meeting_stage_participants)

**Исправление:**
- Добавлена проверка в `handleCreateMeeting`:
  ```typescript
  const { data: isParticipant } = await supabase
    .from('meeting_stage_participants')
    .select('id')
    .eq('stage_id', activeStage.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!isParticipant) {
    toast.error("Вы не являетесь участником текущего этапа встреч 1:1");
    return;
  }
  ```

**Статус:** ✅ Исправлено

### 10.2 Потенциальные проблемы

#### 10.2.1 Производительность aggregate_*_results триггеров

**Проблема:**
- Триггеры `aggregate_hard_skill_results` и `aggregate_soft_skill_results` срабатывают AFTER INSERT/UPDATE
- При каждом сохранении ответа (даже черновика) происходит:
  1. DELETE всех старых агрегированных данных для пользователя и этапа
  2. Пересчёт и INSERT новых данных

**Потенциальные последствия:**
- При большом количестве участников и частых сохранениях черновиков может быть нагрузка на БД
- Возможны блокировки таблицы user_assessment_results

**Рекомендация:**
1. **Оптимизация триггера:**
   - Срабатывать только при is_draft = false
   - Использовать UPSERT вместо DELETE + INSERT
   ```sql
   -- Вместо
   DELETE FROM user_assessment_results WHERE ...;
   INSERT INTO user_assessment_results ...;
   
   -- Использовать
   INSERT INTO user_assessment_results ...
   ON CONFLICT (user_id, diagnostic_stage_id, skill_id) 
   DO UPDATE SET ...;
   ```

2. **Асинхронная агрегация:**
   - Рассмотреть возможность отложенной агрегации (например, через очередь или по расписанию)
   - Агрегация только при финальном сохранении (is_draft = false)

**Приоритет:** 🟡 Средний (зависит от масштаба)

#### 10.2.2 Отсутствие кэширования в has_permission

**Проблема:**
- Функция `has_permission` выполняет JOIN через user_roles → role_permissions → permissions при каждом вызове
- Хотя функция STABLE, кэширование работает только в рамках одного запроса
- При частых вызовах (например, в RLS политиках при больших выборках) может быть неоптимально

**Текущее решение:**
- Таблица `user_effective_permissions` кэширует результаты
- Функция `has_permission` читает из этого кэша

**Проблема с текущим решением:**
- Кэш обновляется через триггеры на user_roles и role_permissions
- Если таблица user_effective_permissions не синхронизирована, проверки могут работать некорректно

**Рекомендация:**
1. **Регулярная проверка синхронизации:**
   - Добавить функцию для проверки соответствия user_effective_permissions и реальных прав
   - Запускать периодически (например, ежедневно)

2. **Индексы:**
   - Убедиться, что есть составной индекс на user_effective_permissions(user_id, permission_name)
   - ✅ Уже есть: PRIMARY KEY (user_id, permission_name)

3. **Мониторинг:**
   - Отслеживать производительность запросов с has_permission
   - Логировать случаи несоответствия кэша

**Приоритет:** 🟢 Низкий (работает корректно, но требует мониторинга)

#### 10.2.3 Дублирование логики проверки участников

**Проблема:**
- Проверка участия в этапах дублируется в разных местах:
  - `is_diagnostic_stage_participant` (SQL)
  - `is_meeting_stage_participant` (SQL)
  - Проверки во фронтенде (например, в SurveyAccessWidget, MeetingsPage)

**Рекомендация:**
1. **Централизовать проверки:**
   - Создать хук `useIsStageParticipant(stageType, stageId)`
   - Использовать единообразно во всех компонентах

2. **Использовать RPC вместо прямых запросов:**
   ```typescript
   // Вместо
   const { data } = await supabase
     .from('diagnostic_stage_participants')
     .select('id')
     .eq('stage_id', stageId)
     .eq('user_id', userId)
     .maybeSingle();
   
   // Использовать
   const { data } = await supabase.rpc('is_diagnostic_stage_participant', {
     _stage_id: stageId,
     _user_id: userId
   });
   ```

**Приоритет:** 🟡 Средний (для улучшения поддерживаемости)

### 10.3 Рекомендации по унификации

#### 10.3.1 Унификация типов назначений

**Текущее состояние:**
- assignment_type: 'self', 'manager', 'peer' (в survey_360_assignments)
- assignment_type: 'self', 'manager', 'peer' (в tasks)
- Значения совпадают, но нет enum типа

**Рекомендация:**
```sql
-- Создать enum
CREATE TYPE assignment_type AS ENUM ('self', 'manager', 'peer');

-- Изменить колонки
ALTER TABLE survey_360_assignments 
  ALTER COLUMN assignment_type TYPE assignment_type USING assignment_type::assignment_type;

ALTER TABLE tasks 
  ALTER COLUMN assignment_type TYPE assignment_type USING assignment_type::assignment_type;
```

**Преимущества:**
- Гарантия допустимых значений на уровне БД
- Автозаполнение в IDE
- Типобезопасность

**Приоритет:** 🟢 Низкий (работает, но лучше унифицировать)

#### 10.3.2 Унификация статусов

**Текущее состояние:**
- Статусы хранятся как TEXT
- Нет enum типов для статусов
- Проверка допустимых значений только в коде

**Рекомендация:**
```sql
-- Создать enums для всех статусов
CREATE TYPE diagnostic_stage_status AS ENUM ('setup', 'assessment', 'completed');
CREATE TYPE assignment_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE meeting_status AS ENUM ('draft', 'submitted', 'returned', 'approved');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Применить к таблицам
ALTER TABLE diagnostic_stages 
  ALTER COLUMN status TYPE diagnostic_stage_status USING status::diagnostic_stage_status;
-- и т.д.
```

**Преимущества:**
- Защита от опечаток и некорректных значений
- Типобезопасность
- Автогенерация типов в types.ts

**Приоритет:** 🟡 Средний

#### 10.3.3 Стандартизация триггеров

**Проблема:**
- Некоторые триггеры называются `update_*_on_*`, другие просто по имени функции
- Нет единого стиля именования

**Рекомендация:**
- Принять соглашение об именовании:
  ```
  trigger_{event}_{table}_{purpose}
  
  Примеры:
  - trigger_after_insert_diagnostic_participants_create_assignments
  - trigger_after_update_survey_results_aggregate
  - trigger_before_insert_results_set_period
  ```

**Приоритет:** 🟢 Низкий (косметическое)

#### 10.3.4 Централизация валидации

**Проблема:**
- Валидация данных частично в триггерах (validate_task_diagnostic_stage_id)
- Частично во фронтенде (AssessmentValidation)
- Частично в RLS политиках

**Рекомендация:**
1. **Создать централизованные функции валидации в БД:**
   ```sql
   CREATE FUNCTION validate_assignment(assignment_id UUID) RETURNS TEXT;
   CREATE FUNCTION validate_meeting(meeting_id UUID) RETURNS TEXT;
   ```

2. **Использовать zod схемы во фронтенде:**
   - Определить схемы валидации в отдельном файле
   - Переиспользовать в формах и API запросах

3. **Документировать правила валидации:**
   - Централизованный файл с правилами
   - Ссылки из кода

**Приоритет:** 🟡 Средний

### 10.4 Предложения по улучшению

#### 10.4.1 Добавить логирование действий пользователей

**Текущее состояние:**
- Логируются только админ-действия (audit_log, admin_activity_logs)
- Отказы в доступе (access_denied_logs)

**Предложение:**
- Добавить таблицу user_activity_logs:
  ```sql
  CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- Логировать:
  - Завершение опросов
  - Создание/утверждение встреч
  - Выбор коллег для 360°
  - Выбор карьерных треков

**Преимущества:**
- Аналитика поведения пользователей
- Отладка проблем
- Аудит действий

**Приоритет:** 🟡 Средний

#### 10.4.2 Добавить уведомления (notifications)

**Предложение:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Триггеры для создания уведомлений:**
- При утверждении респондента → уведомление коллеге
- При возврате встречи → уведомление сотруднику
- При утверждении встречи → уведомление сотруднику
- При добавлении в этап → уведомление участнику

**UI:**
- Иконка колокольчика в хедере
- Счётчик непрочитанных
- Выпадающий список уведомлений

**Приоритет:** 🟡 Средний

#### 10.4.3 Добавить экспорт данных

**Предложение:**
- Функция экспорта результатов оценки в PDF
- Экспорт отчётов по команде в Excel
- Экспорт планов развития

**Технологии:**
- PDF: react-pdf или jspdf
- Excel: xlsx (уже установлен)

**Приоритет:** 🟢 Низкий

#### 10.4.4 Оптимизация загрузки данных

**Проблема:**
- Некоторые страницы делают множественные запросы к БД
- Нет пагинации на больших списках

**Рекомендация:**
1. **Использовать React Query для кэширования:**
   - ✅ Уже используется @tanstack/react-query
   - Настроить staleTime и cacheTime для разных типов данных

2. **Добавить пагинацию:**
   - Для списка пользователей (UsersTableAdmin)
   - Для списка встреч (MeetingsPage)
   - Для списка задач (TaskList)

3. **Использовать виртуализацию:**
   - Для больших таблиц (например, TeamMembersTable)
   - Библиотека: @tanstack/react-virtual

4. **Объединить запросы через JOIN:**
   - Вместо N+1 запросов использовать SELECT с JOIN
   - Например, загрузка пользователей с ролями одним запросом

**Приоритет:** 🟡 Средний

#### 10.4.5 Улучшить UI/UX для мобильных

**Проблема:**
- UI оптимизирован для десктопа
- Некоторые таблицы сложно использовать на мобильных

**Рекомендация:**
1. **Адаптивные таблицы:**
   - На мобильных показывать карточки вместо таблиц
   - Использовать accordion для раскрытия деталей

2. **Упростить навигацию:**
   - Нижнее меню для основных разделов
   - Гамбургер-меню для остального

3. **Оптимизировать формы:**
   - Использовать нативные контролы (date picker, select)
   - Разбить длинные формы на шаги

**Приоритет:** 🟢 Низкий (если нет требований поддержки мобильных)

### 10.5 Критические замечания для немедленного исправления

**Нет критических замечаний.** Система работает корректно после внесённых исправлений.

### 10.6 Контрольный список перед продакшеном

- [ ] Проверить все RLS политики на корректность
- [ ] Убедиться, что все триггеры работают корректно
- [ ] Проверить целостность данных через `check_diagnostic_data_consistency()` и `check_meetings_data_consistency()`
- [ ] Провести нагрузочное тестирование
- [ ] Настроить мониторинг производительности
- [ ] Настроить резервное копирование БД
- [ ] Проверить логи на наличие ошибок
- [ ] Провести ручное тестирование всех сценариев для каждой роли
- [ ] Убедиться, что все секреты (API ключи) хранятся безопасно
- [ ] Проверить CORS настройки
- [ ] Настроить rate limiting для API
- [ ] Добавить метрики и алерты
- [ ] Подготовить документацию для пользователей
- [ ] Провести security audit
- [ ] Проверить соответствие GDPR (если применимо)

---

## ЗАКЛЮЧЕНИЕ

Данная документация описывает текущее состояние системы управления компетенциями и развитием персонала по состоянию на 15 января 2025 года.

**Основные достижения:**
- ✅ Полная миграция на Supabase Auth
- ✅ Внедрение permission-based системы доступа
- ✅ Автоматизация создания назначений и задач
- ✅ Комплексная система диагностики (360° + навыки)
- ✅ Функционал встреч 1:1
- ✅ Карьерные треки и планы развития
- ✅ HR-аналитика и отчётность

**Система готова к использованию** с учётом рекомендаций по оптимизации и улучшению UX.

**Поддержка и развитие:**
- Регулярная проверка целостности данных
- Мониторинг производительности
- Сбор обратной связи от пользователей
- Итеративное улучшение функционала

---

**Конец документации**
