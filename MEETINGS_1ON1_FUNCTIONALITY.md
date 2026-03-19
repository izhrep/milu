# Функционал "Встречи one-to-one" — Полная спецификация

**Дата обновления:** 2026-03-19

---

## 1. Архитектура модуля

Модуль встреч one-to-one — **stage-less** цифровой контейнер встречи между сотрудником и руководителем. Этапы (`meeting_stages`) — legacy, UI скрыт за feature flag `VITE_MEETINGS_STAGE_UI_ENABLED=false`.

### Терминология (UI)

| Контекст | Формулировка |
|---|---|
| Полное название | «Встречи one-to-one» |
| В сайдбаре | «Встречи» / «Мониторинг встреч» (сокращённо) |
| В хлебных крошках / заголовках | «Мониторинг встреч one-to-one» |
| Цикл встреч | «Цикл встреч one-to-one» |

---

## 2. Структура базы данных

### Основные таблицы

| Таблица | Назначение |
|---|---|
| `one_on_one_meetings` | Основная таблица встреч |
| `meeting_manager_fields` | Поля руководителя (отдельная таблица для RLS-безопасности, join по `meeting_id`) |
| `meeting_decisions` | Договорённости (action items) |
| `meeting_artifacts` | Вложения (файлы) к встрече |
| `meeting_private_notes` | Приватные заметки руководителя |

### Поля `one_on_one_meetings`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID PK | |
| `stage_id` | UUID nullable | Legacy, всегда null в новой модели |
| `employee_id` | UUID FK→users | Сотрудник |
| `manager_id` | UUID FK→users | Руководитель на момент встречи |
| `created_by` | UUID | Кто создал встречу |
| `status` | text | `scheduled` / `awaiting_summary` / `recorded` (вычисляется автоматически) |
| `meeting_date` | timestamptz | Дата и время встречи |
| `meeting_link` | text nullable | Ссылка на видеоконференцию |
| **Блок сотрудника** | | |
| `emp_mood` | text nullable | Настроение |
| `emp_successes` | text nullable | Успехи |
| `emp_problems` | text nullable | Проблемы |
| `emp_news` | text nullable | Новости |
| `emp_questions` | text nullable | Вопросы |
| **Итоги** | | |
| `meeting_summary` | text nullable | Итоги встречи |
| `summary_saved_by` | UUID nullable | Кто сохранил итоги |
| `summary_saved_at` | timestamptz nullable | Когда сохранены итоги |
| **Legacy поля** | | |
| `goal_and_agenda`, `energy_gained`, `energy_lost`, `stoppers`, `ideas_and_suggestions` | text nullable | Устаревшие, не используются в новом UI |
| `submitted_at`, `approved_at`, `returned_at`, `return_reason`, `manager_comment` | — | Устаревшие (из старой approval-модели) |

### Поля `meeting_manager_fields`

| Поле | Тип | Описание |
|---|---|---|
| `meeting_id` | UUID FK→one_on_one_meetings | |
| `mgr_notes` | text nullable | Заметки руководителя |
| `mgr_assessment` | text nullable | Оценка руководителя |
| `mgr_feedback` | text nullable | Обратная связь |

### Статусная модель (3 статуса)

| Статус | Условие | UI-метка |
|---|---|---|
| `scheduled` | `meeting_date > now()` И `meeting_summary IS NULL` | Запланирована |
| `awaiting_summary` | `meeting_date <= now()` И `meeting_summary IS NULL` | Ожидает итогов |
| `recorded` | `meeting_summary IS NOT NULL` | Зафиксирована |

Статус **вычисляется автоматически** триггером `compute_meeting_status_and_validate` при INSERT/UPDATE. Дополнительно, pg_cron функция `process_meeting_status()` каждые 15 минут обновляет встречи, у которых дата прошла.

**Валидация:** При попытке создать вторую `scheduled` встречу для той же пары employee+manager — триггер выбрасывает ошибку.

---

## 3. Роли и права доступа

### Сотрудник (employee)
- ✅ Просмотр своих встреч (все статусы)
- ✅ Создание встречи со своим руководителем
- ✅ Заполнение блока сотрудника (настроение, успехи, проблемы, новости, вопросы)
- ✅ Сохранение итогов встречи
- ✅ Добавление договорённостей
- ✅ Загрузка/просмотр вложений
- ✅ Ознакомление с итогами (acknowledge → закрытие задачи `meeting_review_summary`)

### Руководитель (manager)
- ✅ Просмотр встреч **всех** подчинённых (включая историю с другими руководителями)
- ✅ Создание встречи для подчинённого
- ✅ Заполнение блока руководителя (через `meeting_manager_fields`)
- ✅ Сохранение итогов встречи
- ✅ Редактирование договорённостей
- ✅ Загрузка/просмотр вложений
- ✅ Read-only доступ к «историческим» встречам (где `manager_id` ≠ текущий пользователь)
- ✅ Read-only subtree-доступ к встречам непрямых подчинённых

### HR-Администратор (admin/hr_bp)
- ✅ Создание встреч для любой пары сотрудник-руководитель
- ✅ Просмотр всех встреч всех сотрудников
- ✅ Мониторинг встреч one-to-one (KPI дашборд)

---

## 4. Workflow (жизненный цикл встречи)

### 4.1. Создание встречи

1. Пользователь открывает `CreateMeetingDialog`
2. Выбирает дату/время встречи
3. Роль определяет поведение:
   - **Employee:** встреча создаётся с его `manager_id` из профиля (или ручной выбор, если `manager_id` не назначен)
   - **Manager:** выбирает подчинённого из списка
   - **HR/Admin:** выбирает любую пару сотрудник + руководитель
4. INSERT в `one_on_one_meetings` → триггеры:
   - `trg_compute_meeting_status` → статус `scheduled` или `awaiting_summary`
   - `create_meeting_scheduled_task` → задача `meeting_scheduled` для обоих участников

### 4.2. Подготовка к встрече (status: `scheduled`)

- Сотрудник заполняет блок: настроение, успехи, проблемы, новости, вопросы
- Руководитель заполняет свой блок через `meeting_manager_fields`
- Участники могут загружать вложения

### 4.3. После встречи (status: `awaiting_summary`)

- Когда `meeting_date` наступает → статус автоматически `awaiting_summary`
- pg_cron (`process_meeting_tasks`) создаёт задачу `meeting_fill_summary` для руководителя

### 4.4. Фиксация итогов (status: `recorded`)

- Любой участник сохраняет `meeting_summary` → статус `recorded`
- Триггер `trg_create_review_summary_task` создаёт задачу `meeting_review_summary` для второй стороны
- Вторая сторона ознакомляется с итогами → задача закрывается

### 4.5. Мониторинг регулярности

- pg_cron (`process_meeting_tasks`) проверяет каждые 15 минут:
  - Если сотрудник **активный**, **внутренний** (не "(внешний)"), **уже участвовал** в цикле встреч (≥1 встреча), но >35 дней без `recorded` встречи → задача `meeting_plan_new` для руководителя
  - **Цикл встреч one-to-one не начат** ≠ просрочка. Задача создаётся только для сотрудников, уже вошедших в цикл.

---

## 5. Система задач (tasks)

| Тип задачи | Назначается | Когда | assignment_id |
|---|---|---|---|
| `meeting_scheduled` | Обоим участникам | При создании встречи (триггер) | `meeting.id` |
| `meeting_fill_summary` | Руководителю | Дата встречи прошла, итогов нет (pg_cron) | `meeting.id` |
| `meeting_review_summary` | Второй стороне | При сохранении итогов (триггер) | `meeting.id` |
| `meeting_plan_new` | Руководителю | >35 дней без recorded встречи для активного сотрудника (pg_cron) | `employee.id` |

**Дедупликация:** Все задачи проверяют наличие дубликатов перед созданием (фильтр по `assignment_id` + `task_type` + `status`).

---

## 6. Мониторинг встреч one-to-one

Страница: `/meetings-monitoring` (`MeetingsMonitoringPage`)

### KPI дашборд

| Метрика | Описание |
|---|---|
| Всего сотрудников | Количество видимых сотрудников (subtree для manager, все для admin) |
| В норме | Есть `recorded` встреча в пределах 35 дней |
| Просрочено | Есть хотя бы одна встреча в истории, но >35 дней без `recorded` |
| Ожидает итогов | Есть встреча со статусом `awaiting_summary` |
| Запланирована | Есть встреча со статусом `scheduled` |
| Не участвует в цикле | Внутренний сотрудник, ноль встреч |

### Фильтрация

- Внешние сотрудники (position category содержит "(внешний)") **исключены** из мониторинга
- Subtree-видимость для руководителей
- Сортировка: приоритет `overdue` и `awaiting_summary`

---

## 7. Историчность и subtree-доступ

- История встреч привязана к `employee_id`, не к паре сотрудник-руководитель
- Текущий руководитель (по `users.manager_id`) видит **всю историю** подчинённого
- «Исторические» встречи (где `meeting.manager_id` ≠ текущий пользователь) → read-only, баннер с ФИО оригинального руководителя
- Вышестоящие руководители → read-only через RLS `is_in_management_subtree`

---

## 8. Вложения (meeting_artifacts)

- Bucket: `meeting-artifacts` (private)
- Лимит: 10 файлов на встречу, 25MB на файл
- Разрешённые форматы: PDF, DOCX, XLSX, изображения и др. JS и EXE запрещены
- Storage keys: sanitized (non-ASCII → `_`), оригинальные имена в metadata БД
- Доступ: signed URLs (300с) для участников встречи в любом статусе
- Удаление: автор или пользователь с `meetings.manage`

---

## 9. Триггеры и pg_cron

### Триггеры (AFTER INSERT/UPDATE на `one_on_one_meetings`)

| Триггер | Назначение |
|---|---|
| `trg_compute_meeting_status` | Вычисление статуса + валидация уникальности scheduled |
| `create_meeting_scheduled_task` | Создание задачи `meeting_scheduled` при INSERT |
| `trg_create_review_summary_task` | Создание задачи `meeting_review_summary` при сохранении итогов |

### pg_cron (каждые 15 минут)

| Функция | Назначение |
|---|---|
| `process_meeting_status()` | Обновление встреч в `awaiting_summary` при наступлении даты |
| `process_meeting_tasks()` | Генерация `meeting_fill_summary` и `meeting_plan_new` для руководителей |

---

## 10. Фронтенд-компоненты

| Компонент/Hook | Назначение |
|---|---|
| `src/pages/MeetingsPage.tsx` | Страница «Встречи one-to-one» |
| `src/pages/MeetingsMonitoringPage.tsx` | Мониторинг встреч one-to-one |
| `src/components/MeetingForm.tsx` | Форма встречи |
| `src/components/CreateMeetingDialog.tsx` | Диалог создания встречи |
| `src/components/MeetingArtifacts.tsx` | Управление вложениями |
| `src/components/Meeting360AttachButton.tsx` | Привязка результатов 360° |
| `src/components/TeamMembersTable.tsx` | Таблица команды со статусами встреч |
| `src/hooks/useOneOnOneMeetings.ts` | CRUD и мутации встреч |
| `src/hooks/useMeetingManagerFields.ts` | Поля руководителя |
| `src/hooks/useMeetingArtifacts.ts` | Вложения |
| `src/hooks/useMeetingDecisions.ts` | Договорённости |
| `src/hooks/useMeetingPrivateNotes.ts` | Приватные заметки |
| `src/hooks/useMeetingTasks.ts` | Acknowledge задач ревью |
| `src/hooks/useMeetingStages.ts` | Legacy, этапы встреч |
