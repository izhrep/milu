# Глоссарий терминов системы управления компетенциями

## Основные сущности

### Пользователи и организационная структура

**User (Пользователь)**
- Таблица: `users`
- Описание: Сотрудник организации
- Ключевые поля:
  - `id` (UUID): уникальный идентификатор
  - `first_name`, `last_name`, `middle_name` (text, зашифрованы): ФИО
  - `email` (text, зашифрован): электронная почта
  - `manager_id` (UUID): ссылка на руководителя
  - `position_id` (UUID): должность
  - `department_id` (UUID): подразделение
  - `grade_id` (UUID): грейд
  - `status` (boolean): активность

**Department (Подразделение)**
- Таблица: `departments`
- Описание: Организационное подразделение компании
- Поля: `id`, `name`, `description`

**Position (Должность)**
- Таблица: `positions`
- Описание: Должность сотрудника
- Связи: принадлежит к категории должностей (`position_category_id`)

**Position Category (Категория должности)**
- Таблица: `position_categories`
- Описание: Группировка должностей (например, "Менеджмент", "Продажи", "Поддержка")

**Trade Point (Торговая точка)**
- Таблица: `trade_points`
- Описание: Место работы сотрудника (магазин, офис)
- Поля: `name`, `address`, `latitude`, `longitude`, `status`

**User Trade Points (Привязка к торговым точкам)**
- Таблица: `user_trade_points`
- Описание: Связь пользователя с торговыми точками
- Связь: `user_id` ↔ `trade_point_id`

---

## Система компетенций

### Базовые элементы компетенций

**Skill (Навык / Hard Skill)**
- Таблица: `skills`
- Описание: Профессиональный навык (hard skill), технические знания и умения
- Поля: `id`, `name`, `description`, `category_id`
- Примеры: "Работа с CRM", "Управление проектами", "Знание продукта"

**Quality (Качество / Soft Skill)**
- Таблица: `qualities`
- Описание: Личностное качество (soft skill), поведенческие компетенции
- Поля: `id`, `name`, `description`
- Примеры: "Коммуникабельность", "Лидерство", "Клиентоориентированность"

**Category Skills (Категория навыков)**
- Таблица: `category_skills`
- Описание: Группировка навыков по категориям
- Примеры: "Технические навыки", "Управленческие навыки"

**Competency Level (Уровень компетенции)**
- Таблица: `competency_levels`
- Описание: Уровень развития компетенции
- Поля: `level` (integer), `name`, `description`
- Типичные значения: 0-5 (от "Не владеет" до "Эксперт")

---

### Грейды и требования

**Grade (Грейд)**
- Таблица: `grades`
- Описание: Уровень должности в карьерной лестнице
- Ключевые поля:
  - `level` (integer): числовой уровень грейда
  - `name` (text): название (например, "Младший специалист", "Старший менеджер")
  - `position_id` (UUID): привязка к должности
  - `position_category_id` (UUID): категория должности
  - `parent_grade_id` (UUID): родительский грейд (для карьерных треков)
  - `certification_id` (UUID): требуемая сертификация
  - `min_salary`, `max_salary`: вилка зарплаты
  - `description`: описание грейда
  - `key_tasks`: ключевые задачи

**Grade Skills (Требования по навыкам грейда)**
- Таблица: `grade_skills`
- Описание: Целевые уровни навыков для конкретного грейда
- Связь: `grade_id` ↔ `skill_id`
- Поле: `target_level` (numeric): требуемый уровень владения

**Grade Qualities (Требования по качествам грейда)**
- Таблица: `grade_qualities`
- Описание: Целевые уровни личностных качеств для грейда
- Связь: `grade_id` ↔ `quality_id`
- Поле: `target_level` (numeric): требуемый уровень развития

---

### Результаты оценки пользователя

**User Skills (Навыки пользователя)**
- Таблица: `user_skills`
- Описание: Текущие и целевые уровни навыков сотрудника
- Поля:
  - `user_id`, `skill_id`
  - `current_level` (numeric): текущий уровень
  - `target_level` (numeric): целевой уровень
  - `last_assessed_at` (timestamp): дата последней оценки

**User Qualities (Качества пользователя)**
- Таблица: `user_qualities`
- Описание: Текущие и целевые уровни личностных качеств
- Поля: аналогичны `user_skills`

**User Assessment Results (Агрегированные результаты оценки)**
- Таблица: `user_assessment_results`
- Описание: Сводные результаты оценки пользователя по итогам диагностического этапа
- Ключевые поля:
  - `user_id`, `diagnostic_stage_id`
  - `skill_id` или `quality_id`
  - `self_assessment` (numeric): самооценка
  - `manager_assessment` (numeric): оценка руководителя
  - `peers_average` (numeric): средняя оценка коллег
  - `total_responses` (integer): количество ответов
  - `assessment_period` (text): период оценки (H1_2025, H2_2025)

---

## Диагностика компетенций

### Диагностические этапы

**Diagnostic Stage (Диагностический этап)**
- Таблица: `diagnostic_stages`
- Описание: Цикл оценки компетенций (обычно полугодовой)
- Ключевые поля:
  - `period` (text): название периода (например, "H1 2025")
  - `status` (text): статус этапа
    - `setup`: настройка
    - `assessment`: оценка
    - `completed`: завершён
  - `start_date`, `end_date`, `deadline_date`: временные рамки
  - `progress_percent` (numeric): процент выполнения
  - `is_active` (boolean): активный этап
  - `evaluation_period` (text): период оценки (H1_YYYY/H2_YYYY)

**Diagnostic Stage Participants (Участники диагностического этапа)**
- Таблица: `diagnostic_stage_participants`
- Описание: Связь сотрудников с диагностическим этапом
- Поля: `stage_id`, `user_id`

**Evaluation Period (Период оценки)**
- Формат: `H1_YYYY` или `H2_YYYY`
- Описание: Полугодовой период оценки (H1 = январь-июнь, H2 = июль-декабрь)
- Функция: `get_evaluation_period(created_date)` автоматически определяет период

---

### Опросы и оценки

**Hard Skill Questions (Вопросы по профессиональным навыкам)**
- Таблица: `hard_skill_questions`
- Описание: Вопросы для оценки hard skills
- Поля: `question_text`, `skill_id`, `order_index`

**Hard Skill Answer Options (Варианты ответов для hard skills)**
- Таблица: `hard_skill_answer_options`
- Описание: Шкала оценки для вопросов по навыкам
- Поля: `title`, `numeric_value` (integer), `description`

**Hard Skill Results (Результаты оценки навыков)**
- Таблица: `hard_skill_results`
- Описание: Ответы на вопросы по профессиональным навыкам
- Ключевые поля:
  - `evaluated_user_id` (UUID): кого оценивают
  - `evaluating_user_id` (UUID): кто оценивает
  - `question_id`, `answer_option_id`
  - `diagnostic_stage_id` (UUID): привязка к этапу
  - `assignment_id` (UUID): привязка к назначению
  - `is_draft` (boolean): черновик/финальная версия
  - `comment` (text): комментарий
  - `evaluation_period` (text): период оценки

**Soft Skill Questions (Вопросы по личностным качествам)**
- Таблица: `soft_skill_questions`
- Описание: Вопросы для оценки soft skills (опрос 360°)
- Поля: `question_text`, `quality_id`, `category`, `behavioral_indicators`

**Soft Skill Answer Options (Варианты ответов для soft skills)**
- Таблица: `soft_skill_answer_options`
- Описание: Шкала оценки для опроса 360°
- Поля: `label`, `numeric_value`, `description`

**Soft Skill Results (Результаты оценки 360°)**
- Таблица: `soft_skill_results`
- Описание: Ответы на вопросы опроса 360°
- Поля: аналогичны `hard_skill_results` + `is_anonymous_comment` (boolean)

---

### Назначения и задачи

**Survey 360 Assignment (Назначение оценки 360°)**
- Таблица: `survey_360_assignments`
- Описание: Назначение оценки одним сотрудником другого
- Ключевые поля:
  - `evaluated_user_id` (UUID): кого оценивают
  - `evaluating_user_id` (UUID): кто оценивает
  - `diagnostic_stage_id` (UUID): этап диагностики
  - `assignment_type` (text): тип оценки
    - `self`: самооценка
    - `manager`: оценка руководителем
    - `peer`: оценка коллегой
  - `status` (text): статус назначения
    - `отправлен запрос`: запрос отправлен
    - `approved`: одобрено
    - `rejected`: отклонено
    - `completed`: завершено
  - `is_manager_participant` (boolean): участник - руководитель
  - `approved_by`, `approved_at`: данные об одобрении
  - `rejection_reason` (text): причина отклонения

**Task (Задача)**
- Таблица: `tasks`
- Описание: Задача для пользователя (оценка, встреча, развитие)
- Ключевые поля:
  - `user_id` (UUID): исполнитель
  - `title`, `description`: содержание
  - `status` (text): статус
    - `pending`: ожидает выполнения
    - `in_progress`: в процессе
    - `completed`: выполнено
  - `task_type` (text): тип задачи
    - `assessment`: оценка
    - `diagnostic_stage`: диагностический этап
    - `survey_360_evaluation`: оценка 360°
    - `meeting`: встреча 1:1
    - `development`: развитие
  - `category` (text): категория задачи
  - `assignment_type` (text): тип назначения (self/manager/peer)
  - `assignment_id` (UUID): связь с назначением
  - `diagnostic_stage_id` (UUID): связь с этапом
  - `priority` (text): приоритет (low/normal/high/urgent)
  - `deadline` (date): срок выполнения

---

## Встречи 1:1

**Meeting Stage (Этап встреч 1:1)**
- Таблица: `meeting_stages`
- Описание: Цикл проведения встреч один-на-один
- Поля: `period`, `start_date`, `end_date`, `deadline_date`, `is_active`

**Meeting Stage Participants (Участники этапа встреч)**
- Таблица: `meeting_stage_participants`
- Описание: Сотрудники, участвующие в цикле встреч
- Поля: `stage_id`, `user_id`

**One on One Meeting (Встреча 1:1)**
- Таблица: `one_on_one_meetings`
- Описание: Индивидуальная встреча сотрудника с руководителем
- Ключевые поля:
  - `employee_id`, `manager_id` (UUID): участники
  - `stage_id` (UUID): этап встреч
  - `meeting_date` (timestamp): дата встречи
  - `status` (text): статус
    - `draft`: черновик
    - `pending`: ожидает согласования
    - `approved`: согласовано
    - `rejected`: отклонено
  - `goal_and_agenda` (text): цель и повестка
  - `previous_decisions_debrief` (text): отчёт по предыдущим решениям
  - `energy_gained`, `energy_lost` (text): что даёт/отнимает энергию
  - `stoppers` (text): препятствия
  - `manager_comment` (text): комментарий руководителя
  - `return_reason` (text): причина возврата
  - `submitted_at`, `approved_at`, `returned_at`: временные метки

**Meeting Decision (Решение по итогам встречи)**
- Таблица: `meeting_decisions`
- Описание: Решения и договорённости, принятые на встрече
- Поля: `meeting_id`, `decision_text`, `is_completed`, `created_by`

---

## Карьерное развитие

**Career Track (Карьерный трек)**
- Таблица: `career_tracks`
- Описание: Путь карьерного развития
- Поля:
  - `name`, `description`
  - `track_type_id` (UUID): тип трека
  - `target_position_id` (UUID): целевая должность
  - `duration_months` (integer): длительность

**Track Type (Тип карьерного трека)**
- Таблица: `track_types`
- Описание: Классификация треков (вертикальный рост, горизонтальный переход и т.д.)

**Career Track Step (Шаг карьерного трека)**
- Таблица: `career_track_steps`
- Описание: Этап в карьерном треке
- Поля:
  - `career_track_id`, `grade_id`
  - `step_order` (integer): порядок шага
  - `duration_months` (integer): длительность
  - `description`: описание

**Development Plan (План развития)**
- Таблица: `development_plans`
- Описание: Индивидуальный план развития сотрудника
- Поля:
  - `user_id`, `created_by`
  - `title`, `description`
  - `status` (text): "Активный", "Завершён", "Приостановлен"
  - `start_date`, `end_date`

**Development Task (Задача развития)**
- Таблица: `development_tasks`
- Описание: Типовая задача для развития компетенции
- Ключевые поля:
  - `skill_id` или `quality_id`: связанная компетенция
  - `competency_level_id` (UUID): уровень компетенции
  - `task_name` (text): название задачи
  - `task_goal` (text): цель задачи
  - `how_to` (text): как выполнять
  - `measurable_result` (text): измеримый результат
  - `task_order` (integer): порядок выполнения

**Certification (Сертификация)**
- Таблица: `certifications`
- Описание: Профессиональная сертификация
- Поля: `name`, `provider`, `description`, `cost`, `validity_period_months`

---

## Безопасность и аудит

### Роли и права доступа

**App Role (Роль в системе)**
- Тип: `enum app_role`
- Значения:
  - `admin`: администратор
  - `hr_bp`: HR бизнес-партнёр
  - `manager`: руководитель
  - `employee`: сотрудник

**User Roles (Роли пользователя)**
- Таблица: `user_roles`
- Описание: Назначенные роли пользователя
- Поля: `user_id`, `role` (app_role)

**Permission (Разрешение)**
- Таблица: `permissions`
- Описание: Права доступа в системе
- Поля: `resource`, `action`, `name`, `description`
- Примеры: "users:read", "diagnostics:create", "reports:view"

**Role Permissions (Права доступа роли)**
- Таблица: `role_permissions`
- Описание: Связь ролей с разрешениями
- Поля: `role` (app_role), `permission_id`

---

### Аутентификация и аудит

**Auth Users (Учётные данные пользователей)**
- Таблица: `auth_users`
- Описание: Аутентификационные данные
- Поля:
  - `email` (text, зашифрован): логин
  - `password_hash` (text): bcrypt-хеш пароля
  - `is_active` (boolean): активность учётной записи

**Admin Sessions (Сессии администраторов)**
- Таблица: `admin_sessions`
- Описание: Активные сессии пользователей
- Поля:
  - `user_id`, `email`
  - `expires_at` (timestamp): срок действия (24 часа)

**Audit Log (Журнал аудита)**
- Таблица: `audit_log`
- Описание: Журнал действий администраторов
- Поля:
  - `admin_id`, `target_user_id`
  - `action_type` (text): тип действия
  - `field`, `old_value`, `new_value`: изменённые данные
  - `details` (jsonb): дополнительные детали

**Admin Activity Logs (Журнал активности)**
- Таблица: `admin_activity_logs`
- Описание: Расширенный журнал действий
- Поля:
  - `user_id`, `user_name`
  - `action`, `entity_type`, `entity_name`
  - `details` (jsonb)

---

## Вспомогательные сущности

**Survey Assignment (Назначение опроса)**
- Таблица: `survey_assignments`
- Описание: Общее назначение опросов (устаревшая таблица)
- Поля: `user_id`, `survey_type`, `status`, `due_date`, `assigned_by`

**User Achievements (Достижения пользователя)**
- Таблица: `user_achievements`
- Описание: Награды и достижения сотрудников
- Поля: `user_id`, `achievement_id`, `earned_at`, `notes`

**Manufacturer (Производитель)**
- Таблица: `manufacturers`
- Описание: Производитель продукции (для специфики бизнеса)
- Поля: `name`, `brand`

---

## Ключевые функции базы данных

### Функции проверки прав

- `has_role(_user_id, _role)`: проверка роли пользователя
- `has_permission(_user_id, _permission_name)`: проверка разрешения
- `has_any_role(_user_id, _roles[])`: проверка наличия любой из ролей
- `get_user_role(_user_id)`: получение роли пользователя
- `is_manager_of(_manager_id, _employee_id)`: проверка подчинённости
- `is_manager_of_user(target_user_id)`: проверка для текущего пользователя
- `is_current_user_admin()`: проверка администратора
- `is_current_user_hr()`: проверка HR BP или администратора
- `get_current_session_user()`: получение ID текущего пользователя из сессии

### Функции расчёта

- `calculate_diagnostic_stage_progress(stage_id)`: расчёт прогресса этапа диагностики
- `get_evaluation_period(created_date)`: определение периода оценки (H1/H2)

### Функции агрегации

- `aggregate_hard_skill_results()`: агрегация результатов по навыкам
- `aggregate_soft_skill_results()`: агрегация результатов по качествам
- `update_user_skills_from_survey()`: обновление навыков из опроса
- `update_user_qualities_from_survey()`: обновление качеств из опроса

### Функции управления задачами

- `create_task_on_assignment_approval()`: создание задачи при одобрении назначения
- `update_task_status_on_assignment_change()`: обновление статуса задачи
- `complete_diagnostic_task_on_surveys_completion()`: завершение задачи при заполнении опросов
- `update_meeting_task_status()`: обновление статуса задачи встречи
- `create_diagnostic_task_for_participant()`: создание задачи для участника диагностики
- `delete_diagnostic_tasks_on_participant_remove()`: удаление задач при исключении участника
- `create_meeting_task_for_participant()`: создание задачи встречи

### Функции управления участниками

- `handle_diagnostic_participant_added()`: обработка добавления участника диагностики
- `assign_surveys_to_diagnostic_participant()`: назначение опросов участнику
- `auto_assign_manager_for_360()`: автоматическое назначение руководителя для оценки 360°

### Административные функции

- `admin_delete_all_from_table(table_name)`: удаление всех записей из таблицы
- `admin_cleanup_all_data()`: очистка всех данных диагностики и встреч
- `log_admin_action(...)`: логирование действий администратора
- `check_diagnostic_invariants(stage_id)`: проверка инвариантов диагностики

---

## Ключевые статусы и состояния

### Статусы в базе данных (английские)

Используются константы из `src/lib/statusMapper.ts`:
- `pending`: ожидает выполнения
- `approved`: согласовано
- `completed`: выполнено
- `in_progress`: в процессе
- `rejected`: отклонено
- `draft`: черновик

### Отображение статусов в UI (русские)

Локализованные метки из `STATUS_LABELS`:
- `pending` → "Ожидает"
- `approved` → "Согласовано"
- `completed` → "Выполнено"
- `in_progress` → "В процессе"
- `rejected` → "Отклонено"
- `draft` → "Черновик"

---

## Соглашения и бизнес-правила

### Assignment Type (Тип назначения)

**Возможные значения:**
- `self`: самооценка (сотрудник оценивает себя)
- `manager`: оценка руководителем
- `peer`: оценка коллегой

**Инварианты:**
- Каждая задача должна иметь `assignment_type`, совпадающий с типом в `survey_360_assignments`
- Задачи типа `diagnostic_stage`, `survey_360_evaluation`, `skill_survey` ДОЛЖНЫ иметь `diagnostic_stage_id`

### Encryption (Шифрование данных)

**Зашифрованные поля:**
- `users.first_name`
- `users.last_name`
- `users.middle_name`
- `users.email`
- `auth_users.email`

**Метод:** Yandex Cloud Functions API
**Fallback:** При ошибке API отображается `[Encrypted]`

### Период оценки (Evaluation Period)

**Формат:** `H{1|2}_YYYY`
- H1: январь - июнь
- H2: июль - декабрь

**Автоматическое определение:** Триггер `set_evaluation_period()` вызывает `get_evaluation_period()` при INSERT в `hard_skill_results` и `soft_skill_results`

---

## TypeScript интерфейсы (Frontend)

### Из src/types/index.ts

**UserStatus (enum)**
- `ACTIVE`: активный
- `INACTIVE`: неактивный
- `ON_LEAVE`: в отпуске
- `TERMINATED`: уволен

**LearningType (enum)**
- `COURSE`: курс
- `TEST`: тест
- `ONBOARDING`: адаптация
- `WORKSHOP`: воркшоп
- `CERTIFICATION`: сертификация

**LearningStatus (enum)**
- `NOT_STARTED`: не начато
- `IN_PROGRESS`: в процессе
- `COMPLETED`: завершено
- `OVERDUE`: просрочено
- `CANCELLED`: отменено

**TaskPriority (enum)**
- `LOW`: низкий
- `MEDIUM`: средний
- `HIGH`: высокий
- `URGENT`: срочный

**AssessmentType (enum)**
- `SKILLS_360`: оценка 360°
- `PROFESSIONAL_SKILLS`: профессиональные навыки
- `KNOWLEDGE_TEST`: тест знаний
- `PERFORMANCE_REVIEW`: оценка эффективности

---

## Примечания по архитектуре

1. **RLS (Row Level Security):** Включён на всех таблицах с чувствительными данными
2. **SECURITY DEFINER:** Используется в функциях проверки прав для избежания рекурсии RLS
3. **Триггеры:** Автоматизируют создание задач, обновление статусов, агрегацию результатов
4. **Внешние ключи:** Используют UUID для связей между таблицами
5. **Временные метки:** `created_at`, `updated_at` автоматически управляются триггерами
6. **Soft delete:** Не используется, вместо этого флаг `is_active` или `status`

---

*Документ актуален на 2025-01-10*
