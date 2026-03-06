# Полная спецификация системы диагностики и встреч 1:1

**Версия:** 2.0  
**Дата обновления:** Январь 2025

---

## Содержание

1. [Архитектура системы этапов](#1-архитектура-системы-этапов)
2. [Модуль диагностики компетенций](#2-модуль-диагностики-компетенций)
3. [Модуль встреч 1:1](#3-модуль-встреч-11)
4. [Автоматическая деактивация этапов](#4-автоматическая-деактивация-этапов)
5. [Используемые таблицы](#5-используемые-таблицы)
6. [Edge Functions](#6-edge-functions)
7. [Страницы и компоненты](#7-страницы-и-компоненты)
8. [Хуки](#8-хуки)

---

## 1. Архитектура системы этапов

### Иерархия этапов

```
parent_stages (Родительский этап)
    ├── diagnostic_stages (Подэтап диагностики)
    │       └── diagnostic_stage_participants (Участники)
    │               └── survey_360_assignments (Назначения)
    │                       └── soft_skill_results / hard_skill_results (Результаты)
    │
    └── meeting_stages (Подэтап встреч 1:1)
            └── meeting_stage_participants (Участники)
                    └── one_on_one_meetings (Встречи)
                            └── meeting_decisions (Решения)
```

### Создание этапов

**Страница:** `/admin/stages`  
**Компонент:** `src/components/UnifiedStagesManager.tsx`  
**Диалог создания:** `src/components/stages/CreateStageDialog.tsx`

**Процесс:**
1. HR/Администратор создает родительский этап (`parent_stages`) с указанием:
   - Период (например, "Q1 2025")
   - Дата начала (`start_date`)
   - Дата окончания (`end_date`)
   - Крайний срок (`deadline_date`)
2. Опционально создаются подэтапы:
   - Диагностика (`diagnostic_stages`)
   - Встречи 1:1 (`meeting_stages`)

---

## 2. Модуль диагностики компетенций

### 2.1. Полный флоу диагностики

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ФЛОУ ДИАГНОСТИКИ КОМПЕТЕНЦИЙ                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. СОЗДАНИЕ ЭТАПА (HR/Admin)                                               │
│     └── CreateStageDialog → parent_stages + diagnostic_stages               │
│                                                                              │
│  2. ДОБАВЛЕНИЕ УЧАСТНИКОВ (HR/Admin)                                        │
│     └── AddParticipantsDialog → diagnostic_stage_participants               │
│         └── Триггер: create-peer-selection-task-on-participant-add          │
│             └── Создаёт task (task_type: 'peer_selection')                  │
│         └── Автоматически: survey_360_assignments (self + manager)          │
│                                                                              │
│  3. ВЫБОР РЕСПОНДЕНТОВ (Сотрудник)                                          │
│     └── ColleagueSelectionDialog                                            │
│         └── survey_360_assignments (peer, status: 'pending')                │
│         └── Завершает task 'peer_selection'                                 │
│         └── Вызывает create-peer-approval-task для руководителя             │
│                                                                              │
│  4. СОГЛАСОВАНИЕ РЕСПОНДЕНТОВ (Руководитель)                                │
│     └── ManagerRespondentApproval                                           │
│         └── Обновляет survey_360_assignments (status: 'approved'/'rejected')│
│         └── Вызывает create-peer-evaluation-tasks                           │
│             └── Создаёт tasks для утвержденных респондентов                 │
│         └── Завершает task 'peer_approval'                                  │
│                                                                              │
│  5. ПРОХОЖДЕНИЕ ОЦЕНКИ (Все участники)                                      │
│     └── UnifiedAssessmentPage                                               │
│         └── Автосохранение ответов (is_draft: true)                        │
│         └── soft_skill_results / hard_skill_results                         │
│                                                                              │
│  6. ЗАВЕРШЕНИЕ ОЦЕНКИ                                                       │
│     └── AssessmentCompletedPage                                             │
│         └── Обновляет results (is_draft: false)                            │
│         └── survey_360_assignments (status: 'completed')                    │
│         └── tasks (status: 'completed')                                     │
│                                                                              │
│  7. ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ                                                 │
│     └── RadarChartResults / ProfileAggregatedResults                        │
│         └── Агрегация по типам оценщиков (self/manager/peer)               │
│                                                                              │
│  8. АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ ЭТАПА                                         │
│     └── check_and_deactivate_expired_stages()                               │
│         └── deadline_date < current_date → is_active = false               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Таблицы диагностики

#### `diagnostic_stages`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| parent_id | UUID | Ссылка на parent_stages |
| created_by | UUID | Создатель |
| status | TEXT | Статус этапа |
| is_active | BOOLEAN | Активен ли этап |
| progress_percent | NUMERIC | Процент выполнения |
| evaluation_period | TEXT | Период оценки |

#### `diagnostic_stage_participants`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| stage_id | UUID | Ссылка на diagnostic_stages |
| user_id | UUID | ID участника |
| created_at | TIMESTAMP | Дата добавления |

#### `survey_360_assignments`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| evaluated_user_id | UUID | Оцениваемый |
| evaluating_user_id | UUID | Оценивающий |
| diagnostic_stage_id | UUID | Этап диагностики |
| assignment_type | TEXT | Тип: 'self', 'manager', 'peer' |
| status | TEXT | 'pending', 'approved', 'rejected', 'completed' |
| is_manager_participant | BOOLEAN | Является ли руководителем |
| added_by_manager | BOOLEAN | Добавлен руководителем |

#### `soft_skill_results` / `hard_skill_results`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| evaluated_user_id | UUID | Оцениваемый |
| evaluating_user_id | UUID | Оценивающий |
| question_id | UUID | ID вопроса |
| answer_option_id | UUID | ID выбранного ответа |
| assignment_id | UUID | Ссылка на назначение |
| diagnostic_stage_id | UUID | Этап |
| is_draft | BOOLEAN | Черновик или финал |
| is_skip | BOOLEAN | Пропущен ли вопрос |
| comment | TEXT | Комментарий |
| is_anonymous_comment | BOOLEAN | Анонимный комментарий |

### 2.3. Типы задач диагностики

| task_type | Описание | Создаётся когда |
|-----------|----------|-----------------|
| `peer_selection` | Выбор респондентов | При добавлении участника в этап |
| `peer_approval` | Согласование списка | Сотрудник отправил список |
| `survey_360_evaluation` | Прохождение опроса | Респонденты утверждены |

---

## 3. Модуль встреч 1:1

### 3.1. Полный флоу встреч 1:1

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ФЛОУ ВСТРЕЧ 1:1                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. СОЗДАНИЕ ЭТАПА ВСТРЕЧ (HR/Admin)                                        │
│     └── CreateStageDialog → meeting_stages (parent_id → parent_stages)      │
│                                                                              │
│  2. ДОБАВЛЕНИЕ УЧАСТНИКОВ (HR/Admin)                                        │
│     └── AddParticipantsDialog → meeting_stage_participants                  │
│                                                                              │
│  3. СОЗДАНИЕ ВСТРЕЧИ (Сотрудник)                                            │
│     └── MeetingsPage → handleCreateMeeting                                  │
│         └── one_on_one_meetings (status: 'draft')                          │
│         └── Проверки:                                                       │
│             - Есть активный этап                                            │
│             - Пользователь является участником                              │
│             - У пользователя есть руководитель                              │
│                                                                              │
│  4. ЗАПОЛНЕНИЕ ФОРМЫ (Сотрудник)                                            │
│     └── MeetingForm                                                         │
│         └── Поля:                                                           │
│             - meeting_date (дата встречи)                                   │
│             - goal_and_agenda (цель и повестка)                            │
│             - energy_gained (что даёт энергию)                             │
│             - energy_lost (что забирает энергию)                           │
│             - stoppers (стопперы)                                          │
│             - previous_decisions_debrief (разбор прошлых решений)          │
│         └── meeting_decisions (принятые решения)                           │
│                                                                              │
│  5. ОТПРАВКА НА СОГЛАСОВАНИЕ (Сотрудник)                                    │
│     └── MeetingForm → handleSubmitForApproval                               │
│         └── one_on_one_meetings (status: 'submitted', submitted_at: now())  │
│                                                                              │
│  6. РАССМОТРЕНИЕ (Руководитель)                                             │
│     └── MeetingsPage → вкладка "Встречи подчинённых"                        │
│         └── MeetingForm (isManager: true)                                   │
│             └── Опции:                                                      │
│                 a) СОГЛАСОВАТЬ → status: 'approved', approved_at: now()     │
│                 b) ВЕРНУТЬ → status: 'returned', return_reason, returned_at │
│                                                                              │
│  7a. ПРИ СОГЛАСОВАНИИ                                                       │
│      └── Встреча завершена                                                  │
│      └── Решения сохраняются для следующей встречи                          │
│                                                                              │
│  7b. ПРИ ВОЗВРАТЕ                                                           │
│      └── Сотрудник видит причину возврата (return_reason)                   │
│      └── Может редактировать и повторно отправить                           │
│                                                                              │
│  8. ПРОСМОТР РЕШЕНИЙ ПРЕДЫДУЩЕЙ ВСТРЕЧИ                                     │
│     └── useMeetingDecisions → previousDecisions                             │
│         └── Загружает решения из предыдущей approved встречи                │
│                                                                              │
│  9. АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ ЭТАПА                                         │
│     └── check_and_deactivate_expired_stages()                               │
│         └── deadline_date < current_date → is_active = false               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Таблицы встреч 1:1

#### `meeting_stages`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| parent_id | UUID | Ссылка на parent_stages |
| created_by | UUID | Создатель |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

#### `meeting_stage_participants`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| stage_id | UUID | Ссылка на meeting_stages |
| user_id | UUID | ID участника |
| created_at | TIMESTAMP | Дата добавления |

#### `one_on_one_meetings`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| stage_id | UUID | Этап встреч |
| employee_id | UUID | ID сотрудника |
| manager_id | UUID | ID руководителя |
| status | TEXT | 'draft', 'submitted', 'approved', 'returned' |
| meeting_date | DATE | Дата встречи |
| goal_and_agenda | TEXT | Цель и повестка |
| energy_gained | TEXT | Что даёт энергию |
| energy_lost | TEXT | Что забирает энергию |
| stoppers | TEXT | Стопперы |
| previous_decisions_debrief | TEXT | Разбор прошлых решений |
| manager_comment | TEXT | Комментарий руководителя |
| return_reason | TEXT | Причина возврата |
| submitted_at | TIMESTAMP | Дата отправки |
| approved_at | TIMESTAMP | Дата согласования |
| returned_at | TIMESTAMP | Дата возврата |

#### `meeting_decisions`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| meeting_id | UUID | Ссылка на встречу |
| decision_text | TEXT | Текст решения |
| is_completed | BOOLEAN | Выполнено ли |
| created_by | UUID | Кто создал |
| created_at | TIMESTAMP | Дата создания |

### 3.3. Статусы встречи

| Статус | Описание | Кто может изменить |
|--------|----------|-------------------|
| `draft` | Черновик, можно редактировать | Сотрудник |
| `submitted` | Отправлено руководителю | Руководитель |
| `approved` | Согласовано | Финальный статус |
| `returned` | Возвращено на доработку | Сотрудник может редактировать |

---

## 4. Автоматическая деактивация этапов

### Механизм

Функция `check_and_deactivate_expired_stages()` выполняется при каждом запросе списка этапов:

```sql
-- Псевдокод функции
UPDATE parent_stages 
SET is_active = false 
WHERE deadline_date < CURRENT_DATE AND is_active = true;

UPDATE diagnostic_stages ds
SET is_active = false
FROM parent_stages ps
WHERE ds.parent_id = ps.id AND ps.is_active = false;
```

### Визуальное отображение

- Активный этап: бейдж "Активен" (зелёный)
- Завершённый этап: бейдж "Завершен" (серый)
- Участники могут видеть результаты после завершения этапа

---

## 5. Используемые таблицы (сводная)

### Родительские этапы
| Таблица | Описание |
|---------|----------|
| `parent_stages` | Основные этапы с датами и дедлайнами |

### Диагностика
| Таблица | Описание |
|---------|----------|
| `diagnostic_stages` | Подэтапы диагностики |
| `diagnostic_stage_participants` | Участники диагностики |
| `survey_360_assignments` | Назначения на оценку |
| `soft_skill_results` | Результаты по soft-навыкам |
| `hard_skill_results` | Результаты по hard-навыкам |
| `soft_skill_questions` | Вопросы по soft-навыкам |
| `hard_skill_questions` | Вопросы по hard-навыкам |
| `soft_skill_answer_options` | Варианты ответов (soft) |
| `hard_skill_answer_options` | Варианты ответов (hard) |

### Встречи 1:1
| Таблица | Описание |
|---------|----------|
| `meeting_stages` | Подэтапы встреч |
| `meeting_stage_participants` | Участники встреч |
| `one_on_one_meetings` | Записи встреч |
| `meeting_decisions` | Решения встреч |

### Задачи
| Таблица | Описание |
|---------|----------|
| `tasks` | Все задачи системы |

---

## 6. Edge Functions

### `create-peer-selection-task-on-participant-add`

**Триггер:** Добавление участника в диагностический этап  
**Действие:** Создаёт задачу "Выбрать респондентов"

```typescript
{
  user_id: userId,
  diagnostic_stage_id: diagnosticStageId,
  title: 'Выбрать респондентов',
  task_type: 'peer_selection',
  priority: 'urgent',
  category: 'assessment'
}
```

### `create-peer-approval-task`

**Триггер:** Сотрудник отправил список респондентов  
**Действие:** Создаёт задачу для руководителя на согласование

### `create-peer-evaluation-tasks`

**Триггер:** Руководитель утвердил респондентов  
**Действие:** Создаёт задачи для каждого утверждённого респондента

```typescript
{
  user_id: evaluating_user_id,
  assignment_id: assignment.id,
  assignment_type: 'peer',
  title: `Обратная связь для коллеги: ${evaluatedUserName}`,
  task_type: 'survey_360_evaluation',
  category: 'assessment'
}
```

---

## 7. Страницы и компоненты

### Страницы

| Страница | Путь | Описание |
|----------|------|----------|
| `DevelopmentPage` | `/development` | Главная страница развития |
| `Survey360Page` | `/survey360` | Страница опроса 360° |
| `SkillSurveyPage` | `/skill-survey` | Страница оценки навыков |
| `UnifiedAssessmentPage` | `/assessment/:assignmentId` | Форма прохождения оценки |
| `AssessmentCompletedPage` | `/assessment/completed` | Страница завершения оценки |
| `MeetingsPage` | `/meetings` | Страница встреч 1:1 |
| `StagesPage` | `/admin/stages` | Управление этапами (админ) |

### Компоненты

| Компонент | Файл | Описание |
|-----------|------|----------|
| `UnifiedStagesManager` | `src/components/UnifiedStagesManager.tsx` | Менеджер этапов |
| `CreateStageDialog` | `src/components/stages/CreateStageDialog.tsx` | Создание этапа |
| `AddParticipantsDialog` | `src/components/stages/AddParticipantsDialog.tsx` | Добавление участников |
| `DiagnosticStepper` | `src/components/DiagnosticStepper.tsx` | Степпер прогресса диагностики |
| `SurveyAccessWidget` | `src/components/SurveyAccessWidget.tsx` | Виджет доступа к опросам |
| `ColleagueSelectionDialog` | `src/components/ColleagueSelectionDialog.tsx` | Выбор респондентов |
| `ManagerRespondentApproval` | `src/components/ManagerRespondentApproval.tsx` | Согласование респондентов |
| `MeetingForm` | `src/components/MeetingForm.tsx` | Форма встречи 1:1 |
| `RadarChartResults` | `src/components/RadarChartResults.tsx` | Радар-диаграмма результатов |

---

## 8. Хуки

### Диагностика

| Хук | Файл | Описание |
|-----|------|----------|
| `useParentStages` | `src/hooks/useParentStages.ts` | CRUD для parent_stages |
| `useDiagnosticStages` | `src/hooks/useDiagnosticStages.ts` | CRUD для diagnostic_stages |
| `useDiagnosticStageParticipants` | `src/hooks/useDiagnosticStageParticipants.ts` | Проверка участия в этапе |
| `useSurvey360Assignments` | `src/hooks/useSurvey360Assignments.ts` | Назначения на оценку |
| `useSurvey360Results` | `src/hooks/useSurvey360Results.ts` | Результаты оценки |
| `useCorrectAssessmentResults` | `src/hooks/useCorrectAssessmentResults.ts` | Агрегированные результаты |

### Встречи 1:1

| Хук | Файл | Описание |
|-----|------|----------|
| `useMeetingStages` | `src/hooks/useMeetingStages.ts` | CRUD для meeting_stages |
| `useOneOnOneMeetings` | `src/hooks/useOneOnOneMeetings.ts` | CRUD для встреч |
| `useMeetingDecisions` | `src/hooks/useMeetingDecisions.ts` | CRUD для решений встреч |

### Общие

| Хук | Файл | Описание |
|-----|------|----------|
| `useTasks` | `src/hooks/useTasks.ts` | Задачи пользователя |
| `useAssignmentDraftStatus` | `src/hooks/useAssignmentDraftStatus.ts` | Проверка черновиков |

---

## Приложение A: Диаграмма состояний survey_360_assignments

```
                    ┌──────────────┐
                    │   СОЗДАНИЕ   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   pending    │◄────────────────────┐
                    └──────┬───────┘                     │
                           │                             │
          ┌────────────────┼────────────────┐            │
          ▼                ▼                ▼            │
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
   │   approved   │ │   rejected   │ │    draft     │    │
   └──────┬───────┘ └──────────────┘ └──────────────┘    │
          │                                    │         │
          │                                    └─────────┘
          ▼                                   (повторная отправка)
   ┌──────────────┐
   │  completed   │
   └──────────────┘
```

---

## Приложение B: Диаграмма состояний one_on_one_meetings

```
                    ┌──────────────┐
                    │   СОЗДАНИЕ   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    draft     │◄────────────────────┐
                    └──────┬───────┘                     │
                           │ (отправка)                  │
                           ▼                             │
                    ┌──────────────┐                     │
                    │  submitted   │                     │
                    └──────┬───────┘                     │
                           │                             │
          ┌────────────────┴────────────────┐            │
          ▼                                 ▼            │
   ┌──────────────┐                  ┌──────────────┐    │
   │   approved   │                  │   returned   │────┘
   └──────────────┘                  └──────────────┘
   (финальный статус)                (причина возврата)
```

---

## Приложение C: SQL-запросы для диагностики

### Получить всех участников активного этапа диагностики

```sql
SELECT u.id, u.first_name, u.last_name, u.email
FROM diagnostic_stage_participants dsp
JOIN diagnostic_stages ds ON dsp.stage_id = ds.id
JOIN users u ON dsp.user_id = u.id
WHERE ds.is_active = true;
```

### Получить назначения пользователя в активном этапе

```sql
SELECT sa.*
FROM survey_360_assignments sa
JOIN diagnostic_stages ds ON sa.diagnostic_stage_id = ds.id
WHERE ds.is_active = true
  AND sa.evaluated_user_id = 'USER_ID';
```

### Проверить статус прохождения оценки

```sql
SELECT 
  sa.id,
  sa.assignment_type,
  sa.status,
  COUNT(DISTINCT ssr.question_id) as soft_answered,
  COUNT(DISTINCT hsr.question_id) as hard_answered
FROM survey_360_assignments sa
LEFT JOIN soft_skill_results ssr ON sa.id = ssr.assignment_id AND ssr.is_draft = false
LEFT JOIN hard_skill_results hsr ON sa.id = hsr.assignment_id AND hsr.is_draft = false
WHERE sa.evaluated_user_id = 'USER_ID'
GROUP BY sa.id, sa.assignment_type, sa.status;
```

---

*Документация актуальна на январь 2025 года. При внесении изменений в систему обновляйте соответствующие разделы.*
