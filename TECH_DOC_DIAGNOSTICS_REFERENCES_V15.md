# Справочники диагностики — As-Built Technical Documentation V15

> **Дата**: 2026-03-02  
> **Версия**: V15  
> **Источник**: фактический код + схема БД + RLS policies + live данные  
> **Цель**: полная прозрачная картина текущей реализации для архитектурного CR по шкалам и опросникам

---

## A. Data Model (БД)

### A.1 Иерархия компетенций

#### `category_hard_skills`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Название категории |
| description | text | YES | NULL | Описание |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true` (все видят); INSERT/UPDATE/DELETE — `admin` или `hr_bp`  
**Source**: `src/integrations/supabase/types.ts:271-293`

#### `sub_category_hard_skills`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Название |
| description | text | YES | NULL | Описание |
| category_hard_skill_id | uuid | NO | — | FK → category_hard_skills.id |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Trigger**: `validate_hard_skill_subcategory` — проверяет принадлежность подкатегории к категории  
**Trigger**: `prevent_delete_used_hard_subcategory` — запрет удаления если используется навыками  
**Source**: `types.ts:2095-2128`

#### `hard_skills`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Название навыка |
| description | text | YES | NULL | Описание |
| category_id | uuid | YES | NULL | FK → category_hard_skills.id |
| sub_category_id | uuid | YES | NULL | FK → sub_category_hard_skills.id |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Source**: `types.ts:1126-1170`

#### `category_soft_skills`
Идентичная структура `category_hard_skills`.  
**Source**: `types.ts:295-318`

#### `sub_category_soft_skills`
Идентичная `sub_category_hard_skills`, FK → `category_soft_skills.id` через `category_soft_skill_id`.  
**Trigger**: `validate_soft_skill_subcategory`  
**Source**: `types.ts:2130-2163`

#### `soft_skills`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Название качества |
| description | text | YES | NULL | Описание |
| category_id | uuid | YES | NULL | FK → category_soft_skills.id |
| sub_category_id | uuid | YES | NULL | FK → sub_category_soft_skills.id |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Source**: `types.ts:2050-2093`

### A.2 Категории и варианты ответов

#### `answer_categories`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | Название категории ответов |
| description | text | YES | NULL | Описание |
| question_type | text | YES | NULL | `'hard'`, `'soft'` или `'both'` — фильтр для UI |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Trigger**: `prevent_delete_used_answer_category` — вызывает `check_answer_category_usage()` перед DELETE  
**Live data**: 100 записей, 76 с `question_type='hard'`, 24 с `question_type='soft'`  
**Source**: `types.ts:97-123`

#### `hard_skill_answer_options`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| answer_category_id | uuid | YES | NULL | FK → answer_categories.id |
| level_value | integer | NO | 0 | Уровень (0-4 для hard) |
| numeric_value | integer | NO | — | **Canonical score для расчётов** |
| order_index | integer | NO | 0 | Порядок отображения |
| title | text | NO | — | Заголовок варианта |
| description | text | YES | NULL | Описание варианта |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Live data**: 269 записей, `numeric_value` min=0, max=4, 5 distinct values (0,1,2,3,4)  
**Source**: `types.ts:937-980`

#### `soft_skill_answer_options`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| (идентична hard_skill_answer_options) | — | — | — | — |

**Live data**: 114 записей, `numeric_value` min=0, max=5, 6 distinct values (0,1,2,3,4,5)  
**Source**: `types.ts:1848-1891`

### A.3 Вопросы

#### `hard_skill_questions`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| question_text | text | NO | — | Текст вопроса |
| skill_id | uuid | YES | NULL | FK → hard_skills.id |
| answer_category_id | uuid | YES | NULL | FK → answer_categories.id |
| order_index | integer | YES | NULL | Порядок отображения |
| visibility_restriction_enabled | boolean | YES | NULL | Включено ли ограничение |
| visibility_restriction_type | text | YES | NULL | `'self'`/`'manager'`/`'peer'` — от кого скрыть |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Live data**: 76 вопросов, 38 distinct skills  
**Source**: `types.ts:981-1031`

#### `soft_skill_questions`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| (аналогична hard_skill_questions + дополнительные) | — | — | — | — |
| quality_id | uuid | YES | NULL | FK → soft_skills.id |
| category | text | YES | NULL | Текстовая категория (legacy) |
| behavioral_indicators | text | YES | NULL | Поведенческие индикаторы |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Live data**: 24 вопроса, 12 distinct qualities  
**Source**: `types.ts:1892-1954`

### A.4 Привязка к грейдам

#### `grade_skills`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| id | uuid | NO | gen_random_uuid() | PK |
| grade_id | uuid | NO | — | FK → grades.id |
| skill_id | uuid | NO | — | FK → hard_skills.id |
| target_level | integer | NO | — | Целевой уровень |
| created_at/updated_at | timestamptz | NO | now() | — |

**RLS**: SELECT — `true`; CUD — `admin`/`hr_bp`  
**Live data**: 42 записи, 2 грейда, 38 навыков  
**Source**: `types.ts:818-859`

#### `grade_qualities`
| Поле | Тип | Nullable | Default | Описание |
|------|------|----------|---------|----------|
| (аналогична grade_skills) | — | — | — | — |
| quality_id | uuid | NO | — | FK → soft_skills.id |

**Live data**: 15 записей, 2 грейда, 12 качеств  
**Source**: `types.ts:776-817`

### A.5 ERD (текстовый)

```
category_hard_skills (1) ←── (N) sub_category_hard_skills
category_hard_skills (1) ←── (N) hard_skills
sub_category_hard_skills (1) ←── (N) hard_skills

hard_skills (1) ←── (N) hard_skill_questions
hard_skills (1) ←── (N) grade_skills
grades (1) ←── (N) grade_skills

answer_categories (1) ←── (N) hard_skill_questions
answer_categories (1) ←── (N) hard_skill_answer_options
answer_categories (1) ←── (N) soft_skill_questions
answer_categories (1) ←── (N) soft_skill_answer_options

hard_skill_questions (1) ←── (N) hard_skill_results
hard_skill_answer_options (1) ←── (N) hard_skill_results

--- Аналогично для soft ---

category_soft_skills (1) ←── (N) sub_category_soft_skills
category_soft_skills (1) ←── (N) soft_skills
sub_category_soft_skills (1) ←── (N) soft_skills

soft_skills (1) ←── (N) soft_skill_questions
soft_skills (1) ←── (N) grade_qualities
grades (1) ←── (N) grade_qualities

soft_skill_questions (1) ←── (N) soft_skill_results
soft_skill_answer_options (1) ←── (N) soft_skill_results
```

---

## B. Контракт шкал

### B.1 Фактические диапазоны (live data)

| Тип | Поле | Min | Max | Distinct | Canonical Source |
|-----|------|-----|-----|----------|-----------------|
| Hard Skills | `hard_skill_answer_options.numeric_value` | 0 | 4 | 5 (0,1,2,3,4) | БД |
| Soft Skills | `soft_skill_answer_options.numeric_value` | 0 | 5 | 6 (0,1,2,3,4,5) | БД |

### B.2 Константы в коде

**Source**: `src/lib/scoreLabels.ts:12-13`
```typescript
export const HARD_SKILLS_MAX_LEVEL = 4;
export const SOFT_SKILLS_MAX_LEVEL = 5;
```

### B.3 UI ограничения в AnswerOptionsManagement

**Source**: `src/components/admin/AnswerOptionsManagement.tsx:187-194`
- Hard: `min="0" max="4"`
- Soft: `min="0" max="5"`
- Значение `numeric_value` устанавливается равным `level_value` при создании (строка 87: `numeric_value: formData.level_value`)

### B.4 Использование в расчётах

- **Единственный source of truth для расчётов**: поле `numeric_value` из `*_answer_options`
- **Фильтрация**: `is_draft = false` AND (`is_skip IS NULL OR is_skip = false`)
- **Исключение нуля**: в `useMeeting360Attachment.ts:32` — `if (s.numeric_value === 0) return` (значение 0 исключается из средних)
- **В useCorrectAssessmentResults.ts**: `numeric_value` берётся через JOIN `*_answer_options!inner(numeric_value)`
- **В scoreLabels.ts**: label-функции используют числовые пороги, не привязанные к конкретным level_value

### B.5 Таблица конфликтов источников

| Источник | Hard Skills | Soft Skills | Статус |
|----------|-------------|-------------|--------|
| `scoreLabels.ts` constants | max=4 | max=5 | ✅ Корректно |
| `AnswerOptionsManagement.tsx` UI max | 4 | 5 | ✅ Корректно |
| `getSkillScoreLabel()` ranges | 0-5 (6 labels) | — | ⚠️ Функция поддерживает до 5, но реальный max=4 |
| `getQualityScoreLabel()` ranges | — | 0-5 (6 labels) | ✅ Корректно |
| `getScoreColor()` | Использует maxScore parameter | — | ✅ Параметризовано |
| Trigger `update_user_skills_from_survey` | `LEAST(ao.numeric_value + 1, 4)` | — | ✅ Cap at 4 |
| Trigger `update_user_qualities_from_survey` | — | `COALESCE(v_target_level, 5)` | ✅ Default max=5 |

**Вывод**: Расхождений нет. Canonical source of truth — `numeric_value` в таблицах `*_answer_options`. Код согласован.

---

## C. Опросники и версия конфигурации

### C.1 Формирование опросника

Опросник формируется **динамически** в runtime из справочников. Нет отдельной сущности "опросник" или "версия опросника".

**Алгоритм формирования** (source: `src/hooks/useSkillSurvey.ts:62-118`, `src/hooks/useSurvey360.ts:58-109`):

1. По `grade_id` пользователя → получаем `skill_id[]` из `grade_skills` (или `quality_id[]` из `grade_qualities`)
2. Фильтруем `hard_skill_questions` (или `soft_skill_questions`) по `skill_id IN (...)` 
3. Фильтруем по `visibility_restriction` на основе `respondentType`
4. Варианты ответов загружаются отдельно: `hard_skill_answer_options` / `soft_skill_answer_options` по `answer_category_id`

**В UnifiedAssessmentPage** (source: `src/pages/UnifiedAssessmentPage.tsx:401-620`):
- Загружает ВСЕ вопросы (не фильтруя по грейду) — `soft_skill_questions` и `hard_skill_questions`
- Затем фильтрует по грейду на стороне клиента через `grade_skills`/`grade_qualities`
- Варианты ответов загружаются по `answer_category_id` из вопросов

### C.2 Publish/Version/Freeze механика

**НЕТ** механизма версионирования или заморозки опросника.

- Нет таблицы `questionnaire_versions`, `questionnaire_snapshots`, etc.
- Нет поля `version` / `frozen_at` в таблицах вопросов
- Нет привязки вопросов к конкретному `diagnostic_stage_id`

### C.3 Что происходит при изменении справочника после старта этапа

| Изменение | Эффект | Риск |
|-----------|--------|------|
| Изменение текста вопроса | Новый текст будет отображаться всем, включая тех кто уже ответил | 🔴 Высокий |
| Удаление вопроса | Результаты остаются (FK на question_id), но вопрос не отображается | 🔴 Высокий |
| Добавление вопроса | Появится для тех кто ещё не ответил | 🟡 Средний |
| Изменение answer_options | Новые варианты для тех кто ещё не ответил | 🔴 Высокий |
| Изменение grade_skills/grade_qualities | Состав вопросов изменится для новых сессий | 🔴 Высокий |
| Удаление skill/quality | Cascading потеря вопросов и FK нарушения | 🔴 Критический |

### C.4 Хранение конфига (явно vs неявно)

| Сущность | Тип хранения | Описание |
|----------|-------------|----------|
| `answer_categories` + `*_answer_options` | Явный | Группы ответов с вариантами |
| `*_questions` с привязкой к `skill_id`/`quality_id` | Явный | Вопросы привязаны к компетенциям |
| `grade_skills` / `grade_qualities` | Неявный конфиг | Определяют состав опросника для грейда |
| `users.grade_id` | Неявный | Определяет какой грейд → какие вопросы |
| `visibility_restriction_*` | Явный на уровне вопроса | Фильтрация по типу респондента |

---

## D. Правила обязательности

### D.1 Обязательность ответа на вопрос

**Нет механизма обязательности ответа на уровне вопроса.**

- В таблицах `hard_skill_questions` / `soft_skill_questions` нет поля `is_required` или аналога.
- В `UnifiedAssessmentPage.tsx` (строки ~1100-1200): проверка идёт по наличию ответа ИЛИ skip-статуса. Пользователь может пропустить вопрос (is_skip=true).
- **Skip-механика**: в результатах хранится `is_skip: boolean | null` — позволяет пометить вопрос как пропущенный.

### D.2 Обязательность комментария

**Нет механизма обязательности комментария.**

- Поле `comment` в `hard_skill_results` и `soft_skill_results` — nullable text.
- В UI комментарий всегда опционален.
- Нет поля `is_comment_required` ни на уровне вопроса, ни на уровне категории.

### D.3 Уровень настройки

| Аспект | Глобально | По вопросу | По роли | Статус |
|--------|-----------|------------|---------|--------|
| Обязательность ответа | ❌ | ❌ | ❌ | Не реализовано |
| Обязательность комментария | ❌ | ❌ | ❌ | Не реализовано |
| Видимость вопроса | ❌ | ✅ | ✅ (по типу респондента) | Реализовано |

### D.4 Проверки в коде

- **UI validation** (`UnifiedAssessmentPage.tsx`): проверяет что все видимые вопросы имеют ответ или skip перед submit
- **Backend**: нет серверной валидации обязательности ответа. Trigger `update_assignment_on_survey_completion` просто обновляет статус assignment при `is_draft = false`

---

## E. Открытые вопросы

### E.1 Отдельная модель открытых вопросов

**НЕТ отдельной модели для открытых (free-text) вопросов.**

Все вопросы имеют одинаковую структуру: вопрос + привязанная категория ответов (шкала). Нет поля `question_type` в `*_questions` для обозначения вопроса как «открытого».

### E.2 Комментарии к ответам

Фактическая реализация «открытых ответов» — через поле `comment` в результатах:

| Таблица | Поле | Тип | Описание |
|---------|------|------|----------|
| `hard_skill_results` | `comment` | text, nullable | Комментарий к ответу |
| `hard_skill_results` | `is_anonymous_comment` | boolean, nullable | Анонимность |
| `soft_skill_results` | `comment` | text, nullable | Комментарий к ответу |
| `soft_skill_results` | `is_anonymous_comment` | boolean, nullable | Анонимность |

### E.3 Рендеринг и валидация

- **UI**: `src/components/assessment/CommentField.tsx` — рендерит textarea для комментария
- **Валидация**: нет валидации на содержимое/длину комментария
- **Анонимность**: `get_hard_skill_results_safe()` и `get_soft_skill_results_safe()` маскируют `evaluating_user_id` когда `is_anonymous_comment = true` и запрашивающий = evaluated user

### E.4 Влияние на отчёты/AI

- **PDF отчёт** (`useMeeting360Attachment.ts`): использует только `numeric_value`, комментарии не включаются в PDF
- **Johari AI** (`generate-johari-report` edge function): **UNKNOWN** — необходимо проверить edge function на использование comments
- **Excel export** (`exportAssessmentExcel.ts`): UNKNOWN — нужно проверить включение комментариев

---

## F. Permissions

### F.1 Матрица прав (RLS policies — фактическая)

Все справочные таблицы имеют **идентичный** паттерн RLS:

| Операция | admin | hr_bp | manager | employee |
|----------|-------|-------|---------|----------|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ❌ | ❌ |
| UPDATE | ✅ | ✅ | ❌ | ❌ |
| DELETE | ✅ | ✅ | ❌ | ❌ |

**Применяется к**: `answer_categories`, `hard_skills`, `soft_skills`, `category_hard_skills`, `category_soft_skills`, `sub_category_hard_skills`, `sub_category_soft_skills`, `hard_skill_questions`, `soft_skill_questions`, `hard_skill_answer_options`, `soft_skill_answer_options`, `grade_skills`, `grade_qualities`

**RLS policy pattern**:
```sql
-- SELECT: true (все аутентифицированные)
-- CUD: EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr_bp'))
```

**Source**: verified via `pg_policies` query (live data)

### F.2 Frontend permission checks

**Page access** (`src/pages/admin/DiagnosticsAdminPage.tsx:18-36`):
```typescript
const { hasPermission: canViewAdminPanel } = usePermission('security.view_admin_panel');
const { hasPermission: canManageParticipants } = usePermission('diagnostics.manage_participants');
// Доступ если любое из двух
```

**Внутри компонентов**: нет дополнительных permission checks. Все CUD-операции полагаются на RLS.

### F.3 Несоответствие RLS vs Frontend

| Аспект | RLS | Frontend | Статус |
|--------|-----|----------|--------|
| Кто видит справочники | Все authenticated | Все через API | ✅ Согласовано |
| Кто редактирует | admin/hr_bp | Проверка `security.view_admin_panel` / `diagnostics.manage_participants` | ⚠️ Frontend проверяет другое permission name, но RLS заблокирует запись для неавторизованных |
| Manager CUD | ❌ по RLS | ❌ нет доступа к странице | ✅ Согласовано |

---

## G. Runtime Usage Map

### G.1 Страницы

| Страница | Файл | Используемые справочники |
|----------|------|-------------------------|
| Справочники диагностики | `src/pages/admin/DiagnosticsAdminPage.tsx` | Все справочные таблицы |
| Единая оценка | `src/pages/UnifiedAssessmentPage.tsx` | `*_questions`, `*_answer_options`, `grade_skills`, `grade_qualities` |
| Результаты Hard Skills | `src/pages/SkillSurveyResultsPage.tsx` | `hard_skill_results` + joins |
| Результаты 360 | `src/pages/Survey360ResultsPage.tsx` | `soft_skill_results` + joins |
| Карьерные треки | `src/pages/DevelopmentCareerTrackPage.tsx` | `grade_skills`, `grade_qualities` |
| Профиль пользователя | `src/pages/ProfilePage.tsx` | `user_skills`, `user_qualities` |
| HR аналитика | `src/pages/HRAnalyticsPage.tsx` | Агрегации по результатам |

### G.2 Хуки

| Хук | Файл | Справочники |
|-----|------|-------------|
| `useSkillSurvey` | `src/hooks/useSkillSurvey.ts` | `hard_skill_questions`, `hard_skill_answer_options`, `grade_skills` |
| `useSurvey360` | `src/hooks/useSurvey360.ts` | `soft_skill_questions`, `soft_skill_answer_options`, `grade_qualities` |
| `useCorrectAssessmentResults` | `src/hooks/useCorrectAssessmentResults.ts` | `*_results` + `*_questions` + `*_answer_options` (numeric_value) |
| `useSkillSurveyResultsEnhanced` | `src/hooks/useSkillSurveyResultsEnhanced.ts` | `hard_skill_results` → `hard_skill_questions` → `hard_skills` |
| `useSurvey360ResultsEnhanced` | `src/hooks/useSurvey360ResultsEnhanced.ts` | `soft_skill_results` → `soft_skill_questions` → `soft_skills` |
| `useSkills` | `src/hooks/useSkills.ts` | `hard_skills` |
| `useQualities` | `src/hooks/useQualities.ts` | `soft_skills` |
| `useAnswerCategories` | `src/hooks/useAnswerCategories.ts` | `answer_categories` |
| `useMeeting360Attachment` | `src/hooks/useMeeting360Attachment.ts` | `*_results` + `*_answer_options` (numeric_value) |
| `useJohariReport` | `src/hooks/useJohariReport.ts` | `johari_ai_snapshots` |
| `useCompetencyProfile` | `src/hooks/useCompetencyProfile.ts` | `user_skills`, `user_qualities`, `grade_skills`, `grade_qualities` |

### G.3 Edge Functions

| Function | Использование справочников |
|----------|---------------------------|
| `import-diagnostics-data` | Создаёт записи в `*_questions`, `*_answer_options`, `answer_categories`, `hard_skills`/`soft_skills` |
| `import-grades-data` | Создаёт `grade_skills`, `grade_qualities`, skills/qualities |
| `generate-johari-report` | Читает результаты, использует `numeric_value` для расчётов |
| `generate-development-tasks` | Использует `grade_skills`/`grade_qualities` для gap-анализа |

### G.4 Расчёты результатов

**Основной расчёт** (source: `src/hooks/useCorrectAssessmentResults.ts`):
```
results → JOIN questions (skill_id/quality_id) → JOIN answer_options (numeric_value)
→ группировка по skill/quality → разделение по evaluator type (self/manager/peer)
→ AVG(numeric_value) per group
```

**PDF 360** (source: `src/hooks/useMeeting360Attachment.ts:20-38`):
```
scores → filter(numeric_value !== 0)
→ split by: self / manager / peer (by assignment_type)
→ AVG per group
```

### G.5 Export

| Формат | Файл | Использование шкал |
|--------|------|--------------------|
| PDF (360 отчёт) | `useMeeting360Attachment.ts` | `numeric_value`, max from `scoreLabels.ts` |
| Excel | `src/utils/exportAssessmentExcel.ts` | `numeric_value`, label lookup via `*_answer_options` |

---

## H. Backward Compatibility / Migration Readiness

### H.1 Риски изменения существующих данных

| Изменение | Влияние на `*_results` | Влияние на `user_skills/qualities` | Митигация |
|-----------|----------------------|-----------------------------------|-----------|
| Изменение `numeric_value` шкалы | Исторические results хранят `answer_option_id` (FK), а не value напрямую — пересчёт через JOIN | `current_level` пересчитывается trigger-ом | 🟡 Нужен пересчёт `user_skills`/`user_qualities` |
| Удаление answer_option | FK violation если есть results | — | 🔴 Нужна миграция |
| Реверсивная шкала | Нет поля `is_reverse` — расчёты предполагают «больше = лучше» | Все средние и GAP некорректны | 🔴 Нужна новая логика расчёта |

### H.2 Готовность к изменениям

#### H.2.1 Реверсивная шкала
**Текущее состояние**: Не поддерживается.
**Что нужно**:
1. Добавить `is_reverse: boolean default false` в `hard_skill_questions` и `soft_skill_questions`
2. Изменить все расчёты: `effective_value = is_reverse ? (max - numeric_value) : numeric_value`
3. Обновить: `useCorrectAssessmentResults.ts`, `useMeeting360Attachment.ts`, `exportAssessmentExcel.ts`, triggers `update_user_skills_from_survey` / `update_user_qualities_from_survey`
4. Исторические данные: пересчёт не нужен, т.к. `answer_option_id` хранит ссылку

#### H.2.2 Кастомные шкалы по опроснику
**Текущее состояние**: Частично реализовано через `answer_categories`.
- Каждый вопрос привязан к своей `answer_category` → свой набор `answer_options`
- Но `numeric_value` всё равно должен быть в рамках 0-4 (hard) / 0-5 (soft) для корректных расчётов
**Что нужно**:
1. Убрать хардкод max в UI (`AnswerOptionsManagement.tsx:193`)
2. Сделать max динамическим на основе `answer_category` или отдельного поля
3. Обновить `scoreLabels.ts` для динамических шкал
4. Обновить все расчёты для работы с переменным max

#### H.2.3 Обязательность комментария
**Что нужно**:
1. Добавить `is_comment_required: boolean default false` в `*_questions`
2. Фронтенд: валидация в `UnifiedAssessmentPage.tsx` перед submit
3. Опционально: DB trigger для проверки на стороне БД

#### H.2.4 Открытые вопросы
**Что нужно**:
1. Добавить `question_type: enum('scale', 'open_text')` в `*_questions`
2. Для `open_text`: результат — только `comment`, без `answer_option_id`
3. Изменить NOT NULL constraint на `answer_option_id` в `*_results` (или создать отдельную таблицу)
4. UI: рендерить textarea вместо шкалы для `open_text`

---

## I. SQL проверки (read-only)

### I.1 Текущие диапазоны numeric_value

```sql
-- Hard Skills answer options: range check
SELECT 
  ac.name as category_name,
  MIN(ao.numeric_value) as min_val,
  MAX(ao.numeric_value) as max_val,
  COUNT(*) as options_count
FROM hard_skill_answer_options ao
JOIN answer_categories ac ON ac.id = ao.answer_category_id
GROUP BY ac.name
ORDER BY ac.name;

-- Soft Skills answer options: range check
SELECT 
  ac.name as category_name,
  MIN(ao.numeric_value) as min_val,
  MAX(ao.numeric_value) as max_val,
  COUNT(*) as options_count
FROM soft_skill_answer_options ao
JOIN answer_categories ac ON ac.id = ao.answer_category_id
GROUP BY ac.name
ORDER BY ac.name;
```

### I.2 Консистентность FK

```sql
-- Вопросы без привязки к компетенции
SELECT 'hard_orphan_questions' as check_name, COUNT(*) as cnt
FROM hard_skill_questions WHERE skill_id IS NULL
UNION ALL
SELECT 'soft_orphan_questions', COUNT(*)
FROM soft_skill_questions WHERE quality_id IS NULL;

-- Вопросы без привязки к answer_category
SELECT 'hard_no_category' as check_name, COUNT(*) as cnt
FROM hard_skill_questions WHERE answer_category_id IS NULL
UNION ALL
SELECT 'soft_no_category', COUNT(*)
FROM soft_skill_questions WHERE answer_category_id IS NULL;

-- Answer categories без вариантов ответов
SELECT ac.id, ac.name, ac.question_type,
  (SELECT COUNT(*) FROM hard_skill_answer_options WHERE answer_category_id = ac.id) as hard_opts,
  (SELECT COUNT(*) FROM soft_skill_answer_options WHERE answer_category_id = ac.id) as soft_opts
FROM answer_categories ac
WHERE NOT EXISTS (SELECT 1 FROM hard_skill_answer_options WHERE answer_category_id = ac.id)
  AND NOT EXISTS (SELECT 1 FROM soft_skill_answer_options WHERE answer_category_id = ac.id);
```

### I.3 Конфликтные данные

```sql
-- numeric_value выходящие за ожидаемый диапазон
SELECT 'hard_out_of_range' as check_name, COUNT(*) 
FROM hard_skill_answer_options WHERE numeric_value < 0 OR numeric_value > 4
UNION ALL
SELECT 'soft_out_of_range', COUNT(*)
FROM soft_skill_answer_options WHERE numeric_value < 0 OR numeric_value > 5;

-- Дублирующиеся level_value в рамках одной answer_category
SELECT answer_category_id, level_value, COUNT(*) as cnt
FROM hard_skill_answer_options
GROUP BY answer_category_id, level_value
HAVING COUNT(*) > 1;

SELECT answer_category_id, level_value, COUNT(*) as cnt
FROM soft_skill_answer_options
GROUP BY answer_category_id, level_value
HAVING COUNT(*) > 1;
```

### I.4 Фактическое использование справочников в результатах

```sql
-- Какие навыки реально оценивались
SELECT hs.name, COUNT(DISTINCT hsr.id) as results_count
FROM hard_skills hs
JOIN hard_skill_questions hsq ON hsq.skill_id = hs.id
JOIN hard_skill_results hsr ON hsr.question_id = hsq.id AND hsr.is_draft = false
GROUP BY hs.name
ORDER BY results_count DESC;

-- Какие качества реально оценивались
SELECT ss.name, COUNT(DISTINCT ssr.id) as results_count
FROM soft_skills ss
JOIN soft_skill_questions ssq ON ssq.quality_id = ss.id
JOIN soft_skill_results ssr ON ssr.question_id = ssq.id AND ssr.is_draft = false
GROUP BY ss.name
ORDER BY results_count DESC;

-- Навыки в grade_skills без вопросов
SELECT gs.skill_id, hs.name as skill_name, g.name as grade_name
FROM grade_skills gs
JOIN hard_skills hs ON hs.id = gs.skill_id
JOIN grades g ON g.id = gs.grade_id
WHERE NOT EXISTS (
  SELECT 1 FROM hard_skill_questions WHERE skill_id = gs.skill_id
);

-- Качества в grade_qualities без вопросов
SELECT gq.quality_id, ss.name as quality_name, g.name as grade_name
FROM grade_qualities gq
JOIN soft_skills ss ON ss.id = gq.quality_id
JOIN grades g ON g.id = gq.grade_id
WHERE NOT EXISTS (
  SELECT 1 FROM soft_skill_questions WHERE quality_id = gq.quality_id
);
```

---

## J. GAP / Риски / Открытые вопросы

### J.1 Таблица GAP

| # | GAP | Серьёзность | Описание | Рекомендация |
|---|-----|-------------|----------|-------------|
| 1 | Нет версионирования опросника | 🔴 Высокая | Изменение справочника немедленно влияет на текущие этапы | Добавить snapshot механику при старте этапа |
| 2 | Нет обязательности ответа/комментария | 🟡 Средняя | Нет настройки per-question/per-role | Добавить поля `is_required`, `is_comment_required` |
| 3 | Нет открытых вопросов | 🟡 Средняя | Все вопросы — шкальные с опциональным комментарием | Добавить `question_type` enum |
| 4 | Нет реверсивной шкалы | 🟡 Средняя | Невозможно задать «больше = хуже» | Добавить `is_reverse` flag |
| 5 | `level_value` vs `numeric_value` дублирование | 🟢 Низкая | Оба поля всегда равны при создании | Рассмотреть удаление `level_value` или документировать разницу |
| 6 | `soft_skill_questions.category` — legacy поле | 🟢 Низкая | Текстовое поле `category`, не используемое в расчётах | Рассмотреть удаление |
| 7 | `soft_skill_questions.behavioral_indicators` — не используется | 🟢 Низкая | Nullable text, нигде не отображается в UI | Рассмотреть удаление или интеграцию |
| 8 | Нет CHECK constraint на numeric_value | 🟡 Средняя | Только UI ограничение в AnswerOptionsManagement | Добавить DB-level validation trigger |
| 9 | Фронтенд permission check не совпадает с RLS | 🟢 Низкая | Frontend: `security.view_admin_panel`, RLS: role check | RLS является надёжной защитой; frontend — UX |
| 10 | `getSkillScoreLabel()` поддерживает до 5, real max=4 | 🟢 Низкая | Лишний label «Эксперт» для hard skills | Документировать или исправить |

### J.2 Открытые вопросы для доуточнения

| # | Вопрос | Что нужно проверить |
|---|--------|---------------------|
| 1 | Включает ли Johari AI edge function комментарии из результатов? | `supabase/functions/generate-johari-report/index.ts` — нужно ревью |
| 2 | Включает ли Excel export комментарии? | `src/utils/exportAssessmentExcel.ts` — нужно ревью полного файла |
| 3 | Есть ли UNIQUE constraint на `(answer_category_id, level_value)` в `*_answer_options`? | Проверить через `pg_indexes` — в коде упоминается `duplicate` error handling |
| 4 | Есть ли orphan `answer_categories` (без привязки к вопросам)? | Запустить SQL из секции I.2 |
| 5 | Какие `question_type` допустимы — есть ли `'both'` в data? | Текущие live data показывают только `'hard'` и `'soft'` (0 'both') |
