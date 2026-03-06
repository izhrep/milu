# Полная документация схемы базы данных

**Дата создания:** 13 ноября 2025  
**Версия:** 1.0  
**Статус:** Актуально после очистки неиспользуемых таблиц

---

## 📑 Оглавление

1. [Сводная таблица всех таблиц](#сводная-таблица-всех-таблиц)
2. [Модули и группы таблиц](#модули-и-группы-таблиц)
3. [Детальное описание таблиц](#детальное-описание-таблиц)
4. [Связи между таблицами](#связи-между-таблицами)
5. [Типы данных](#типы-данных)
6. [Индексы и производительность](#индексы-и-производительность)
7. [RLS политики](#rls-политики)

---

## 🗂️ Сводная таблица всех таблиц

| № | Таблица | Модуль | Записей | Описание |
|---|---------|--------|---------|----------|
| 1 | `users` | Пользователи | ~100 | Основная таблица пользователей |
| 2 | `user_profiles` | Пользователи | ~100 | Дополнительная информация профилей |
| 3 | `user_roles` | Безопасность | ~100 | Роли пользователей |
| 4 | `auth_users` | Безопасность | ~100 | Учетные данные для входа |
| 5 | `admin_sessions` | Безопасность | ~50 | Активные сессии администраторов |
| 6 | `admin_activity_logs` | Безопасность | ~500 | Журнал действий администраторов |
| 7 | `audit_log` | Безопасность | ~1000 | Журнал аудита изменений |
| 8 | `permissions` | Безопасность | ~50 | Справочник прав доступа |
| 9 | `role_permissions` | Безопасность | ~200 | Связь ролей и прав |
| 10 | `departments` | Справочники | ~10 | Подразделения компании |
| 11 | `positions` | Справочники | ~50 | Должности |
| 12 | `position_categories` | Справочники | ~10 | Категории должностей |
| 13 | `grades` | Карьера | ~30 | Грейды (уровни должностей) |
| 14 | `grade_skills` | Карьера | ~200 | Требования по навыкам для грейдов |
| 15 | `grade_qualities` | Карьера | ~200 | Требования по качествам для грейдов |
| 16 | `certifications` | Карьера | ~20 | Сертификаты для повышения |
| 17 | `skills` | Компетенции | ~100 | Справочник навыков (hard skills) |
| 18 | `category_skills` | Компетенции | ~10 | Категории навыков |
| 19 | `qualities` | Компетенции | ~50 | Справочник качеств (soft skills) |
| 20 | `competency_levels` | Компетенции | ~5 | Уровни владения компетенциями (1-5) |
| 21 | `user_skills` | Компетенции | ~500 | Навыки пользователей |
| 22 | `user_qualities` | Компетенции | ~500 | Качества пользователей |
| 23 | `hard_skill_questions` | Диагностика | ~50 | Вопросы по навыкам |
| 24 | `hard_skill_answer_options` | Диагностика | ~5 | Варианты ответов (1-5) |
| 25 | `hard_skill_results` | Диагностика | ~5000 | Результаты оценки навыков |
| 26 | `soft_skill_questions` | Диагностика | ~50 | Вопросы опроса 360 |
| 27 | `soft_skill_answer_options` | Диагностика | ~5 | Варианты ответов 360 |
| 28 | `soft_skill_results` | Диагностика | ~5000 | Результаты опроса 360 |
| 29 | `diagnostic_stages` | Диагностика | ~10 | Этапы диагностики |
| 30 | `diagnostic_stage_participants` | Диагностика | ~1000 | Участники этапов |
| 31 | `survey_360_assignments` | Диагностика | ~2000 | Назначения оценки 360 |
| 32 | `user_assessment_results` | Диагностика | ~10000 | Агрегированные результаты оценки |
| 33 | `career_tracks` | Карьера | ~20 | Карьерные треки |
| 34 | `career_track_steps` | Карьера | ~100 | Шаги карьерных треков |
| 35 | `track_types` | Карьера | ~3 | Типы карьерных треков |
| 36 | `user_career_progress` | Карьера | ~50 | Прогресс по карьерным трекам |
| 37 | `development_plans` | Развитие | ~50 | Планы развития |
| 38 | `development_tasks` | Развитие | ~200 | Библиотека задач развития |
| 39 | `tasks` | Задачи | ~1000 | Универсальная таблица задач |
| 40 | `meeting_stages` | Встречи 1:1 | ~10 | Этапы встреч |
| 41 | `meeting_stage_participants` | Встречи 1:1 | ~500 | Участники этапов встреч |
| 42 | `one_on_one_meetings` | Встречи 1:1 | ~500 | Встречи 1:1 |
| 43 | `meeting_decisions` | Встречи 1:1 | ~1000 | Решения встреч |
| 44 | `trade_points` | Справочники | ~6 | Торговые точки |
| 45 | `manufacturers` | Справочники | ~5 | Производители |

**Всего таблиц:** 45  
**Удалено неиспользуемых:** 2 (`survey_assignments`, `user_achievements`)

---

## 📦 Модули и группы таблиц

### 1. Модуль "Пользователи и безопасность"

**Таблицы:**
- `users` - основная таблица пользователей
- `user_profiles` - расширенные профили
- `user_roles` - роли пользователей
- `auth_users` - аутентификация
- `admin_sessions` - сессии
- `admin_activity_logs` - логи администратора
- `audit_log` - общий журнал аудита
- `permissions` - права доступа
- `role_permissions` - связь ролей и прав

**Ключевые поля связи:**
- `users.id` → основной идентификатор пользователя
- `user_roles.user_id` → связь с пользователями
- `user_roles.role` → тип роли (admin, hr_bp, manager, employee)

---

### 2. Модуль "Справочники структуры"

**Таблицы:**
- `departments` - подразделения
- `positions` - должности
- `position_categories` - категории должностей
- `trade_points` - торговые точки
- `manufacturers` - производители

**Связи:**
- `positions.position_category_id` → `position_categories.id`
- `users.department_id` → `departments.id`
- `users.position_id` → `positions.id`

---

### 3. Модуль "Компетенции"

**Таблицы:**
- `skills` - навыки (hard skills)
- `category_skills` - категории навыков
- `qualities` - качества (soft skills)
- `competency_levels` - уровни владения (1-5)
- `user_skills` - навыки пользователей
- `user_qualities` - качества пользователей

**Триггеры автообновления:**
- `user_skills` обновляется из `hard_skill_results` через триггер `update_user_skills_from_survey()`
- `user_qualities` обновляется из `soft_skill_results` через триггер `update_user_qualities_from_survey()`

**Связи:**
- `skills.category_id` → `category_skills.id`
- `user_skills.skill_id` → `skills.id`
- `user_qualities.quality_id` → `qualities.id`

---

### 4. Модуль "Диагностика компетенций"

**Таблицы:**
- `diagnostic_stages` - этапы диагностики (H1 2025, H2 2025)
- `diagnostic_stage_participants` - участники этапов
- `hard_skill_questions` - вопросы по навыкам
- `hard_skill_answer_options` - варианты ответов (1-5)
- `hard_skill_results` - результаты оценки навыков
- `soft_skill_questions` - вопросы опроса 360
- `soft_skill_answer_options` - варианты ответов 360
- `soft_skill_results` - результаты опроса 360
- `survey_360_assignments` - назначения оценки 360
- `user_assessment_results` - агрегированные результаты

**Ключевые триггеры:**
1. `assign_surveys_to_diagnostic_participant()` - создает автоназначения при добавлении участника
2. `aggregate_hard_skill_results()` - агрегирует результаты в `user_assessment_results`
3. `aggregate_soft_skill_results()` - агрегирует результаты опроса 360

**Связи:**
- `hard_skill_questions.skill_id` → `skills.id`
- `soft_skill_questions.quality_id` → `qualities.id`
- `hard_skill_results.diagnostic_stage_id` → `diagnostic_stages.id`
- `survey_360_assignments.diagnostic_stage_id` → `diagnostic_stages.id`

---

### 5. Модуль "Карьерное развитие"

**Таблицы:**
- `grades` - грейды (уровни должностей)
- `grade_skills` - требования по навыкам для грейдов
- `grade_qualities` - требования по качествам для грейдов
- `certifications` - сертификаты
- `career_tracks` - карьерные треки
- `career_track_steps` - шаги карьерных треков
- `track_types` - типы треков (управленческий, экспертный, горизонтальный)
- `user_career_progress` - прогресс пользователей по трекам

**Функции:**
- `calculate_career_gap(user_id, grade_id)` - расчет gap-анализа
- `recommend_career_tracks(user_id)` - рекомендации треков

**Связи:**
- `grades.position_id` → `positions.id`
- `grades.certification_id` → `certifications.id`
- `career_tracks.target_position_id` → `positions.id`
- `career_track_steps.career_track_id` → `career_tracks.id`
- `career_track_steps.grade_id` → `grades.id`

---

### 6. Модуль "Развитие и задачи"

**Таблицы:**
- `development_plans` - планы развития
- `development_tasks` - библиотека задач развития
- `tasks` - универсальная таблица задач

**Типы задач в таблице `tasks`:**
- `assessment` - диагностика
- `diagnostic_stage` - этап диагностики
- `survey_360_evaluation` - оценка 360
- `skill_survey` - опрос навыков
- `meeting` - встреча 1:1
- `development` - задача развития

**Связи:**
- `tasks.user_id` → `users.id`
- `tasks.diagnostic_stage_id` → `diagnostic_stages.id`
- `tasks.assignment_id` → `survey_360_assignments.id`

---

### 7. Модуль "Встречи 1:1"

**Таблицы:**
- `meeting_stages` - этапы встреч (Q1 2025, Q2 2025)
- `meeting_stage_participants` - участники этапов
- `one_on_one_meetings` - встречи 1:1
- `meeting_decisions` - решения встреч

**Триггеры:**
- `create_meeting_for_participant()` - создает встречу при добавлении участника
- `create_meeting_task_for_participant()` - создает задачу встречи
- `update_meeting_task_status()` - обновляет статус задачи при утверждении

**Связи:**
- `one_on_one_meetings.employee_id` → `users.id`
- `one_on_one_meetings.manager_id` → `users.id`
- `meeting_decisions.meeting_id` → `one_on_one_meetings.id`

---

## 📋 Детальное описание таблиц

### 1. `users` - Пользователи системы

**Описание:** Основная таблица пользователей с базовой информацией.

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|--------------|--------------|----------|
| `id` | uuid | Да | gen_random_uuid() | Уникальный идентификатор |
| `employee_number` | text | Да | - | Табельный номер |
| `last_name` | text | Да | - | Фамилия |
| `first_name` | text | Да | - | Имя |
| `middle_name` | text | Нет | - | Отчество |
| `email` | text | Да | - | Email (уникальный) |
| `position_id` | uuid | Нет | - | Должность → `positions.id` |
| `department_id` | uuid | Нет | - | Подразделение → `departments.id` |
| `manager_id` | uuid | Нет | - | Руководитель → `users.id` |
| `hr_bp_id` | uuid | Нет | - | HR BP → `users.id` |
| `grade_id` | uuid | Нет | - | Грейд → `grades.id` |
| `start_date` | date | Нет | - | Дата начала работы |
| `status` | boolean | Да | true | Статус активности |
| `last_login_at` | timestamp | Нет | - | Последний вход |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Индексы:**
- PRIMARY KEY на `id`
- UNIQUE на `email`
- INDEX на `position_id`, `department_id`, `manager_id`, `grade_id`

**RLS политики:**
- Пользователи видят свои данные
- Менеджеры видят данные своих подчиненных
- HR BP видят всех пользователей
- Администраторы имеют полный доступ

---

### 2. `user_profiles` - Расширенные профили

**Описание:** Дополнительная информация о пользователях.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID пользователя |
| `user_id` | uuid | Да | Связь с `users.id` |
| `phone` | text | Нет | Телефон |
| `birth_date` | date | Нет | Дата рождения |
| `avatar_url` | text | Нет | URL аватара |
| `bio` | text | Нет | О себе |
| `work_address` | text | Нет | Рабочий адрес |
| `store_number` | text | Нет | Номер магазина |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Да | Дата обновления |

---

### 3. `user_roles` - Роли пользователей

**Описание:** Назначение ролей пользователям.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID записи |
| `user_id` | uuid | Да | Пользователь → `users.id` |
| `role` | app_role | Да | Роль (admin, hr_bp, manager, employee) |
| `created_at` | timestamp | Да | Дата назначения |

**Уникальность:** (`user_id`, `role`)

**Enum `app_role`:**
- `admin` - Администратор
- `hr_bp` - HR BP
- `manager` - Руководитель
- `employee` - Сотрудник

---

### 4. `auth_users` - Аутентификация

**Описание:** Учетные данные для входа в систему.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID пользователя |
| `email` | text | Да | Email (уникальный) |
| `password_hash` | text | Да | Хеш пароля |
| `is_active` | boolean | Да | Активность аккаунта |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Да | Дата обновления |

**Безопасность:** Только администраторы могут просматривать эту таблицу.

---

### 5. `diagnostic_stages` - Этапы диагностики

**Описание:** Периоды проведения диагностики компетенций.

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|--------------|--------------|----------|
| `id` | uuid | Да | gen_random_uuid() | ID этапа |
| `period` | text | Да | - | Название периода (например, "H1 2025") |
| `start_date` | date | Да | - | Дата начала |
| `end_date` | date | Да | - | Дата окончания |
| `deadline_date` | date | Да | - | Крайний срок заполнения |
| `is_active` | boolean | Да | true | Активность этапа |
| `status` | text | Да | 'setup' | Статус: setup, assessment, completed |
| `progress_percent` | numeric | Нет | 0 | Процент завершения (0-100) |
| `evaluation_period` | text | Нет | - | Период оценки (H1_2025, H2_2025) |
| `created_by` | uuid | Да | get_current_session_user() | Создатель |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Функции:**
- `calculate_diagnostic_stage_progress(stage_id)` - автоматический расчет прогресса

---

### 6. `hard_skill_results` - Результаты оценки навыков

**Описание:** Ответы на вопросы по навыкам (hard skills).

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID результата |
| `evaluated_user_id` | uuid | Да | Оцениваемый → `users.id` |
| `evaluating_user_id` | uuid | Нет | Оценивающий → `users.id` |
| `diagnostic_stage_id` | uuid | Нет | Этап → `diagnostic_stages.id` |
| `question_id` | uuid | Да | Вопрос → `hard_skill_questions.id` |
| `answer_option_id` | uuid | Да | Ответ → `hard_skill_answer_options.id` |
| `assignment_id` | uuid | Нет | Назначение → `survey_360_assignments.id` |
| `is_draft` | boolean | Да | true | Черновик или финал |
| `comment` | text | Нет | - | Комментарий |
| `evaluation_period` | text | Нет | - | Период оценки |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Триггеры:**
- `update_user_skills_from_survey()` - обновляет `user_skills` при is_draft=false
- `aggregate_hard_skill_results()` - агрегирует в `user_assessment_results`

---

### 7. `soft_skill_results` - Результаты опроса 360

**Описание:** Ответы на вопросы опроса 360 (soft skills).

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID результата |
| `evaluated_user_id` | uuid | Да | Оцениваемый → `users.id` |
| `evaluating_user_id` | uuid | Да | Оценивающий → `users.id` |
| `diagnostic_stage_id` | uuid | Нет | Этап → `diagnostic_stages.id` |
| `question_id` | uuid | Да | Вопрос → `soft_skill_questions.id` |
| `answer_option_id` | uuid | Да | Ответ → `soft_skill_answer_options.id` |
| `assignment_id` | uuid | Нет | Назначение → `survey_360_assignments.id` |
| `is_draft` | boolean | Да | true | Черновик или финал |
| `comment` | text | Нет | - | Комментарий |
| `is_anonymous_comment` | boolean | Да | false | Анонимный комментарий |
| `evaluation_period` | text | Нет | - | Период оценки |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Триггеры:**
- `update_user_qualities_from_survey()` - обновляет `user_qualities`
- `aggregate_soft_skill_results()` - агрегирует в `user_assessment_results`

---

### 8. `user_assessment_results` - Агрегированные результаты

**Описание:** Сводная таблица с агрегированными результатами оценки.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID записи |
| `user_id` | uuid | Да | Пользователь → `users.id` |
| `diagnostic_stage_id` | uuid | Да | Этап → `diagnostic_stages.id` |
| `skill_id` | uuid | Нет | Навык → `skills.id` |
| `quality_id` | uuid | Нет | Качество → `qualities.id` |
| `self_assessment` | numeric | Нет | Самооценка (среднее) |
| `manager_assessment` | numeric | Нет | Оценка руководителя |
| `peers_average` | numeric | Нет | Средняя оценка коллег |
| `total_responses` | integer | Да | 0 | Количество ответов |
| `assessment_period` | text | Нет | - | Период оценки |
| `assessment_date` | timestamp | Нет | - | Дата оценки |
| `created_at` | timestamp | Да | now() | Дата создания |

**Назначение:** Используется для отчетов, gap-анализа, рекомендаций треков.

---

### 9. `career_tracks` - Карьерные треки

**Описание:** Карьерные траектории для развития сотрудников.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID трека |
| `name` | text | Да | Название трека |
| `description` | text | Нет | Описание |
| `track_type_id` | uuid | Нет | Тип трека → `track_types.id` |
| `target_position_id` | uuid | Нет | Целевая должность → `positions.id` |
| `duration_months` | integer | Нет | Длительность в месяцах |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Связь с шагами:**
- Каждый трек содержит несколько шагов (`career_track_steps`)
- Каждый шаг привязан к грейду и имеет порядковый номер

---

### 10. `career_track_steps` - Шаги карьерного трека

**Описание:** Последовательность грейдов в карьерном треке.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | uuid | Да | ID шага |
| `career_track_id` | uuid | Да | Трек → `career_tracks.id` |
| `grade_id` | uuid | Да | Грейд → `grades.id` |
| `step_order` | integer | Да | Порядковый номер (>= 1) |
| `description` | text | Нет | Описание шага |
| `duration_months` | integer | Нет | Длительность шага |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Constraint:** `step_order >= 1`

---

### 11. `tasks` - Универсальная таблица задач

**Описание:** Все задачи пользователей (диагностика, встречи, развитие).

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|--------------|--------------|----------|
| `id` | uuid | Да | gen_random_uuid() | ID задачи |
| `user_id` | uuid | Да | - | Пользователь → `users.id` |
| `title` | text | Да | - | Название задачи |
| `description` | text | Нет | - | Описание |
| `status` | text | Да | 'pending' | Статус: pending, in_progress, completed |
| `priority` | text | Нет | 'normal' | Приоритет: low, normal, high |
| `category` | text | Нет | 'assessment' | Категория задачи |
| `task_type` | text | Нет | 'assessment' | Тип задачи |
| `assignment_type` | text | Нет | - | Тип назначения: self, manager, peer |
| `assignment_id` | uuid | Нет | - | Назначение → `survey_360_assignments.id` |
| `diagnostic_stage_id` | uuid | Нет | - | Этап → `diagnostic_stages.id` |
| `competency_ref` | uuid | Нет | - | Ссылка на компетенцию |
| `kpi_expected_level` | integer | Нет | - | Ожидаемый уровень KPI |
| `kpi_result_level` | integer | Нет | - | Фактический уровень KPI |
| `deadline` | date | Нет | - | Крайний срок |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Типы задач:**
- `diagnostic_stage` - участие в диагностике
- `survey_360_evaluation` - оценка 360 для коллеги
- `skill_survey` - опрос навыков
- `meeting` - встреча 1:1
- `development` - задача развития
- `assessment` - общая оценка

---

### 12. `one_on_one_meetings` - Встречи 1:1

**Описание:** Встречи сотрудника с руководителем.

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|--------------|--------------|----------|
| `id` | uuid | Да | gen_random_uuid() | ID встречи |
| `stage_id` | uuid | Да | - | Этап → `meeting_stages.id` |
| `employee_id` | uuid | Да | - | Сотрудник → `users.id` |
| `manager_id` | uuid | Да | - | Руководитель → `users.id` |
| `meeting_date` | timestamp | Нет | - | Дата проведения |
| `status` | text | Да | 'draft' | Статус: draft, submitted, approved, returned |
| `goal_and_agenda` | text | Нет | - | Цель и повестка |
| `energy_gained` | text | Нет | - | Что придало энергии |
| `energy_lost` | text | Нет | - | Что забрало энергию |
| `stoppers` | text | Нет | - | Стопперы |
| `previous_decisions_debrief` | text | Нет | - | Разбор предыдущих решений |
| `manager_comment` | text | Нет | - | Комментарий руководителя |
| `return_reason` | text | Нет | - | Причина возврата |
| `submitted_at` | timestamp | Нет | - | Дата отправки |
| `approved_at` | timestamp | Нет | - | Дата утверждения |
| `returned_at` | timestamp | Нет | - | Дата возврата |
| `created_at` | timestamp | Да | now() | Дата создания |
| `updated_at` | timestamp | Да | now() | Дата обновления |

**Триггер:** `update_meeting_task_status()` - обновляет задачу при изменении статуса.

---

## 🔗 Связи между таблицами

### Основные связи пользователей

```
users (id)
  ├── user_profiles (user_id) - 1:1
  ├── user_roles (user_id) - 1:N
  ├── user_skills (user_id) - 1:N
  ├── user_qualities (user_id) - 1:N
  ├── user_career_progress (user_id) - 1:N
  ├── tasks (user_id) - 1:N
  ├── one_on_one_meetings (employee_id) - 1:N
  ├── one_on_one_meetings (manager_id) - 1:N
  ├── hard_skill_results (evaluated_user_id) - 1:N
  └── soft_skill_results (evaluated_user_id) - 1:N
```

### Иерархия должностей и грейдов

```
position_categories (id)
  └── positions (position_category_id)
        └── users (position_id)
              └── grades (position_id)
                    ├── grade_skills (grade_id)
                    │     └── skills (id)
                    └── grade_qualities (grade_id)
                          └── qualities (id)
```

### Карьерные треки

```
career_tracks (id)
  ├── target_position_id → positions (id)
  ├── track_type_id → track_types (id)
  └── career_track_steps (career_track_id)
        └── grade_id → grades (id)
              ├── grade_skills → skills
              └── grade_qualities → qualities
```

### Диагностика

```
diagnostic_stages (id)
  └── diagnostic_stage_participants (stage_id)
        └── user_id → users (id)
              ├── survey_360_assignments (evaluated_user_id)
              │     ├── hard_skill_results (assignment_id)
              │     └── soft_skill_results (assignment_id)
              └── user_assessment_results (user_id)
```

### Встречи 1:1

```
meeting_stages (id)
  └── meeting_stage_participants (stage_id)
        └── user_id → users (id)
              └── one_on_one_meetings (employee_id, stage_id)
                    └── meeting_decisions (meeting_id)
```

---

## 🎯 Типы данных

### UUID
- Используется для всех первичных ключей
- Генерируется через `gen_random_uuid()`

### TEXT
- Строковые поля без ограничения длины
- Email, имена, описания, комментарии

### TIMESTAMP WITH TIME ZONE
- Все даты и времена с учетом часового пояса
- `created_at`, `updated_at`, `submitted_at` и т.д.

### DATE
- Даты без времени
- `start_date`, `end_date`, `deadline`

### NUMERIC
- Числовые значения с точностью
- Оценки, уровни, зарплаты

### INTEGER
- Целые числа
- Порядковые номера, счетчики

### BOOLEAN
- Логические значения
- Статусы активности, флаги

### JSONB
- JSON данные с индексацией
- `details` в логах, метаданные

### ENUM (app_role)
- Перечисление ролей
- `admin`, `hr_bp`, `manager`, `employee`

---

## ⚡ Индексы и производительность

### Автоматические индексы

**PRIMARY KEY:**
- Каждая таблица имеет `id` как PRIMARY KEY
- Автоматический индекс по `id`

**FOREIGN KEY:**
- Все внешние ключи имеют индексы
- Например: `users.position_id`, `users.manager_id`

**UNIQUE:**
- `users.email` - уникальный индекс
- `auth_users.email` - уникальный индекс
- `(user_id, role)` в `user_roles`

### Добавленные индексы

**Диагностика:**
```sql
CREATE INDEX idx_diagnostic_stages_active ON diagnostic_stages(is_active, status);
CREATE INDEX idx_diagnostic_participants_stage ON diagnostic_stage_participants(stage_id, user_id);
CREATE INDEX idx_hard_results_user_stage ON hard_skill_results(evaluated_user_id, diagnostic_stage_id);
CREATE INDEX idx_soft_results_user_stage ON soft_skill_results(evaluated_user_id, diagnostic_stage_id);
CREATE INDEX idx_survey_assignments_stage ON survey_360_assignments(diagnostic_stage_id, evaluated_user_id);
CREATE INDEX idx_user_assessment_stage ON user_assessment_results(user_id, diagnostic_stage_id);
```

**Встречи 1:1:**
```sql
CREATE INDEX idx_meeting_stages_active ON meeting_stages(is_active);
CREATE INDEX idx_meeting_participants_stage ON meeting_stage_participants(stage_id, user_id);
CREATE INDEX idx_meetings_employee ON one_on_one_meetings(employee_id, stage_id);
CREATE INDEX idx_meetings_manager ON one_on_one_meetings(manager_id, stage_id);
CREATE INDEX idx_meeting_decisions_meeting ON meeting_decisions(meeting_id);
```

**Карьера:**
```sql
CREATE INDEX idx_grades_position ON grades(position_id, level);
CREATE INDEX idx_career_tracks_position ON career_tracks(target_position_id, track_type_id);
CREATE INDEX idx_career_steps_track ON career_track_steps(career_track_id, step_order);
CREATE INDEX idx_user_career_progress_user ON user_career_progress(user_id, status);
CREATE INDEX idx_development_tasks_skill ON development_tasks(skill_id, competency_level_id);
CREATE INDEX idx_development_tasks_quality ON development_tasks(quality_id, competency_level_id);
```

**Задачи:**
```sql
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_diagnostic_stage ON tasks(diagnostic_stage_id, user_id);
CREATE INDEX idx_tasks_assignment ON tasks(assignment_id);
```

---

## 🔒 RLS политики

### Общие принципы

1. **Самостоятельный доступ:** Пользователь видит свои данные
2. **Иерархия:** Руководитель видит данные подчиненных
3. **Роль HR BP:** Видит всех пользователей
4. **Администратор:** Полный доступ ко всем данным

### Функции безопасности

```sql
-- Получить текущего пользователя
get_current_session_user() RETURNS uuid

-- Проверить роль пользователя
has_role(user_id uuid, role app_role) RETURNS boolean

-- Проверить, является ли текущий пользователь администратором
is_current_user_admin() RETURNS boolean

-- Проверить, является ли текущий пользователь HR
is_current_user_hr() RETURNS boolean

-- Проверить, является ли пользователь руководителем другого пользователя
is_manager_of_user(target_user_id uuid) RETURNS boolean
```

### Примеры RLS политик

**Таблица `users`:**
```sql
-- Пользователи видят свой профиль
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (id = get_current_session_user());

-- Менеджеры видят своих подчинённых
CREATE POLICY "Managers can view their team"
ON users FOR SELECT
USING (manager_id = get_current_session_user());

-- HR и Администраторы видят всех
CREATE POLICY "HR and Admins can view all users"
ON users FOR SELECT
USING (is_current_user_hr() OR is_current_user_admin());
```

**Таблица `hard_skill_results`:**
```sql
-- Пользователи видят результаты, где они оцениваемые или оценивающие
CREATE POLICY "Users can view hard_skill_results"
ON hard_skill_results FOR SELECT
USING (
  evaluated_user_id = get_current_session_user() OR
  evaluating_user_id = get_current_session_user() OR
  is_current_user_admin() OR
  is_manager_of_user(evaluated_user_id)
);
```

---

## 📊 Сводная статистика

**Общая статистика:**
- Всего таблиц: 45
- Справочных таблиц: 12
- Транзакционных таблиц: 33
- Таблиц с триггерами: 15
- Функций безопасности: 6
- RLS политик: ~150

**Индексы:**
- PRIMARY KEY индексов: 45
- FOREIGN KEY индексов: ~80
- UNIQUE индексов: ~15
- Специальных индексов: ~30

**Триггеры:**
- Обновление `updated_at`: 25+ таблиц
- Агрегация результатов: 2
- Автосоздание задач: 5
- Автосоздание назначений: 3

---

## 🎓 Рекомендации по работе с БД

### Оптимизация запросов

1. **Используйте индексы:**
   - Всегда фильтруйте по `user_id`, `diagnostic_stage_id`
   - Используйте `status` для активных записей

2. **Избегайте N+1 проблем:**
   - Используйте JOIN вместо множественных запросов
   - Используйте `select('*, foreign_table(*)')`

3. **Пагинация:**
   - Всегда используйте `limit` и `offset` для больших таблиц
   - Оптимально: 50-100 записей на страницу

### Безопасность

1. **Всегда проверяйте RLS:**
   - Убедитесь, что RLS включен для всех таблиц
   - Тестируйте доступ для разных ролей

2. **Используйте функции безопасности:**
   - `is_current_user_admin()` вместо прямой проверки роли
   - `is_manager_of_user()` для иерархических проверок

3. **Логирование:**
   - Все изменения администратора логируются в `audit_log`
   - Критические действия требуют двойной проверки

---

**Документация актуальна на:** 13 ноября 2025  
**Версия схемы БД:** 1.0 (после очистки неиспользуемых таблиц)
