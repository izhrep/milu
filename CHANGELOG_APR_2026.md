# Changelog — апрель 2026

Сводный отчёт изменений в проекте Milu с 7 апреля 2026.
Источники: SQL-миграции (`supabase/migrations/`), правки фронтенда, сессии работы с AI.

---

## 7 апреля — Жизненный цикл задач 1:1

**Миграция:** `20260407064706_*.sql`

- Расширен список статусов в `tasks`: добавлены `expired` и `closed`.
- Это позволило корректно автозакрывать связанные задачи при удалении/завершении встреч 1:1 (scheduled, fill_summary, review_summary).

**Зачем:** до этого задачи «зависали» в `pending` после удаления встречи или после автозакрытия по сроку.

---

## 8 апреля — Атомарный перенос встреч (reschedule)

**Миграция:** `20260408114106_*.sql`

- Реализован/доработан RPC `reschedule_meeting_silent` (SECURITY DEFINER).
- Добавлена проверка конфликтов участников через `_conflict_exists`.
- Введены типизированные коды ошибок: `NOT_FOUND`, `FORBIDDEN`, `PAST_DATE`, `CONFLICT`.
- Роли `admin` выдано право `meetings.edit_summary_date`.

**Зачем:** до этого перенос делался несколькими отдельными запросами, что приводило к гонкам и неконсистентным состояниям.

---

## 9 апреля — Аудит статусов и автоочистка задач

**Миграции:** `20260409062807_*`, `20260409064030_*`, `20260409064932_*`, `20260409115020_*`, `20260409133838_*.sql`

- Создана таблица `meeting_status_events` и триггер для логирования всех переходов статуса встречи.
- Триггер `cleanup_meeting_tasks_on_delete` теперь автоматически закрывает связанные задачи (`scheduled`, `fill_summary`, `review_summary`) при удалении встречи.
- Дополнительные правки RLS и прав на `one_on_one_meetings` для HRBP/Admin.

**Зачем:** прозрачная история изменения статусов встреч + чистка зависших задач у пользователей.

---

## 13 апреля — Обсуждение итогов встречи (thread)

**Миграция:** `20260413105954_*.sql`

- Создана таблица `meeting_summary_comments` для мессенджер-стиля обсуждения под итогами 1:1.
- Настроены RLS-политики:
  - участники встречи (employee + manager) могут читать/писать;
  - вышестоящие менеджеры (subtree) — read-only;
  - HRBP/Admin — полный доступ.
- На фронте: `MeetingSummaryThread.tsx`, хук `useMeetingSummaryThread.ts`.

**Зачем:** разделить «зафиксированные итоги» (нельзя править после следующей встречи) и «живое обсуждение уточнений».

---

## 16 апреля — QA-фиксы по итогам встреч и таймзоны

### 16.04 (раннее) — Часовые пояса Europe/CIS

**Миграция:** `20260416124835_*.sql`
**Файлы:** `src/lib/timezoneOptions.ts`, `src/contexts/AuthContext.tsx`, форма создания/редактирования пользователя

- Расширен список таймзон: Россия, СНГ, Европа.
- DST-aware label'ы (зимнее/летнее время для Europe/Berlin, Europe/Paris и т.д.).
- В `users` добавлен флаг `timezone_manual` — если админ задал вручную, автодетект при логине НЕ перезаписывает значение.
- Добавлены тесты на DST в `tests/timezoneOptions.test.ts`.

**Зачем:** корректное отображение времени встреч для распределённых команд.

### 16.04 (вечер) — Защита итогов встречи и оригинальное авторство

**Миграция:** `20260416125852_*.sql`
**Файлы:** `src/components/MeetingForm.tsx`, `src/components/MeetingSummaryHistory.tsx`, `src/pages/MeetingsMonitoringPage.tsx`

Исправлены 3 Failed-пункта QA + 1 регрессионный баг:

1. **Автор может редактировать свой итог** до появления следующей встречи для пары `employee_id + manager_id` (триггер `protect_meeting_summary`, проверка `NOT EXISTS next meeting`).
2. **Вкладка «История итогов»** переписана: фильтр по паре участников, сортировка по `meeting_date`, упрощённое свёрнутое отображение. Счётчик в бейдже синхронизирован с табом.
3. **Мониторинг 1:1**: статус «Ознакомлен / Не просмотрено» теперь показывается для всех строк с сохранённым итогом, а не только для статуса `ok`.
4. **Регрессия HR-редактирования**: триггер `protect_meeting_summary` теперь сохраняет оригинальные `summary_saved_by` и `summary_saved_at` при правках от HR/Admin. Раньше после правки HR блок «Итоги встречи» становился пустым у автора, потому что он терял авторство. Оптимистичное обновление в `MeetingForm.tsx` тоже сохраняет исходного автора.

---

## Сводная таблица изменённых компонентов

| Область | Файлы / Миграции |
|---|---|
| БД: статусы задач | `tasks.status` enum |
| БД: перенос встреч | RPC `reschedule_meeting_silent`, `_conflict_exists` |
| БД: аудит | `meeting_status_events` + триггер |
| БД: автоочистка | `cleanup_meeting_tasks_on_delete` |
| БД: обсуждение | `meeting_summary_comments` + RLS |
| БД: защита итогов | `protect_meeting_summary` v1 → v3 |
| БД: таймзоны | `users.timezone_manual` |
| Фронт: форма встречи | `src/components/MeetingForm.tsx` |
| Фронт: история итогов | `src/components/MeetingSummaryHistory.tsx` |
| Фронт: мониторинг | `src/pages/MeetingsMonitoringPage.tsx` |
| Фронт: thread | `src/components/MeetingSummaryThread.tsx`, `src/hooks/useMeetingSummaryThread.ts` |
| Фронт: таймзоны | `src/lib/timezoneOptions.ts`, `src/contexts/AuthContext.tsx` |
| Тесты | `tests/timezoneOptions.test.ts`, `tests/meetingDateTime.test.ts` |

---

## Полный список миграций с 7 апреля

```
20260407064706 — task lifecycle (expired/closed)
20260408114106 — reschedule_meeting_silent + conflict checks
20260409062807 — meeting_status_events table
20260409064030 — status transition trigger
20260409064932 — cleanup_meeting_tasks_on_delete
20260409115020 — RLS adjustments meetings
20260409133838 — admin permission meetings.edit_summary_date
20260413105954 — meeting_summary_comments + RLS
20260416124835 — users.timezone_manual + Europe/CIS support
20260416125852 — protect_meeting_summary v3 (preserve original author)
```

---

_Дата генерации отчёта: 17 апреля 2026._
