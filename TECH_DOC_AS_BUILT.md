# MILU — Полная техническая документация (as-built)

**Проект:** MILU (HR-платформа для оценки и развития сотрудников)  
**Дата:** 2026-02-19  
**Ветка:** main  
**Commit hash:** не доступен (Lovable Cloud)  
**Автор:** Lovable AI  
**Published URL:** https://milu.lovable.app  
**Supabase Project ID:** `zgbimzuhrsgvfrhlboxy`

---

## 0. Metadata

| Параметр | Значение |
|---|---|
| Фреймворк | React 18 + Vite + TypeScript |
| БД | Supabase (PostgreSQL) |
| Деплой | Lovable Cloud |
| Язык интерфейса | Русский |
| Аутентификация | Supabase Auth (email/password) |

---

## 1. Обзор системы

### Назначение

MILU — внутренняя HR-платформа для проведения оценки компетенций сотрудников (360°, hard skills, soft skills), карьерного планирования, управления встречами one-to-one между сотрудником и руководителем, и планирования развития.

### Пользовательские роли (из БД, enum `app_role`)

Определены в PostgreSQL enum `public.app_role`:

- `admin` — полный доступ ко всем модулям
- `hr_bp` — HR бизнес-партнёр, расширенный доступ к оценке и справочникам
- `manager` — руководитель, доступ к командам и встречам
- `employee` — базовая роль, самооценка и заполнение форм

Роли хранятся в таблице `user_roles` (user_id, role), **не** в таблице `users`.

**Где в коде:** `src/contexts/AuthContext.tsx:99` — загрузка роли из `user_roles`.

### Границы ответственности

- **Фронтенд:** React SPA, отвечает за UI, навигацию, вызовы Supabase SDK
- **Бэкенд:** Supabase (PostgreSQL + Edge Functions + RLS + triggers)
- **Внешние сервисы:** Yandex Cloud (trigger `encrypt_user_data_trigger` — устаревший), OpenAI (генерация Johari-отчётов через edge function)

---

## 2. Архитектура

```
Browser (React SPA)
    ↓ Supabase JS SDK (REST + Realtime)
Supabase Cloud
    ├── PostgreSQL (данные, RLS, функции, триггеры, pg_cron)
    ├── Edge Functions (Deno) — create-user, delete-user, update-user, generate-johari-report, etc.
    ├── Auth (JWT, email/password)
    └── Storage (не используется в текущей реализации)
```

### Потоки данных

1. **Аутентификация:** Browser → Supabase Auth → JWT → все запросы с Bearer token
2. **CRUD операции:** Browser → Supabase SDK → PostgREST (с RLS) → PostgreSQL
3. **Административные операции:** Browser → Edge Function (с JWT) → Service Role Client → PostgreSQL
4. **Фоновые задачи:** pg_cron → SQL-функции (finalize_expired_stage, expire_stageless_meetings)

---

## 3. Технологический стек

### Фронтенд

| Технология | Версия | Назначение |
|---|---|---|
| React | ^18.3.1 | UI framework |
| Vite | (config: vite.config.ts) | Сборка |
| TypeScript | (tsconfig.app.json) | Типизация |
| Tailwind CSS | + tailwindcss-animate | Стилизация |
| shadcn/ui | (components/ui/) | UI-компоненты |
| @tanstack/react-query | ^5.83.0 | Кэш и запросы данных |
| react-router-dom | ^6.30.1 | Маршрутизация |
| react-hook-form + zod | ^7.61.1 / ^3.25.76 | Формы и валидация |
| recharts | ^2.15.4 | Графики |
| date-fns | ^3.6.0 | Работа с датами |
| sonner | ^1.7.4 | Тост-уведомления |
| xlsx | ^0.18.5 | Экспорт в Excel |
| lucide-react | ^0.462.0 | Иконки |
| @supabase/supabase-js | ^2.57.2 | Supabase SDK |

### Бэкенд

| Технология | Назначение |
|---|---|
| Supabase PostgreSQL | Основная БД |
| Supabase Edge Functions (Deno) | Серверная логика |
| Row Level Security (RLS) | Авторизация на уровне БД |
| pg_cron | Фоновые задачи |

---

## 4. Запуск и окружения

### Переменные окружения

| Переменная | Назначение | Где читается |
|---|---|---|
| `VITE_SUPABASE_PROJECT_ID` | ID проекта Supabase | `.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key Supabase | `.env`, `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_URL` | URL Supabase API | `.env`, `src/integrations/supabase/client.ts` |
| `VITE_MEETINGS_STAGE_UI_ENABLED` | Feature flag: UI подэтапа встреч | `.env`, `src/components/stages/AddSubStageDialog.tsx` |
| `SUPABASE_URL` | (Edge Functions) URL | Deno.env в edge functions |
| `SUPABASE_ANON_KEY` | (Edge Functions) Anon key | Deno.env в edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | (Edge Functions) Service role | Deno.env в edge functions |

**Примечание:** `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY` также захардкожены в `src/integrations/supabase/client.ts` (строки 5-6). `.env` используется только для Vite-процессинга.

### Локальный запуск

```bash
# Установка зависимостей (bun)
bun install

# Запуск dev-сервера
bun run dev
```

### Сборка

```bash
bun run build
```

### Деплой

Деплой осуществляется через Lovable Cloud. Публикация — кнопкой "Publish" в интерфейсе Lovable.

---

## 5. Роутинг и страницы

### Маршруты (из `src/App.tsx`)

| Путь | Компонент | Доступ | Назначение |
|---|---|---|---|
| `/auth` | `AuthPage` | Публичный | Вход в систему |
| `/` | `Index` | AuthGuard | Главная страница (дашборд) |
| `/profile` | `ProfilePage` | AuthGuard | Профиль пользователя |
| `/tasks` | `TasksPage` | AuthGuard | Мои задачи |
| `/meetings` | `MeetingsPage` | AuthGuard | Встречи one-to-one |
| `/meetings-monitoring` | `MeetingsMonitoringPage` | AuthGuard | Мониторинг встреч one-to-one |
| `/team` | `TeamPage` | AuthGuard | Моя команда |
| `/feed` | `FeedPage` | AuthGuard | Лента событий |
| `/questionnaires` | `DevelopmentQuestionnairesPage` | AuthGuard | Обратная связь 360 |
| `/development/career-track` | `DevelopmentCareerTrackPage` | AuthGuard | Карьерный трек |
| `/skill-survey/questions/:assignmentId` | `SkillSurveyQuestionsPage` | AuthGuard | Форма hard skills опроса |
| `/skill-survey/results` | `SkillSurveyResultsPage` | AuthGuard | Результаты hard skills |
| `/survey-360/questions/:assignmentId` | `Survey360QuestionsPage` | AuthGuard | Форма 360° опроса |
| `/survey-360-results` | `Survey360ResultsPage` | AuthGuard | Результаты 360° |
| `/assessment/:assignmentId` | `UnifiedAssessmentPage` | AuthGuard | Единая форма оценки |
| `/assessment/results/:userId` | `AssessmentResultsPage` | AuthGuard | Результаты оценки |
| `/assessment/completed` | `AssessmentCompletedPage` | AuthGuard | Завершение оценки |
| `/my-assignments` | `MyAssignmentsPage` | AuthGuard | Мои назначения |
| `/manager-reports` | `ManagerReportsPage` | AuthGuard | Отчёты руководителя |
| `/manager/comparison` | `ManagerComparisonPage` | AuthGuard | Сравнительный анализ |
| `/hr-analytics` | `HRAnalyticsPage` | AuthGuard | HR-аналитика |
| `/diagnostic-monitoring` | `DiagnosticMonitoringPage` | AuthGuard | Мониторинг диагностики |
| `/users` | `UsersListPage` | AuthGuard | Список пользователей |
| `/users/create` | `CreateUserPage` | AuthGuard | Создание пользователя |
| `/users/migration` | `UsersMigrationPage` | AuthGuard | Миграция пользователей |
| `/security` | `SecurityManagementPage` | AuthGuard | Безопасность/роли |
| `/admin` | `AdminDashboard` | AuthGuard | Админ-панель |
| `/admin/users` | `UsersAdminPage` | AuthGuard | Управление пользователями |
| `/admin/stages` | `StagesPage` | AuthGuard | Управление этапами |
| `/admin/:tableId` | `ReferenceTablePage` | AuthGuard | Справочные таблицы |
| `/admin/diagnostics` | `DiagnosticsAdminPage` | AuthGuard | Диагностика (админ) |
| `*` | `NotFound` | AuthGuard | 404 |

### Управление состоянием

- **Серверное состояние:** `@tanstack/react-query` (queryClient в `src/App.tsx:48`)
- **Аутентификация:** `AuthContext` (`src/contexts/AuthContext.tsx`)
- **Локальное состояние:** `useState` в компонентах
- **Нет глобального стора** (Redux/Zustand не используются)

### Feature flags

| Флаг | Значение | Назначение |
|---|---|---|
| `VITE_MEETINGS_STAGE_UI_ENABLED` | `false` | Скрывает UI создания подэтапов встреч one-to-one (legacy) |

### Sidebar (навигация)

Файл: `src/components/AppSidebar.tsx`

Видимость пунктов меню определяется permission-based проверками:

| Пункт | Условие |
|---|---|
| Главная | Всегда |
| Профиль | `team.view` ИЛИ `security.view_admin_panel` |
| Мои задачи | Всегда |
| Карьерный трек | `gradeLevel > 0` (для employee) или `team.view` |
| Обратная связь 360 | Всегда |
| Встречи | Участие в diagnostic stage, наличие встреч, или наличие `manager_id` (employee); `team.view` (manager) |
| Мониторинг встреч | `team.view` или `meetings.manage` |
| Моя команда | `team.view` |
| Мониторинг диагностики | `security.view_admin_panel` ИЛИ `diagnostics.manage_participants` ИЛИ `diagnostics.view_results` |
| Справочники | `security.view_admin_panel` |
| Безопасность | `security.manage` |

**Где в коде:** `src/hooks/useMenuVisibility.ts`, `src/components/AppSidebar.tsx:49-60`

---

## 6. Авторизация и сессии

### Провайдер

Supabase Auth (JWT). Только email/password. OAuth не используется.

### Хранение токена

- `persistSession: true` в клиенте Supabase (`src/integrations/supabase/client.ts:13`)
- `autoRefreshToken: true` — автообновление JWT
- Токен хранится в localStorage (стандартное поведение Supabase)

### Сессионный flow

1. `onAuthStateChange` слушает изменения (AuthContext, строка 42)
2. `getSession()` проверяет существующую сессию (строка 68)
3. При наличии сессии — загрузка данных пользователя (`loadUserData`)
4. Данные: id, full_name, email, role (из `user_roles`)

### AuthGuard

Файл: `src/components/AuthGuard.tsx`

- Показывает спиннер при `loading`
- Редиректит на `/auth` при `!isAuthenticated`
- Оборачивает все маршруты кроме `/auth`

### Обработка ошибок аутентификации

- `AuthPage.tsx:80-84` — обработка `Invalid login credentials`
- При ошибке — toast с сообщением

### Cookie consent

- Проверяется поле `users.cookies_consent` перед входом
- Если не принято — показывается чекбокс с ссылкой на политику
- После принятия — обновляется `cookies_consent` и `cookies_consent_at`

**Где в коде:** `src/pages/AuthPage.tsx:37-67`

---

## 7. RBAC/ABAC и безопасность

### Модель доступа

**RBAC (Role-Based Access Control)** с дополнительным permission-layer.

### Иерархия

```
app_role (enum) → user_roles (таблица) → role_permissions → permissions
                                        ↓
                        user_effective_permissions (materialized cache)
```

### Ключевые таблицы

| Таблица | Назначение |
|---|---|
| `user_roles` | Связь user → role (1:1) |
| `permissions` | Каталог permissions (resource + action) |
| `role_permissions` | Связь role → permission (M:N) |
| `user_effective_permissions` | Кэш-таблица для быстрой проверки |
| `permission_groups` | Группировка permissions для UI |
| `permission_group_permissions` | Связь groups → permissions |
| `access_denied_logs` | Лог отказов в доступе |

### SQL-функции для проверки прав

| Функция | Сигнатура | Назначение |
|---|---|---|
| `has_permission` | `(_permission_name text) → boolean` | Основная проверка. Использует `auth.uid()` внутри. SECURITY DEFINER |
| `is_owner` | `(user_id_to_check uuid) → boolean` | Проверка владельца |
| `is_users_manager` | `(employee_id uuid) → boolean` | Проверка руководитель ли текущий user для employee |
| `get_current_user_id` | `() → uuid` | Обёртка над `auth.uid()` |
| `refresh_user_effective_permissions` | `(target_user_id uuid) → void` | Обновление кэша прав пользователя |
| `refresh_role_effective_permissions` | `(target_role app_role) → void` | Обновление кэша прав для роли |

### Enforcement

- **БД (RLS):** ~70+ политик на всех таблицах. Используют `has_permission()`, `auth.uid()`, `is_users_manager()`, прямые проверки `user_roles`
- **Edge Functions:** Проверка JWT + `has_permission` через service role client
- **Фронтенд:** Hook `usePermission` (`src/hooks/usePermission.ts`) — вызывает `supabase.rpc('has_permission')`. Контролирует видимость UI-элементов

### Известные permissions (из кода)

- `team.view`, `users.create`, `users.manage_roles`
- `security.manage`, `security.view_admin_panel`
- `diagnostics.manage`, `diagnostics.create`, `diagnostics.update`, `diagnostics.delete`, `diagnostics.view`, `diagnostics.view_results`, `diagnostics.manage_participants`
- `meetings.manage`, `meetings.view_all`
- `development.manage`, `development.view_all`
- `assessment_results.view`, `assessment_results.view_all`

### Критичное ограничение

- `types.ts` (автогенерированный) имеет устаревшую сигнатуру `has_permission`: `{ _permission_name: string; _user_id: string }`. Фактически функция в БД принимает только `_permission_name`. Фронтенд использует `(supabase.rpc as any)` для обхода (**техдолг**).

**Где в коде:** `src/hooks/usePermission.ts:26`, `src/types/supabase-rpc.ts` (корректные типы)

---

## 8. API слой

### Supabase SDK (основные вызовы)

Все взаимодействия через `@supabase/supabase-js`. Клиент: `src/integrations/supabase/client.ts`.

#### RPC-вызовы

| Функция | Вызов из | Назначение |
|---|---|---|
| `has_permission` | `usePermission.ts` | Проверка прав |
| `calculate_diagnostic_stage_progress` | Мониторинг диагностики | Расчёт прогресса |
| `check_diagnostic_data_consistency` | Админ-диагностика | Проверка консистентности |
| `check_meetings_data_consistency` | Админ-диагностика | Проверка встреч |
| `calculate_career_gap` | Карьерный трек | Gap-анализ |
| `log_admin_action` | Edge functions, AdminLogger | Аудит действий |
| `get_users_with_roles` | Администрирование пользователей | Список с ролями |
| `get_all_permissions` | Безопасность | Все permissions |
| `get_role_permissions` | Безопасность | Связи ролей |

### Edge Functions

Все функции в `supabase/functions/`, деплой через Lovable Cloud.

| Функция | JWT | Назначение |
|---|---|---|
| `create-user` | ✅ | Создание пользователя (auth + users + user_roles). Проверяет `users.create` |
| `update-user` | ✅ | Обновление данных пользователя |
| `delete-user` | ✅ | Удаление пользователя (auth + users) |
| `create-peer-approval-task` | ✅ | Создание задачи на утверждение peer-респондентов |
| `create-peer-evaluation-tasks` | ✅ | Создание задач на оценку peer-респондентов |
| `create-peer-selection-task-on-participant-add` | ✅ | Создание задачи выбора коллег при добавлении участника |
| `generate-development-tasks` | ✅ | Генерация задач развития |
| `generate-johari-report` | ❌ (manual JWT check) | Генерация AI-отчёта Johari Window |
| `import-diagnostics-data` | ✅ | Импорт данных диагностики |
| `import-grades-data` | ✅ | Импорт данных грейдов |
| `create-database-dump` | ✅ | Создание дампа БД |

**Конфиг:** `supabase/config.toml`

### CORS

Все edge functions используют `Access-Control-Allow-Origin: "*"` (**техдолг: следует ограничить**).

---

## 9. Модель данных

### Таблицы (60 таблиц в public schema)

#### Ядро пользователей

| Таблица | Назначение | PK | Ключевые FK |
|---|---|---|---|
| `users` | Основная таблица сотрудников | `id` (uuid = auth.users.id) | `manager_id→users`, `position_id→positions`, `department_id→departments`, `grade_id→grades` |
| `user_roles` | Роли пользователей | `id` | `user_id→auth.users` |
| `user_profiles` | Доп. профили | `id` | — |
| `user_effective_permissions` | Кэш прав | `user_id+permission_name` | `user_id→auth.users` |

#### Оценка 360° (soft skills)

| Таблица | Назначение |
|---|---|
| `soft_skills` | Справочник soft skills (качеств) |
| `category_soft_skills` | Категории soft skills |
| `sub_category_soft_skills` | Подкатегории |
| `soft_skill_questions` | Вопросы опроса 360° |
| `soft_skill_answer_options` | Варианты ответов |
| `soft_skill_results` | Результаты оценки 360° |

#### Оценка hard skills

| Таблица | Назначение |
|---|---|
| `hard_skills` | Справочник hard skills |
| `category_hard_skills` | Категории |
| `sub_category_hard_skills` | Подкатегории |
| `hard_skill_questions` | Вопросы |
| `hard_skill_answer_options` | Варианты ответов |
| `hard_skill_results` | Результаты оценки |

#### Назначения и диагностика

| Таблица | Назначение |
|---|---|
| `survey_360_assignments` | Назначения на оценку (кто кого оценивает) |
| `tasks` | Задачи пользователей (оценка, встречи, и др.) |
| `diagnostic_stages` | Подэтапы диагностики |
| `diagnostic_stage_participants` | Участники подэтапов |
| `parent_stages` | Родительские этапы (период, даты) |
| `employee_stage_snapshots` | Снапшоты результатов на конец этапа |

#### Встречи one-to-one

| Таблица | Назначение |
|---|---|
| `one_on_one_meetings` | Встречи one-to-one. `stage_id` nullable (stage-less режим по умолчанию) |
| `meeting_manager_fields` | Поля руководителя (отдельная таблица для RLS-безопасности) |
| `meeting_decisions` | Договорённости (action items) после встречи |
| `meeting_artifacts` | Вложения к встрече (до 10 файлов, 25MB каждый) |
| `meeting_private_notes` | Приватные заметки руководителя |
| `meeting_stages` | Подэтапы встреч (legacy, UI скрыт за feature flag) |
| `meeting_stage_participants` | Участники подэтапов встреч (legacy) |

#### Грейды и карьерные треки

| Таблица | Назначение |
|---|---|
| `grades` | Грейды (уровни должности) |
| `grade_skills` | Требуемые hard skills для грейда |
| `grade_qualities` | Требуемые soft skills для грейда |
| `career_tracks` | Карьерные треки |
| `career_track_steps` | Шаги карьерного трека |
| `user_career_progress` | Прогресс пользователя по треку |
| `user_career_ratings` | Рейтинги карьеры |

#### Развитие

| Таблица | Назначение |
|---|---|
| `development_plans` | Планы развития |
| `development_plan_tasks` | Задачи планов развития |
| `development_tasks` | Справочник задач развития |

#### Организационная структура

| Таблица | Назначение |
|---|---|
| `companies` | Компании |
| `departments` | Подразделения |
| `positions` | Должности |
| `position_categories` | Категории должностей |

#### Справочники

| Таблица | Назначение |
|---|---|
| `answer_categories` | Категории ответов |
| `competency_levels` | Уровни компетенций |
| `certifications` | Сертификации |
| `track_types` | Типы треков |
| `manufacturers` | Производители (legacy) |
| `trade_points` | Торговые точки (legacy) |

#### Аудит и безопасность

| Таблица | Назначение |
|---|---|
| `audit_log` | Лог действий администратора (old) |
| `admin_activity_logs` | Лог активности админа (new) |
| `access_denied_logs` | Лог отказов в доступе |
| `permissions` | Каталог прав |
| `role_permissions` | Связь роль→право |
| `permission_groups` | Группы прав |
| `permission_group_permissions` | Связь группа→право |

#### AI

| Таблица | Назначение |
|---|---|
| `johari_ai_snapshots` | Снапшоты AI-анализа Johari Window |

### Ключевые инварианты

1. **`user_roles`**: unique(user_id, role) — один пользователь = одна роль
2. **`one_on_one_meetings`**: Constraint — не более одной будущей `scheduled` встречи на пару employee+manager (валидация через триггер `compute_meeting_status_and_validate`)
3. **`survey_360_assignments`**: unique(evaluated_user_id, evaluating_user_id, diagnostic_stage_id) — дедупликация назначений
4. **`diagnostic_stage_participants`**: unique(stage_id, user_id) — один участник на этап

### Триггеры (ключевые)

| Триггер | Таблица | Назначение |
|---|---|---|
| `on_participant_added` | `diagnostic_stage_participants` | При добавлении участника создаёт assignments и tasks |
| `trg_compute_meeting_status` | `one_on_one_meetings` | Вычисляет статус (`scheduled`/`awaiting_summary`/`recorded`) и валидирует уникальность scheduled-встречи |
| `create_meeting_scheduled_task` | `one_on_one_meetings` | Создаёт task `meeting_scheduled` при INSERT |
| `trg_create_review_summary_task` | `one_on_one_meetings` | Создаёт task `meeting_review_summary` для второй стороны при сохранении итогов |
| `encrypt_user_data_trigger` | `users` | **УСТАРЕВШИЙ** — отправка PII на внешний endpoint |

### Миграции

Хранятся в `supabase/migrations/` (read-only). Дополнительные DDL-only миграции в `migrations/` (root). Применяются через Lovable Cloud или Supabase CLI.

---

## 9a. Контракт шкал оценки (Assessment Scales Contract)

### Утверждённые диапазоны

| Тип оценки | Шкала | Min | Max | Источник истины | DB constraint |
|---|---|---|---|---|---|
| Hard Skills | 0–4 | 0 | 4 | `hard_skill_answer_options.numeric_value` | `user_skills.current_level CHECK (0..4)`, `user_skills.target_level CHECK (0..4)` |
| Soft Skills (360°) | 0–5 | 0 | 5 | `soft_skill_answer_options.numeric_value` | `user_qualities.current_level CHECK (0..5)`, `user_qualities.target_level CHECK (0..5)` |

### Поле-источник истины

**`numeric_value`** — единственное поле, используемое для всех расчётов средних, gap-анализа, Johari-метрик. Поле `level_value` в `hard_skill_answer_options` существует, но **не используется** в логике расчётов.

### Правило обработки нуля и пропусков

- Записи с `is_skip = true` **исключаются** из расчётов (фильтр `.neq('is_skip', true)` или `.or('is_skip.is.null,is_skip.eq.false')`)
- `numeric_value = 0` **участвует** в вычислении средних (не трактуется как "нет оценки")
- Самооценка (`evaluating_user_id = evaluated_user_id`) отделяется от внешних оценок

### Johari Window: правила расчёта

- **Шкала:** определяется динамически из `soft_skill_answer_options` (SELECT MIN/MAX numeric_value). Ожидаемый результат: 0–5
- **Используются только Soft Skills**
- **Self:** `evaluating_user_id = evaluated_user_id`
- **Others:** manager + peers (scope=all) или только external peers (scope=external_only)
- **Агрегация others:** "среднее средних" — для каждого оценщика вычисляется avg по его ответам, затем avg этих средних
- **Пороги зон:** `tArena = 0.125 × range`, `tHi = 0.15 × range` (для range=5: tArena=0.625, tHi=0.75)
- **Delta:** `|self_avg - others_avg|`
- **Минимум респондентов:** ≥ 3 "others" на навык (иначе excluded)
- **Поляризация:** среди others-средних есть одновременно ≤ 33%-tile и ≥ 67%-tile
- **Где:** `supabase/functions/generate-johari-report/index.ts:234-249`

### Таблица расхождений (аудит 2026-02-25)

| Файл | Строка | Проблема | Серьёзность |
|---|---|---|---|
| `src/components/AssessmentDetailsReport.tsx` | 537 | `maxValue={5}` для Hard Skills (должно быть 4) | 🔴 Критично |
| `src/components/AssessmentDetailsReport.tsx` | 552 | `maxValue={4}` для Soft Skills (должно быть 5) | 🔴 Критично |
| `src/hooks/useSkillAssessmentResults.ts` | 11, 139 | `gap_analysis = 5 - overallAvg` — целевой уровень hard skills захардкожен как 5 (должно быть 4 или из grade) | 🔴 Критично |
| `src/components/SkillsGradeWidget.tsx` | 74-75 | `currentLevel / 5` и `targetLevel / 5` — для hard skills должно быть `/4` | 🟡 Среднее |
| `src/lib/scoreLabels.ts` | 2-9 | `getSkillScoreLabel` покрывает диапазон 0–5, но hard skills шкала 0–4 | 🟡 Среднее |
| `src/hooks/useCompetencyProfile.ts` | 160 | `target_level || 5` — fallback 5 для soft skills корректен, но не отличает hard/soft | 🟡 Среднее |

### Файлы без расхождений (корректные)

| Файл | Строка | Что проверено |
|---|---|---|
| `src/hooks/useCorrectAssessmentResults.ts` | 387, 565, 685, 791 | `setMaxValue(4)` для hard, `setMaxValue(5)` для soft ✅ |
| `src/components/RadarChartResults.tsx` | 262 | `filterType.startsWith('hard') ? 4 : 5` ✅ |
| `supabase/functions/generate-johari-report/index.ts` | 234-245 | Динамическое определение шкалы из БД ✅ |
| `src/hooks/useSkillSurveyResults.ts` | 73 | Использует `numeric_value` ✅ |
| `src/hooks/useSurvey360Results.ts` | 99 | Использует `numeric_value` ✅ |

### План исправлений

#### 🔴 Критично сейчас

1. **`AssessmentDetailsReport.tsx:537`** — заменить `maxValue={5}` → `maxValue={4}` (Hard Skills)
2. **`AssessmentDetailsReport.tsx:552`** — заменить `maxValue={4}` → `maxValue={5}` (Soft Skills)
3. **`useSkillAssessmentResults.ts:139`** — заменить `5 - overallAvg` → `4 - overallAvg` (или использовать target_level из grade)

#### 🟡 Можно позже

4. **`SkillsGradeWidget.tsx:74-75`** — заменить `/5` → `/4` (или использовать `HARD_SKILLS_MAX_LEVEL` из scoreLabels.ts, который сейчас = 4)
5. **`scoreLabels.ts:2-9`** — пересмотреть labels для шкалы 0-4 (5 уровней вместо 6)
6. **`useCompetencyProfile.ts:160`** — добавить различение hard/soft для fallback target_level

### Open Questions

1. **`numeric_value = 0` — это "нет оценки" или "минимальная оценка"?** В текущем коде 0 участвует в средних. Нужно ли исключать? → **Решение: оставить как есть (0 = минимальный балл), пропуски обрабатываются через `is_skip`**

---

## 10. Бизнес-процессы end-to-end

### 10.1. Диагностический цикл (360° + Hard Skills)

**Шаги:**

1. **Admin/HR создаёт родительский этап** (`parent_stages`) с датами
2. **Создаёт подэтап диагностики** (`diagnostic_stages`) с привязкой к parent
3. **Добавляет участников** (`diagnostic_stage_participants`) → триггер создаёт `survey_360_assignments` + `tasks`
4. **Сотрудник выбирает peer-респондентов** → задача `peer_selection` → вызов edge function `create-peer-approval-task`
5. **Руководитель утверждает peer-респондентов** → вызов edge function `create-peer-evaluation-tasks` → создаются задачи оценки
6. **Респонденты заполняют формы** (`/assessment/:assignmentId`) → результаты в `soft_skill_results` / `hard_skill_results`
7. **Задача помечается как completed** → обновление `tasks.status`
8. **HR/Manager просматривает результаты** (`/assessment/results/:userId`)
9. **При закрытии этапа** → `finalize_expired_stage()` фиксирует snapshot в `employee_stage_snapshots`

**Где в коде:**
- `src/hooks/useDiagnosticStages.ts` — управление этапами
- `src/hooks/useSurvey360Assignments.ts` — назначения
- `src/hooks/useTasks.ts` — задачи
- `src/pages/UnifiedAssessmentPage.tsx` — единая форма оценки
- `supabase/functions/create-peer-evaluation-tasks/` — создание задач

### 10.2. Встреча one-to-one

**Модель:** Stage-less цифровой контейнер встречи с тремя статусами.

**Статусы (вычисляются автоматически в БД):**
- `scheduled` — дата встречи в будущем, итогов нет
- `awaiting_summary` — дата встречи прошла, итогов нет
- `recorded` — итоги (meeting_summary) заполнены

**Шаги:**

1. **Сотрудник/Руководитель/HR создаёт встречу** (`CreateMeetingDialog`) → INSERT в `one_on_one_meetings`
2. **Триггер `create_meeting_scheduled_task`** создаёт задачу `meeting_scheduled` для обоих участников
3. **Триггер `trg_compute_meeting_status`** автоматически определяет статус на основе `meeting_date` и `meeting_summary`
4. **Участники заполняют форму** (`MeetingForm`):
   - Блок сотрудника: настроение, успехи, проблемы, новости, вопросы
   - Блок руководителя (хранится в `meeting_manager_fields`): заметки руководителя
5. **Сохранение итогов** — любой участник сохраняет `meeting_summary` → статус `recorded`
6. **Триггер `trg_create_review_summary_task`** создаёт задачу `meeting_review_summary` для второй стороны

**Автоматические задачи (pg_cron `process_meeting_tasks` каждые 15 мин):**
- `meeting_fill_summary` — назначается руководителю, если дата прошла, а итоги не записаны
- `meeting_plan_new` — назначается руководителю, если сотрудник активный, внутренний, уже участвовал в цикле встреч, но >35 дней без `recorded` встречи

**Историчность:** История встреч привязана к `employee_id`. Текущий руководитель (из `users.manager_id`) видит всю историю подчинённого. Для «исторических» встреч (где `manager_id` ≠ текущий пользователь) форма открывается в read-only режиме.

**Subtree-доступ:** Вышестоящие руководители видят встречи непрямых подчинённых через RLS (`is_in_management_subtree`), в read-only режиме.

**Вложения:** До 10 файлов по 25MB на встречу. Хранятся в bucket `meeting-artifacts`. JS/EXE запрещены. Доступ через signed URLs (300с).

**Где в коде:**
- `src/hooks/useOneOnOneMeetings.ts` — CRUD и мутации
- `src/hooks/useMeetingManagerFields.ts` — поля руководителя
- `src/hooks/useMeetingArtifacts.ts` — вложения
- `src/hooks/useMeetingTasks.ts` — acknowledgement задач ревью
- `src/components/MeetingForm.tsx` — форма
- `src/components/CreateMeetingDialog.tsx` — диалог создания
- `src/pages/MeetingsPage.tsx` — страница списка
- `src/pages/MeetingsMonitoringPage.tsx` — мониторинг встреч one-to-one
- `src/hooks/useMeetingDecisions.ts` — договорённости
- `src/hooks/useMeetingPrivateNotes.ts` — приватные заметки

### 10.3. Создание пользователя

**Шаги:**

1. Admin/HR открывает `/users/create`
2. Заполняет форму (email, пароль, ФИО, роль, руководитель, должность, отдел, грейд)
3. Фронтенд вызывает edge function `create-user`
4. Edge function: проверяет JWT → проверяет `users.create` permission → создаёт auth user → создаёт запись в `users` → создаёт запись в `user_roles` → логирует `log_admin_action`
5. При ошибке — rollback (удаление auth user и записи)

**Где в коде:** `supabase/functions/create-user/index.ts`

### 10.4. Карьерный трек

**Шаги:**

1. Admin создаёт карьерный трек (`career_tracks`) с шагами (`career_track_steps`), каждый шаг привязан к грейду
2. Для каждого грейда определены required skills (`grade_skills`) и qualities (`grade_qualities`)
3. RPC `calculate_career_gap` сравнивает текущий уровень пользователя с target
4. Результат: gap-анализ по каждой компетенции

**Где в коде:**
- `src/hooks/useCareerTracks.ts`
- `src/hooks/useUserCareerProgress.ts`
- `src/components/CareerTrackDetails.tsx`
- `src/components/GapAnalysisWidget.tsx`

### 10.5. Johari Window (AI-анализ)

**Шаги:**

1. HR/Manager запрашивает генерацию отчёта для сотрудника
2. Вызывается edge function `generate-johari-report`
3. Функция агрегирует результаты 360° (self vs others), вычисляет метрики
4. Отправляет данные в OpenAI API для генерации текстового анализа
5. Результат сохраняется в `johari_ai_snapshots`

**Где в коде:**
- `supabase/functions/generate-johari-report/`
- `src/hooks/useJohariReport.ts`
- `src/components/johari/`

### 10.6. Планы развития

1. На основании gap-анализа HR/employee создаёт `development_plans`
2. Добавляет задачи (`development_plan_tasks`) привязанные к skills/qualities
3. Задачи могут быть сгенерированы AI через edge function `generate-development-tasks`

### 10.7. Импорт данных

- `import-diagnostics-data` — массовый импорт результатов диагностики
- `import-grades-data` — импорт структуры грейдов

---

## 11. Асинхронщина и фоновые процессы

### pg_cron задачи

| Задача | Расписание | Функция | Назначение |
|---|---|---|---|
| `finalize-expired-stages` | Настраивается вручную | `finalize_expired_stage()` | Завершение stage-based встреч при закрытии этапа |
| `process-meeting-status` | `*/15 * * * *` | `process_meeting_status()` | Перевод встреч в `awaiting_summary` если дата прошла и итогов нет |
| `process-meeting-tasks` | `*/15 * * * *` | `process_meeting_tasks()` | Генерация задач `meeting_fill_summary` и `meeting_plan_new` для руководителей |

**Как настроен:** SQL в `migrations/20260219_meetings_decoupling_cron.sql` (закомментирован, выполняется вручную через SQL Editor).

### Ретраи / Идемпотентность

Не реализованы на уровне приложения. Edge functions не имеют механизма retry. pg_cron задачи идемпотентны по природе (UPDATE WHERE условие).

### Мониторинг

Мониторинг фоновых задач — через Supabase Dashboard (логи pg_cron). Нет алертов или дашбордов.

---

## 12. Наблюдаемость

### Логирование

| Компонент | Что логируется | Где |
|---|---|---|
| Edge Functions | `console.log/error` в каждой функции | Supabase Edge Function Logs |
| Admin actions | Действия через `AdminLogger` → `admin_activity_logs` | БД |
| Access denied | Отказы → `access_denied_logs` | БД |
| Audit log | Изменения пользователей → `audit_log` | БД |
| Frontend | `console.error` в catch-блоках | Browser console |

### Что НЕ логируется

- Успешные операции пользователей (кроме admin actions)
- Производительность запросов
- Метрики использования

### Что нельзя логировать

Не найдено явных ограничений в коде. PII (ФИО, email) логируется в edge functions (`console.log("Email:", email)`).

---

## 13. Тестирование

### Unit/Integration/E2E тесты

**Не найдено** тестовых файлов в репозитории. Нет `*.test.ts`, `*.spec.ts`, `__tests__/` директорий.

### Как проверить

Ручное тестирование через UI preview в Lovable.

---

## 14. Деплой и инфраструктура

### CI/CD

Деплой через **Lovable Cloud**. Нет CI/CD пайплайнов (GitHub Actions, etc.) — не найдено в репозитории.

### Окружения

| Окружение | Назначение |
|---|---|
| Test (Preview) | Разработка и тестирование |
| Live (Published) | https://milu.lovable.app |

### Миграции на деплое

Миграции применяются автоматически при публикации через Lovable Cloud. Ручные миграции (pg_cron, DML) выполняются через Supabase SQL Editor.

### Rollback

Нет формализованного процесса rollback. Revert через историю изменений в Lovable.

---

## 15. Диагностика и troubleshooting

### Частые классы ошибок

| Класс | Симптом | Где смотреть |
|---|---|---|
| Auth (401/403) | "Требуется авторизация" | Browser console, edge function logs |
| RLS policy denied | `new row violates row-level security policy` | Browser console (Supabase error) |
| Permission denied | `has_permission` возвращает false | `access_denied_logs` таблица |
| Type mismatch | `(supabase.rpc as any)` — неактуальные типы | `src/types/supabase-rpc.ts` vs `types.ts` |
| Infinite recursion in RLS | Stack overflow в RLS policies | Postgres logs (Supabase Analytics) |

### Read-only запросы для проверки состояния

```sql
-- Проверить роль пользователя
SELECT ur.role, u.email FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.email = 'xxx@xxx.com';

-- Проверить permissions пользователя
SELECT * FROM user_effective_permissions WHERE user_id = '<uuid>';

-- Проверить встречи (новая статусная модель)
SELECT id, employee_id, manager_id, status, meeting_date, meeting_summary IS NOT NULL as has_summary FROM one_on_one_meetings ORDER BY meeting_date DESC LIMIT 20;

-- Проверить активные этапы
SELECT ds.id, ds.status, ps.period, ps.is_active FROM diagnostic_stages ds LEFT JOIN parent_stages ps ON ds.parent_id = ps.id WHERE ps.is_active = true;

-- Проверить задачи пользователя
SELECT id, title, status, task_type, deadline FROM tasks WHERE user_id = '<uuid>' AND status IN ('pending', 'in_progress');

-- Консистентность данных диагностики
SELECT * FROM check_diagnostic_data_consistency();

-- Консистентность данных встреч
SELECT * FROM check_meetings_data_consistency();

-- Последние отказы в доступе
SELECT * FROM access_denied_logs ORDER BY created_at DESC LIMIT 20;
```

---

## 16. Риски и техдолг

### Критические

1. **`employee_stage_snapshots` — RLS отключён.** Таблица с чувствительными данными оценки доступна через anon key. **Где:** schema, отсутствие RLS policies.

2. **`encrypt_user_data_trigger` — отправка PII на внешний endpoint.** Триггер на таблице `users` передаёт персональные данные на `https://functions.yandexcloud.net/...` без аутентификации. **Где:** PostgreSQL trigger definition.

3. **`types.ts` расходится с фактической схемой БД.** Функция `has_permission` в types.ts требует `_user_id`, но фактически принимает только `_permission_name`. Используется `as any` cast. **Где:** `src/hooks/usePermission.ts:26`.

4. **CORS `*` во всех Edge Functions.** Позволяет вызывать функции с любого домена. **Где:** Все файлы `supabase/functions/*/index.ts`.

5. **`generate-johari-report` — `verify_jwt = false`.** Функция доступна без аутентификации (предполагается ручная проверка JWT внутри). **Где:** `supabase/config.toml:28`.

### Средние

6. **Нет тестов.** Ни unit, ни integration, ни e2e. Регрессии обнаруживаются только вручную.

7. **N+1 запросы в `useTasks`.** Для каждой задачи выполняется отдельный запрос к `survey_360_assignments`, затем к `users`, затем к `hard_skill_results`. **Где:** `src/hooks/useTasks.ts:92-208`.

8. **Отсутствие Zod-валидации в Edge Functions.** Request body парсится без schema validation. **Где:** Все edge functions.

9. **Две системы логирования админ-действий:** `audit_log` и `admin_activity_logs`. Нет единой точки входа. **Где:** `src/lib/adminLogger.ts` (activity_logs), edge functions (audit_log через RPC).

10. **Feature flag `VITE_MEETINGS_STAGE_UI_ENABLED` — build-time.** Не runtime toggle. Разные среды могут иметь разное значение если `.env` не синхронизирован. **Где:** `.env`.

### Низкие

11. **`manufacturers`, `trade_points`, `user_trade_points` — legacy-таблицы.** Не используются в текущем UI. Занимают место в схеме.

12. **`decryptUserData` — noop-функция.** Шифрование удалено, функция оставлена для совместимости. **Где:** `src/lib/userDataDecryption.ts`.

13. **pg_cron SQL закомментирован.** Задачи `process_meeting_status` и `process_meeting_tasks` требуют ручной настройки. **Где:** миграции pg_cron.

---

## 17. QA Checklist

### Аутентификация (4)

- [ ] 1. Вход с валидным email/паролем → редирект на `/`
- [ ] 2. Вход с неверным паролем → toast "неверный Email или Пароль"
- [ ] 3. Cookie consent — блокирует кнопку "Войти" до принятия
- [ ] 4. Выход → редирект на `/auth`, сессия удалена

### Права доступа (5)

- [ ] 5. Employee не видит пункт "Справочники" в sidebar
- [ ] 6. Employee не может создать пользователя (403 от edge function)
- [ ] 7. Manager видит "Встречи подчиненных" на странице встреч
- [ ] 8. Admin видит все пункты меню
- [ ] 9. HR может создавать/редактировать справочники

### Диагностика (5)

- [ ] 10. Создание подэтапа диагностики с участниками → появляются задачи у участников
- [ ] 11. Peer selection → задачи на утверждение у руководителя
- [ ] 12. Заполнение формы 360° → результаты сохраняются в `soft_skill_results`
- [ ] 13. Завершение оценки → задача помечается completed
- [ ] 14. Закрытие этапа → snapshot в `employee_stage_snapshots`

### Встречи one-to-one (8)

- [ ] 15. Создание встречи сотрудником → задача `meeting_scheduled` для обоих участников
- [ ] 16. Создание встречи руководителем для подчинённого → выбор из списка
- [ ] 17. Статус автоматически `scheduled` при будущей дате, `awaiting_summary` при прошедшей
- [ ] 18. Заполнение блока сотрудника и блока руководителя (раздельные поля)
- [ ] 19. Сохранение итогов → статус `recorded`, задача `meeting_review_summary` второй стороне
- [ ] 20. Мониторинг встреч: KPI дашборд (в норме, просрочено, не участвует в цикле)
- [ ] 21. Историчность: текущий руководитель видит всю историю подчинённого
- [ ] 22. Вложения: загрузка/скачивание файлов к встрече (до 10 шт)

### Карьерный трек (3)

- [ ] 22. Gap-анализ показывает разницу между текущим уровнем и target
- [ ] 23. Карьерный трек виден только при gradeLevel > 0 (для employee)
- [ ] 24. HR/Manager видят карьерный трек всегда

### Создание пользователя (3)

- [ ] 25. Создание с валидными данными → пользователь появляется в списке
- [ ] 26. Дубликат email → ошибка "уже существует"
- [ ] 27. Пароль < 8 символов → ошибка валидации

### Деградация (3)

- [ ] 28. Потеря соединения при заполнении формы → данные не теряются (автосохранение в meetings)
- [ ] 29. Expired JWT → автоматический refresh (autoRefreshToken: true)
- [ ] 30. RLS deny на INSERT → корректное сообщение об ошибке в toast

---

## Вопросы (0)

Все критичные разделы покрыты на основании данных из репозитория и БД. Дополнительных вопросов нет.
