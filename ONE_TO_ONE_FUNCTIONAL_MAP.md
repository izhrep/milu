# Функциональная карта модуля встреч 1:1

> Актуально на: 2026-03-31. Составлено по фактическому состоянию кодовой базы.

---

## 1. Обзор модуля

Модуль встреч 1:1 (one-to-one) обеспечивает планирование, проведение и фиксацию регулярных встреч между сотрудником и его руководителем. Основная точка входа — `/meetings` (`MeetingsPage`).

### Ключевые компоненты

| Файл | Назначение |
|------|-----------|
| `src/pages/MeetingsPage.tsx` | Главная страница: табы, списки встреч, карточки |
| `src/components/MeetingForm.tsx` | Форма просмотра/редактирования встречи (Dialog) |
| `src/components/CreateMeetingDialog.tsx` | Диалог создания встречи |
| `src/components/RescheduleMeetingDialog.tsx` | Диалог переноса встречи |
| `src/components/DeleteMeetingDialog.tsx` | Подтверждение удаления встречи |
| `src/components/MeetingSummaryHistory.tsx` | Вертикальная история итогов пары сотрудник–лид |
| `src/hooks/useOneOnOneMeetings.ts` | CRUD-хук: query, create, update, saveSummary, reschedule, delete |
| `src/hooks/useMeetingManagerFields.ts` | Изолированные поля руководителя (praise, dev comment, news) |
| `src/hooks/useMeetingTasks.ts` | Acknowledge задач `meeting_review_summary` |
| `src/hooks/useMeetingPrivateNotes.ts` | Приватные заметки руководителя (скрыты из UI) |
| `src/hooks/useMeeting360Attachment.ts` | Привязка 360-снапшотов (скрыта из UI) |
| `src/hooks/useMenuVisibility.ts` | Видимость пункта «Встречи» в меню |
| `src/lib/meetingDateTime.ts` | Unified timezone utilities: effectiveTimezone resolution, local↔UTC conversion (date-fns-tz), display formatting, minTime for today |
| `src/lib/meetingDateFormat.ts` | Форматирование дат для списков/карточек (timezone-aware) |
| `src/lib/meetingValidation.ts` | Валидация: дата в прошлом, конфликт участников |

---

## 2. Ролевая модель и permissions

### Роли

| Роль | Контекст в модуле |
|------|-------------------|
| **Сотрудник** (employee) | Участник встречи (`employee_id`). Видит свои встречи. |
| **Руководитель** (manager) | Проводящий встречу (`manager_id`). Видит встречи прямых и косвенных подчинённых. |
| **Руководитель руководителей** (manager+1) | Руководитель, у которого есть подчинённые-руководители. Видит встречи всего поддерева. |
| **HRBP / Admin** | Пользователь с permission `meetings.view_all`. Видит все встречи всех сотрудников. |

### Permissions (таблица `permissions` + `role_permissions`)

| Permission | Описание | Используется в |
|-----------|----------|---------------|
| `team.view` | Видимость вкладки «Встречи с моими сотрудниками» и пункта меню | `MeetingsPage`, `useMenuVisibility` |
| `meetings.view_all` | Полная видимость всех встреч (вкладка «Встречи сотрудников»), поиск при создании | `MeetingsPage`, `CreateMeetingDialog` |
| `meetings.delete` | Удаление любой встречи | `MeetingsPage`, `MeetingForm` |
| `meetings.edit_summary_date` | Режим HRBP: редактирование итогов и даты/времени чужих встреч | `MeetingForm` |

### Видимость пункта меню «Встречи» для сотрудников

Определяется в `useMenuVisibility`. Показывается, если выполнено **хотя бы одно**:
1. Пользователь участвует в `meeting_stage_participants`
2. У пользователя есть хотя бы одна встреча в `one_on_one_meetings` (как `employee_id`)
3. У пользователя назначен `manager_id` в профиле

Для пользователей с `team.view` — всегда показывается.

---

## 3. Модель данных

### Основные таблицы

| Таблица | Назначение |
|---------|-----------|
| `one_on_one_meetings` | Основная таблица встреч |
| `meeting_manager_fields` | Изолированные поля руководителя (RLS: сотрудник не имеет SELECT) |
| `meeting_private_notes` | Приватные заметки руководителя (RLS: только manager, без HRBP/Admin) |
| `meeting_reschedules` | История переносов (previous_date, new_date, rescheduled_by) |
| `meeting_decisions` | Решения встречи (decision_text, is_completed) |
| `tasks` | Автоматические задачи (`meeting_review_summary`, `meeting_plan_new`) |

### Поля `one_on_one_meetings`

**Участники:** `employee_id`, `manager_id`, `created_by`

**Общие (shared) поля:** `meeting_date`, `meeting_link`, `stage_id`

**Поля сотрудника:** `emp_mood`, `emp_successes`, `emp_problems`, `emp_news`, `emp_questions`

**Итоги:** `meeting_summary`, `summary_saved_by`, `summary_saved_at`

**Статус:** `status` (computed by DB trigger)

**Legacy:** `submitted_at`, `approved_at`, `returned_at`, `return_reason`, `status_at_stage_end`, `stage_end_snapshot_at`

### Поля `meeting_manager_fields`

`mgr_praise`, `mgr_development_comment`, `mgr_news` — хранятся в отдельной таблице для безопасности. Сотрудник не имеет доступа на чтение (RLS).

---

## 4. Статусная модель

### Статусы встречи

| Статус | Условие | Badge |
|--------|---------|-------|
| `scheduled` | Дата в будущем | secondary (серый) |
| `awaiting_summary` | Дата прошла, итог не заполнен | destructive (красный) |
| `recorded` | Итог сохранён | default (зелёный) |

### Логика определения статуса

- **В БД:** статус пересчитывается триггером при UPDATE `meeting_date` или `meeting_summary`.
- **На клиенте:** `getEffectiveStatus()` в `MeetingsPage` дополнительно проверяет: если DB-статус `scheduled`, но `meeting_date` в прошлом и `meeting_summary` отсутствует → показывает `awaiting_summary`. Это нужно для случаев, когда cron ещё не обновил статус.

### Переходы

```
scheduled → awaiting_summary    (время наступило, триггер/cron/клиент)
awaiting_summary → recorded     (summary сохранён, триггер)
awaiting_summary → scheduled    (перенос в будущее, триггер)
```

---

## 5. Экраны и вкладки

### MeetingsPage — три вкладки

| Вкладка | Условие показа | Данные | Фильтры |
|---------|---------------|--------|---------|
| **Мои встречи с руководителем** | Всегда | `employee_id = user.id` | — |
| **Встречи с моими сотрудниками** | `team.view` + есть подчинённые в subtree | `employee_id ∈ subtree` | Лид (для manager+1), Сотрудник |
| **Встречи сотрудников** | `meetings.view_all` | Все встречи | Лид, Сотрудник |

### Дефолтная вкладка

- `meetings.view_all` → «Встречи сотрудников»
- `team.view` + подчинённые → «Встречи с моими сотрудниками»
- Иначе → «Мои встречи с руководителем»

### Manager+1: фильтрация по поддереву

Для руководителей с косвенными подчинёнными:
- Селектор «Лид» показывает: текущего пользователя + прямых подчинённых-руководителей
- Селектор «Сотрудник» фильтруется по выбранному лиду
- По умолчанию «Лид» = текущий пользователь

### Автовыбор сотрудника

Во всех вкладках используется авто-выбор по последней активности (`updated_at` из `one_on_one_meetings`).

---

## 6. Карточка встречи (MeetingCard)

### CTA-кнопки на карточке

| Статус | isHistorical | Кнопки |
|--------|-------------|--------|
| `scheduled` | false | «Открыть» |
| `awaiting_summary` | false | «Открыть и заполнить итоги» + «Перенести» |
| `recorded` | false | «Открыть» |
| любой | true | «Просмотр» |
| любой | isAdminView | «Просмотр» |

### Бейджи

- Статус (scheduled/awaiting_summary/recorded)
- «Историческая» — если `meeting.manager_id ≠ user.id` (на вкладке руководителя)
- «Просмотр» — на вкладке admin/HR

### Удаление

Кнопка 🗑 на карточке — только для `meetings.delete`.

---

## 7. Форма встречи (MeetingForm)

Открывается в Dialog (`max-w-4xl`, `max-h-[90vh]`, `overflow-y-auto`).

### Режимы доступа

| Условие | Режим | Описание |
|---------|-------|----------|
| `user.id = employee_id` | Сотрудник | Редактирует свои поля |
| `user.id = manager_id` | Руководитель | Редактирует блок руководителя, читает блок сотрудника |
| `manager_id ≠ user.id` && is manager view | Историческая | Полный read-only, баннер с ФИО оригинального руководителя |
| `meetings.edit_summary_date` && !participant | HRBP | Редактирует дату/время и итоги, остальное read-only |

### Флаги доступа (computed в MeetingForm)

```
isManager          = user.id ≠ employee_id
isParticipant      = user.id ∈ {employee_id, manager_id}
isHrbpEdit         = canEditSummaryDate && !isParticipant
isHistorical       = (isManager && manager_id ≠ user.id) && !isHrbpEdit
isMeetingStarted   = now ≥ meeting_date (re-evaluated every 30s)
isOverdue          = isMeetingStarted && status ≠ 'recorded'

canEditEmployeeFields = !isHistorical && !isManager && status ≠ 'recorded'
canEditManagerFields  = !isHistorical && isManager && manager_id = user.id
canEditSharedFields   = !isHistorical && !isOverdue && status ≠ 'recorded'
canEditDateTime       = isHrbpEdit || canEditSharedFields
canEditSummary        = isHrbpEdit || (!isHistorical && isMeetingStarted)
canReschedule         = isOverdue && !meeting_summary && !isHistorical
```

### Блоки формы (сверху вниз)

1. **Баннер** — историческая или HRBP-режим
2. **Шапка** — статус-бейдж + дата + кнопки «Сохранить» / «Сохранить дату»
3. **Дата/время + Ссылка** — Calendar-popover + TimePicker + Input[url]
   - При overdue: дата/ссылка read-only + подсказка «используйте Перенести»
   - Кнопка «Перенести встречу» — при `canReschedule`
   - История переносов — видна руководителю и HR
4. **Блок сотрудника** — 5 полей (emp_mood, emp_successes, emp_problems, emp_news, emp_questions)
   - Редактируемо только для `employee_id`
   - Руководитель видит read-only с подписью
5. **Блок руководителя** — 3 поля (mgr_praise, mgr_development_comment, mgr_news)
   - Показывается: `isManager || isHrbpEdit`
   - Редактируемо только для `manager_id = user.id`
   - Отдельная кнопка «Сохранить» (upsert в `meeting_manager_fields`)
6. **Итоги встречи — резюме**
   - До наступления времени: «Итоги можно заполнить после начала встречи»
   - CTA-баннер «Добавить итоги» — если meeting started, нет summary, не редактируется
   - Inline textarea с «Сохранить итоги» / «Отмена»
   - `MeetingSummaryHistory` — вертикальная история всех итогов пары
7. **Удалить встречу** — только `meetings.delete`

### Сохранение

| Действие | Кнопка | Условие | Что сохраняется |
|----------|--------|---------|----------------|
| Сохранить (employee/shared) | Шапка | `employeeDirty && canEditSharedFields` | emp_* + meeting_link + meeting_date |
| Сохранить дату (HRBP) | Шапка | `hrbpDateDirty && isHrbpEdit` | Только `meeting_date` |
| Сохранить (manager block) | Блок руководителя | `managerDirty && canEditManagerFields` | mgr_praise, mgr_development_comment, mgr_news |
| Сохранить итоги | Блок итогов | `summaryDirty && isSummaryValid` | meeting_summary + summary_saved_by/at |

### Dirty-проверки

- `employeeDirty` — сравнение текущих значений формы с `meeting.*`
- `managerDirty` — сравнение local state с `managerFields.*`
- `summaryDirty` — `summaryDraft ≠ meeting.meeting_summary`
- `hrbpDateDirty` — `watch('meeting_date') ≠ meeting.meeting_date`

### Acknowledge задач

При открытии формы (`useEffect`) вызывается `acknowledgeMeetingReview(meetingId)`:
- Закрывает задачу `meeting_review_summary` для текущего пользователя
- **Только** если `task.assignment_id = meetingId` (проверка на уровне SQL `.eq('assignment_id', meetingId)`)

---

## 8. Создание встречи (CreateMeetingDialog)

### Сценарии по ролям

| Роль | Выбор сотрудника | Выбор руководителя |
|------|-----------------|-------------------|
| **Сотрудник с manager_id** | Нет (= сам пользователь) | Нет (auto = manager_id) |
| **Сотрудник без manager_id** | Нет (= сам) | Manual select из всех пользователей |
| **Руководитель** | Subtree (прямые + косвенные) | Auto: для прямых = сам user; для косвенных = их manager_id |
| **HRBP/Admin** | Все активные с manager_id, поиск по ФИО/email | Auto read-only = employee.manager_id |

### Валидация при создании

1. **Дата в прошлом** — запрещено (Calendar disabled + `validateMeetingCreation`)
2. **Лимит незавершённых** — max 2 встречи со статусом `scheduled`/`awaiting_summary` на одного сотрудника
3. **Участники** — employee_id ≠ manager_id
4. **Время по умолчанию** — `10:00`

### HRBP-ограничения

- Доступны **только сотрудники с `manager_id`** (организационная привязка)
- Руководитель определяется автоматически из `employee.manager_id` (read-only)
- Поиск по ФИО и email с фильтрацией

---

## 9. Перенос встречи (RescheduleMeetingDialog)

### Условия доступа

- Кнопка «Перенести» показывается при `awaiting_summary` + нет summary + не историческая
- Доступна с карточки (MeetingsPage) и из формы (MeetingForm)

### Flow

1. Выбрать дату (Calendar, прошлые даты disabled) и время (TimePicker, default `10:00`)
2. Проверка конфликта: нельзя перенести, если у сотрудника уже есть другая активная встреча на то же дату+время
3. Сохранение: INSERT в `meeting_reschedules` + UPDATE `meeting_date`
4. DB-триггер пересчитывает статус (→ `scheduled` если новая дата в будущем)
5. DB-триггер `notify_meeting_change` удаляет старые pending-уведомления, создаёт новые

### История переносов

Видна в форме встречи только для руководителя и HR (`isManager || canViewAllMeetings`). Формат: `старая дата → новая дата · автор · когда`.

---

## 10. Итоги встречи (Summary)

### Правила доступности

- Поле ввода доступно **только после наступления времени встречи** (проверка `isMeetingStarted` с тиком 30 сек)
- До наступления: текстовое уведомление «Итоги можно заполнить после начала»

### Редактирование

- Первое заполнение: CTA-баннер → textarea → «Сохранить итоги»
- Повторное редактирование: кнопка «Изменить» в блоке истории → тот же textarea
- Черновик (`summaryDraft`) изолирован от `react-hook-form` для стабильности UX

### Валидация

- Пустой/whitespace-only текст не сохраняется (`summaryDraft.trim().length > 0`)
- Невозможно удалить ранее сохранённый итог (нет кнопки удаления)

### История итогов (MeetingSummaryHistory)

- Показывает все итоги пары сотрудник–лид, от новых к старым
- Каждая запись: № встречи, дата, автор, текст
- Длинные тексты — truncate с раскрытием
- ScrollArea с `max-h-[300px]`, `overscroll-behavior: contain`
- Текущая встреча выделена визуально
- **Гиперссылки:** URL в текстах итогов (`https://...`, `http://...`) отображаются как кликабельные ссылки (синие, underline, `target="_blank"`, `rel="noopener noreferrer"`). Невалидные строки остаются обычным текстом. Реализовано через `<LinkedText>` (`src/components/ui/linked-text.tsx`).

---

## 11. Удаление встречи

- Permission: `meetings.delete`
- Двухэтапное подтверждение через `DeleteMeetingDialog`
- Доступно: на карточке (MeetingsPage) и в форме (MeetingForm)
- CASCADE: удаление записи из `one_on_one_meetings` каскадно удаляет связанные данные

---

## 12. Автоматизация (DB-триггеры и cron)

### Триггер `trg_meeting_notify` → `notify_meeting_change()`

Срабатывает на UPDATE `one_on_one_meetings`:

| Условие | Action | Эффект |
|---------|--------|--------|
| `meeting_date` изменилась | `reschedule` | Удаляет старые R1-R4, создаёт новые, шлёт R5a |
| `meeting_summary`: NULL → NOT NULL | `summary_saved` | Шлёт R6/R6a |
| `meeting_summary`: NOT NULL → другой NOT NULL (IS DISTINCT FROM) | `summary_saved` | Шлёт R6/R6a (для повторного редактирования) |

### Автоматические задачи

| Тип задачи | Когда создаётся | Когда закрывается |
|-----------|-----------------|-------------------|
| `meeting_review_summary` | Триггер при сохранении итогов | Пользователь открыл форму конкретной встречи (`assignment_id` check) |
| `meeting_plan_new` | Cron: менеджер не имеет активных встреч с сотрудником 35+ дней | INSERT новой встречи / cron-очистка при наличии активной встречи |

---

## 13. Безопасность (RLS)

### `one_on_one_meetings`

- **SELECT:** `employee_id = auth.uid()` OR `manager_id = auth.uid()` OR `has_permission('meetings.manage')` OR `has_permission('meetings.view_all')` OR `is_users_manager(employee_id)`
- **INSERT:** authenticated
- **UPDATE:** `employee_id = auth.uid()` OR `manager_id = auth.uid()` OR `has_permission('meetings.manage')` OR `has_permission('meetings.edit_summary_date')`
- **DELETE:** `has_permission('meetings.delete')`

### `meeting_manager_fields`

- **SELECT:** `manager_id` встречи = auth.uid() OR `has_permission('meetings.view_all')`
- **INSERT/UPDATE:** `manager_id` встречи = auth.uid()
- Сотрудник **не имеет SELECT** доступа

### `meeting_private_notes`

- **SELECT/INSERT/UPDATE:** Только `manager_id` встречи = auth.uid()
- HRBP и Admin **не имеют доступа**

### `meeting_reschedules`

- SELECT через JOIN с `one_on_one_meetings` (доступ наследуется)

---

## 14. Валидация (фронтенд)

### `meetingValidation.ts`

| Правило | Контекст | Поле |
|---------|---------|------|
| Дата в прошлом | Создание, редактирование | `date` |
| Время не указано | Создание | `time` |
| employee = manager | Создание | `participants` |
| Ссылка не https:// | Редактирование | `meeting_link` (zod schema) |

### Лимит незавершённых встреч

Проверяется в `CreateMeetingDialog`: `count(status IN ('scheduled','awaiting_summary')) >= 2` → блокировка создания. Единое правило для всех ролей.

### Конфликт при переносе

Проверяется в `RescheduleMeetingDialog`: наличие другой активной встречи того же сотрудника на тот же `meeting_date`.

---

## 15. Работа с датами и часовыми поясами

### Контракт timezone

**Единое правило для всего модуля:**

1. **Source of truth:** `users.timezone` из профиля (IANA string, e.g. `Asia/Krasnoyarsk`)
2. **Client fallback:** `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser/OS timezone)
3. **Server fallback:** `Europe/Moscow` (agreed product decision для edge functions/cron, где нет browser)
4. **Никогда** не определять timezone по IP или геолокации сети

Разрешение: `getEffectiveTimezone(user?.timezone)` → profile TZ if valid, else browser TZ.

### Конвертация local → UTC (DST-safe)

Используется **`date-fns-tz`** (`fromZonedTime`):

```ts
localDateTimeToUtcIso(dateStr, timeStr, timezone)
// Интерпретирует "2026-04-03", "15:00" в timezone пользователя → UTC ISO string
```

- Все операции создания и переноса используют `localDateTimeToUtcIso` с `effectiveTimezone`
- Нет custom offset math, нет зависимости от browser-local `Date` поведения
- DST-переходы обрабатываются библиотекой автоматически

### Конвертация UTC → display

Используется `Intl.DateTimeFormat({ timeZone })`:

- `formatDateInTimezone(date, timezone)` → `YYYY-MM-DD`
- `formatTimeInTimezone(date, timezone)` → `HH:MM`
- `getTimezoneOffsetLabel(timezone)` → `UTC+7`, `UTC−3:30`

### Правило отображения

Каждый пользователь видит время встречи **в своём** `effectiveTimezone`. Label в UI содержит подсказку `(UTC+N)`.

### Проверка прошедших слотов времени

При выборе даты = «сегодня» в `effectiveTimezone` пользователя, все прошедшие временные слоты в TimePicker недоступны для выбора (disabled). Реализовано через `getMinTimeForDate(dateStr, timezone)` + prop `minTime` в `TimePicker`.

### TimePicker

- Поддерживает маску двоеточия
- Default: `10:00`
- Прямой ввод HH:MM через двойной клик
- Prop `minTime` — если задан, слоты раньше этого времени disabled в dropdown

### Утилиты

| Функция | Назначение |
|---------|-----------|
| `getEffectiveTimezone(profileTz?)` | Resolve effective TZ: profile → browser fallback |
| `getBrowserTimezone()` | Browser/OS IANA timezone |
| `localDateTimeToUtcIso(date, time, tz)` | Local → UTC ISO (DST-safe, date-fns-tz) |
| `formatDateInTimezone(date, tz)` | UTC Date → YYYY-MM-DD in user's TZ |
| `formatTimeInTimezone(date, tz)` | UTC Date → HH:MM in user's TZ |
| `getTimezoneOffsetLabel(tz)` | → "UTC+7", "UTC−3:30" |
| `getMinTimeForDate(dateStr, tz)` | → min HH:MM if today, else null |
| `getNowInTimezone(tz)` | → { date, time } in given TZ |
| `buildLocalDateTimeString(date, time)` | Naive local datetime string (form state) |
| `parseMeetingDateTime(isoStr)` | Parse ISO/naive string → Date |

---

## 16. Зависимости и интеграции

### Со смежными модулями

| Модуль | Связь |
|--------|-------|
| Диагностические этапы | `stage_id` → привязка встречи к этапу (опционально) |
| Управленческое дерево | `useSubordinateTree` → определение подчинённых для менеджера |
| Задачи | `tasks` → автоматические задачи `meeting_review_summary`, `meeting_plan_new` |
| Уведомления | `enqueue-reminder` edge function → R1-R6a |
| 360-снапшоты | `meeting_360_diagnostics` → привязка (скрыта из UI) |

### Edge functions

| Функция | Назначение |
|---------|-----------|
| `enqueue-reminder` | Создание уведомлений по триггеру |
| `process-reminders` | Обработка очереди уведомлений (cron) |

---

## 17. Известные ограничения и технический долг

1. **Приватные заметки и 360-снапшоты** скрыты из UI (закомментированы в `MeetingForm`), но данные и RLS готовы
2. **Решения встречи** (`meeting_decisions`) — таблица существует, UI-компонент есть, но не подключён в текущей форме
3. **Артефакты встречи** (`MeetingArtifacts`) — компонент существует, но скрыт из UI
4. **`useOneOnOneMeetings.ts`** — 252 строки, рекомендуется рефакторинг на более мелкие хуки
5. **`MeetingsPage.tsx`** — 770 строк, содержит три вкладки с дублирующейся логикой рендеринга карточек
6. **Дублирование `getEffectiveStatus`** — логика есть и на клиенте, и в триггере; клиентская нужна как fallback до срабатывания cron
7. **Legacy-поля** в `one_on_one_meetings` (`submitted_at`, `approved_at`, `returned_at`, `return_reason`) — не используются в новом UI, сохранены для обратной совместимости
