# Технический отчёт: FreezeConfig — анализ текущей реализации

**Дата:** 2026-03-12  
**Scope:** Точечный анализ механизма FreezeConfig как первого шага к ретроспективности

---

## 1. Executive Summary

**FreezeConfig** — механизм snapshot'а конфигурации шаблона (шкалы, лейблы, правила Johari, правила комментариев) в JSONB-колонку `frozen_config` таблицы `diagnostic_stages`. Цель — зафиксировать конфигурацию в момент запуска этапа, чтобы последующие изменения шаблона не влияли на уже начавшийся этап.

### Работает ли сейчас?

**НЕТ.** Freeze триггер никогда не срабатывает в текущем production-потоке. Это подтверждается:

- В БД **0 из 1** записи `diagnostic_stages` имеют `frozen_config` (запрос: `SELECT COUNT(*) ... WHERE frozen_config IS NOT NULL` = 0).
- Единственная существующая запись имеет `status = 'upcoming'`, `has_frozen = false`.

### Можно ли починить хирургически?

**ДА**, с одной точечной правкой в триггер-функции: заменить условие `NEW.status = 'active'` на альтернативный trigger point. Scope fix'а ограничен — одна SQL-функция + одно условие.

### Хватит ли freeze для полной ретроспективности?

**НЕТ.** FreezeConfig покрывает только конфигурацию шкал/правил. Он НЕ решает: stage-scoped uniqueness результатов, destructive deletes в legacy-хуках, зависимость агрегатов от live answer_options, зависимость отчётов от live названий компетенций.

---

## 2. Current State

### 2.1 Где определён `frozen_config`

| Артефакт | Описание |
|----------|----------|
| `migrations/20260305_diagnostic_config_templates.sql:71` | `ADD COLUMN IF NOT EXISTS frozen_config jsonb` на `diagnostic_stages` |
| `src/integrations/supabase/types.ts:773` | Типизирован как `Json \| null` |
| Реальная БД | Колонка существует, тип `jsonb`, default `NULL` |

### 2.2 Trigger — где и как должен срабатывать

**Триггер:** `freeze_config_on_stage_activation` (BEFORE UPDATE на `diagnostic_stages`)

**Функция:** `freeze_template_config_on_activation()`

**Условия срабатывания freeze (строка 176-179 миграции `20260305`):**

```sql
IF NEW.status = 'active'
   AND (OLD.status IS DISTINCT FROM 'active')
   AND NEW.config_template_id IS NOT NULL
   AND NEW.frozen_config IS NULL
```

### 2.3 Рассинхронизация lifecycle — КОРНЕВАЯ ПРИЧИНА

**Факт 1:** Триггер ожидает `status = 'active'`.

**Факт 2:** Реальные статусы `diagnostic_stages` устанавливаются триггером `set_diagnostic_stage_status()` при INSERT:

- Он вычисляет статус через `get_stage_status_by_dates(start_date, end_date)`:
  - `CURRENT_DATE < start_date` → **`'upcoming'`**
  - `start_date <= CURRENT_DATE <= end_date` → **`'active'`**
  - `CURRENT_DATE > end_date` → **`'completed'`**

**Факт 3:** `set_diagnostic_stage_status` — это **BEFORE INSERT** trigger. Он работает только при создании. Нет триггера, который пересчитывает status при изменении дат или при наступлении start_date.

**Факт 4:** `freeze_config_on_stage_activation` — это **BEFORE UPDATE** trigger. Он ожидает UPDATE с переходом status в 'active'.

**Вывод:** Если этап создан ДО даты начала (что является стандартным сценарием — `CreateStageDialog` создаёт этап заранее), он получает `status = 'upcoming'` при INSERT. Далее **никакой механизм** не переводит его в `status = 'active'`. Следовательно, freeze trigger **никогда не срабатывает**.

**Дополнительная проверка:** Даже если этап создан в день `start_date` и получит `status = 'active'` при INSERT, freeze trigger на BEFORE UPDATE всё равно не сработает, потому что INSERT — это не UPDATE.

**Итог: FreezeConfig полностью мёртв в текущем lifecycle.**

### 2.4 Immutability guard

Работает корректно по дизайну: если `frozen_config` уже установлен, любая попытка его изменить вызовет `RAISE EXCEPTION 'frozen_config is immutable once set'`. Но так как freeze никогда не создаёт `frozen_config`, этот guard никогда не проверяется.

### 2.5 Реальное использование в приложении

| Потребитель | Файл | Что делает | Использует frozen? |
|-------------|-------|------------|-------------------|
| `useStageTemplateConfig` | `src/hooks/useStageTemplateConfig.ts` | Резолвит: `frozen_config → live template → legacy defaults` | Да, но frozen всегда NULL, поэтому всегда fallback |
| `UnifiedAssessmentPage` | `src/pages/UnifiedAssessmentPage.tsx:84` | Использует `stageConfig.hardSkillsEnabled` для toggle hard skills | Транзитивно через useStageTemplateConfig — fallback |
| `SkillSurveyQuestionsPage` | `src/pages/SkillSurveyQuestionsPage.tsx:56` | Использует stageConfig | Транзитивно — fallback |

**Вывод:** `useStageTemplateConfig` реально используется на 2 страницах оценки. Resolution chain корректна по дизайну. Но поскольку `frozen_config` всегда NULL, хук ВСЕГДА идёт по fallback: live template → legacy defaults. Frozen path никогда не активируется.

### 2.6 Все триггеры на `diagnostic_stages`

| Trigger | Timing | Описание |
|---------|--------|----------|
| `trigger_set_diagnostic_stage_status` | BEFORE INSERT | Вычисляет status по датам parent_stages. Только INSERT. |
| `freeze_config_on_stage_activation` | BEFORE UPDATE | Ожидает `status='active'`. Никогда не срабатывает. |
| `log_diagnostic_stage_changes_trigger` | AFTER INSERT OR UPDATE | Логирует изменения в admin_activity_logs. |
| `set_diagnostic_evaluation_period` | BEFORE INSERT | Устанавливает `evaluation_period`. |
| `update_diagnostic_stages_updated_at` | BEFORE UPDATE | Обновляет `updated_at`. |

### 2.7 Как управляется lifecycle этапа

| Механизм | Что делает | Таблица | Timing |
|----------|-----------|---------|--------|
| `set_diagnostic_stage_status()` | Вычисляет `status` по датам parent | `diagnostic_stages` | BEFORE INSERT |
| `parent_stages.is_active` | Boolean, default true | `parent_stages` | При создании |
| `finalize_expired_stage()` | Ставит `is_active = false` каскадно | `parent_stages` → `diagnostic_stages` | pg_cron каждые 5 мин |
| `reopen_expired_stage()` | Ставит `is_active = true` каскадно | Обратная операция | Ручной вызов |
| UI (`UnifiedStagesManager`) | Фильтрует по `is_active` | — | Визуальный |
| UI (`DiagnosticStepper`) | Показывает `status` как шаг | — | Визуальный |

**Ключевой вывод:** `status` (`upcoming`/`active`/`completed`) — это pseudo-computed значение, вычисленное один раз при INSERT и никогда не обновляемое. Реальное управление lifecycle идёт через `is_active` (boolean) на уровне `parent_stages`.

---

## 3. What FreezeConfig Should Do (целевой контракт)

### 3.1 Что должен замораживать

| Сущность | Включать в snapshot? | Почему |
|----------|---------------------|--------|
| Параметры шкалы (hard/soft min/max/reversed) | **ДА** | Определяют интерпретацию баллов |
| Текстовые лейблы уровней (template_scale_labels) | **ДА** | Используются в UI/отчётах |
| `hard_skills_enabled` | **ДА** | Определяет scope оценки |
| Правила комментариев (`comment_rules`) | **ДА** | Определяют обязательность полей |
| Правила Johari (`johari_rules`) | **ДА** | Определяют пороги зон |
| Открытые вопросы config (`open_questions_config`) | **ДА** | Определяют набор OQ |
| Имя и версия шаблона | **ДА** | Для трассировки |

### 3.2 Что НЕ должен замораживать

| Сущность | Почему |
|----------|--------|
| Список участников (`diagnostic_stage_participants`) | Участники добавляются после запуска — mutable |
| Даты этапа (`parent_stages.start_date/end_date`) | Могут продлеваться — mutable |
| Напоминания (`reminder_date`) | Operational — mutable |
| Набор вопросов/компетенций (`hard_skill_questions`, `soft_skill_questions`) | Отдельный трек историзации, не входит в template config |
| Answer options (варианты ответов) | Не входят в template config, зависят от `answer_categories` — отдельный трек |

### 3.3 Когда должен срабатывать

**Рекомендуемый trigger point:** при INSERT в `diagnostic_stages`, если `config_template_id IS NOT NULL`.

**Обоснование:**

- Этап создаётся с выбранным шаблоном → конфигурация фиксируется сразу
- Не зависит от status / is_active / lifecycle
- Immutability guard уже защищает от повторной записи
- `CreateStageDialog` передаёт `config_template_id` при создании — это единственная точка привязки шаблона к этапу

**Альтернативный trigger point (если нужна отложенная заморозка):** при первом INSERT в `diagnostic_stage_participants` (добавление первого участника). Но это сложнее в реализации и не даёт преимуществ, т.к. шаблон уже привязан при создании.

### 3.4 Write guard

**Рекомендуется:** НЕ блокировать write-path (оценку) при отсутствии `frozen_config`. Freeze — механизм историзации конфигурации. Оценка должна работать и без него (legacy mode). `useStageTemplateConfig` уже корректно обрабатывает fallback.

### 3.5 Template mode vs Legacy mode

| Режим | `config_template_id` | Поведение freeze |
|-------|---------------------|------------------|
| Template | NOT NULL | Freeze snapshot'ит шаблон + лейблы в `frozen_config` |
| Legacy | NULL | Freeze НЕ срабатывает. `useStageTemplateConfig` возвращает `LEGACY_DEFAULTS` |

**Важно:** В legacy mode нет информации для заморозки — нет шаблона, шкалы зашиты в константах (`HARD_SKILLS_MAX_LEVEL`, `SOFT_SKILLS_MAX_LEVEL` из `src/lib/scoreLabels.ts`). Это корректно, если legacy этапы не меняют свои шкалы.

---

## 4. Recommended Freeze Boundary

**Рекомендация: freeze diagnostic config, НЕ stage целиком.**

**Почему:**

- Stage содержит mutable операционные данные (участники, даты, прогресс)
- Config template — единственное, что должно быть immutable после запуска
- Текущая реализация `frozen_config` JSONB уже спроектирована именно так

### Что входит в snapshot (`frozen_config`):

```json
{
  "template_id": "uuid",
  "template_name": "string",
  "template_version": 1,
  "hard_scale_min": 0,
  "hard_scale_max": 4,
  "soft_scale_min": 0,
  "soft_scale_max": 5,
  "hard_scale_reversed": false,
  "soft_scale_reversed": false,
  "hard_skills_enabled": true,
  "scale_labels": {
    "hard": [{"level_value": 0, "label_text": "..."}],
    "soft": [{"level_value": 0, "label_text": "..."}]
  },
  "comment_rules": {},
  "open_questions": [],
  "johari_rules": {}
}
```

### Что остаётся mutable:

- `diagnostic_stage_participants` (добавление/удаление участников)
- `is_active`, `status`, `progress_percent`
- `parent_stages.start_date`, `end_date`, `reminder_date`

---

## 5. Findings

### F1. Freeze trigger никогда не срабатывает

- **Severity: CRITICAL**
- **Описание:** Trigger ожидает UPDATE с `NEW.status = 'active'`, но status устанавливается при INSERT триггером `set_diagnostic_stage_status()` и никогда не переходит в 'active' через UPDATE. Нет cron/механизма, который обновляет status.
- **Как проявляется:** `frozen_config` = NULL у 100% записей в production (подтверждено запросом к БД: `SELECT COUNT(*) = 1, COUNT(CASE WHEN frozen_config IS NOT NULL THEN 1 END) = 0`).
- **Файлы/артефакты:**
  - Trigger: `freeze_config_on_stage_activation` (BEFORE UPDATE) — зарегистрирован на `diagnostic_stages`
  - Status setter: `set_diagnostic_stage_status()` (BEFORE INSERT) — вычисляет status по датам
  - Status calculator: `get_stage_status_by_dates()` — возвращает 'upcoming'/'active'/'completed'
  - `CreateStageDialog` (`src/components/stages/CreateStageDialog.tsx`) — создаёт этап заранее → status = 'upcoming'
  - Нет механизма, который вызывает UPDATE status при наступлении start_date
- **Почему мешает freeze:** Freeze спроектирован, реализован в коде trigger'а, но не активируется ни в каком реальном flow.

### F2. Status рассинхронизирован с is_active

- **Severity: HIGH**
- **Описание:** `status` вычисляется по датам только при INSERT. `is_active` управляется из `parent_stages` через `finalize_expired_stage()`. Они могут расходиться: `status = 'upcoming'` + `is_active = false` (если parent завершён досрочно).
- **Как проявляется:** UI (`DiagnosticStepper.tsx:28`) использует `activeStage?.status || 'setup'` для stepper, а `UnifiedStagesManager` фильтрует по `is_active`. Stepper может показывать "Выбор оценивающих" для давно завершённого этапа.
- **Файлы:**
  - `src/components/DiagnosticStepper.tsx:28` — `currentStep = activeStage?.status || 'setup'`
  - `src/hooks/useDiagnosticStages.ts:54` — `is_active: stage.parent?.is_active ?? stage.is_active`
  - `finalize_expired_stage()` — ставит `is_active = false`, **не трогает** `status`
- **Почему мешает freeze:** Freeze не может привязаться к однозначному lifecycle event через `status`, потому что lifecycle реально управляется через `is_active`, а не через `status`.

### F3. Отсутствие freeze для legacy этапов

- **Severity: MEDIUM**
- **Описание:** Если `config_template_id = NULL`, freeze правильно не срабатывает. Но нет альтернативного механизма, который зафиксировал бы legacy defaults. Изменение констант `HARD_SKILLS_MAX_LEVEL`/`SOFT_SKILLS_MAX_LEVEL` в коде ретроактивно изменит интерпретацию legacy этапов.
- **Файлы:**
  - `src/hooks/useStageTemplateConfig.ts:35-50` — `LEGACY_DEFAULTS` построены из runtime-констант
  - `src/lib/scoreLabels.ts` — содержит `HARD_SKILLS_MAX_LEVEL`, `SOFT_SKILLS_MAX_LEVEL`
- **Почему мешает freeze:** Для legacy mode нет snapshot вообще — шкалы определяются runtime-константами. Однако это low-risk, т.к. эти константы меняются крайне редко.

### F4. `useStageTemplateConfig` корректно спроектирован, но всегда в fallback

- **Severity: LOW** (дизайн правильный, проблема в F1)
- **Описание:** Resolution chain `frozen → live template → legacy` реализована верно в `src/hooks/useStageTemplateConfig.ts:146-151`. Но из-за F1 `frozenConfig` всегда null, хук всегда идёт в fallback.
- **Файлы:** `src/hooks/useStageTemplateConfig.ts:146-151`

### F5. Шаблон может быть не `approved` при создании этапа

- **Severity: MEDIUM**
- **Описание:** Текущий trigger `freeze_template_config_on_activation` проверяет `tpl.status != 'approved'` и бросает exception. Но `CreateStageDialog` показывает только `approved` шаблоны (`templates.filter(t => t.status === 'approved')`). Если fix сделает freeze на INSERT, нужно убедиться, что проверка approved сохранится.
- **Файлы:**
  - `src/components/stages/CreateStageDialog.tsx:41` — фильтр `status === 'approved'`
  - Trigger function — `IF tpl.status != 'approved' THEN RAISE EXCEPTION`

---

## 6. Minimal Surgical Fix Scope

### 6.1 DB / Trigger (единственное критическое изменение)

Изменить trigger и/или условие срабатывания в `freeze_template_config_on_activation()`.

**Текущее условие (не работает):**

```sql
IF NEW.status = 'active'
   AND (OLD.status IS DISTINCT FROM 'active')
   AND NEW.config_template_id IS NOT NULL
   AND NEW.frozen_config IS NULL
```

**Два варианта fix'а:**

#### Вариант A — freeze при INSERT (рекомендуется)

Добавить второй trigger (BEFORE INSERT) или расширить функцию для поддержки INSERT:

```sql
-- Новое условие для INSERT:
IF TG_OP = 'INSERT'
   AND NEW.config_template_id IS NOT NULL
   AND NEW.frozen_config IS NULL
THEN
  -- ... freeze logic ...
END IF;

-- Существующее условие для UPDATE (оставить как safety net):
IF TG_OP = 'UPDATE'
   AND NEW.config_template_id IS NOT NULL
   AND NEW.frozen_config IS NULL
   AND OLD.frozen_config IS NULL
THEN
  -- ... freeze logic ...
END IF;
```

Перерегистрировать trigger как `BEFORE INSERT OR UPDATE`.

#### Вариант B — freeze при UPDATE с привязкой к is_active

```sql
IF NEW.is_active = true
   AND NEW.config_template_id IS NOT NULL
   AND NEW.frozen_config IS NULL
```

**Рекомендация:** Вариант A — покрывает стандартный flow (этап создаётся с шаблоном → сразу frozen). Вариант B — не покрывает INSERT.

### 6.2 Lifecycle alignment

**Не нужно** менять `status` lifecycle для fix'а freeze. Достаточно отвязать freeze от `status` и привязать к факту INSERT с `config_template_id`.

Рассинхронизация `status` vs `is_active` — отдельная задача, не блокирует freeze.

### 6.3 Read/Write guard

**Не требуется** для MVP. `useStageTemplateConfig` уже корректно обрабатывает fallback. Добавление write guard (блокировка оценки без frozen_config) — отдельный опциональный шаг.

### 6.4 Legacy support

**Не требуется** изменений. Legacy mode (без шаблона) корректно обрабатывается: `frozen_config = NULL`, `config_template_id = NULL` → `LEGACY_DEFAULTS`.

### 6.5 Validation после fix'а

После fix'а нужно проверить:

1. Создание нового этапа с шаблоном → `frozen_config` заполнен
2. Создание этапа без шаблона → `frozen_config` = NULL, всё работает
3. Immutability guard: попытка обновить `frozen_config` → exception
4. `useStageTemplateConfig` для этапа с frozen → возвращает frozen данные
5. Изменение шаблона после freeze → `frozen_config` этапа не изменился
6. Добавление участников после freeze → работает без ошибок

---

## 7. What Remains Out of Scope

Даже после исправления FreezeConfig останутся следующие проблемы ретроспективности:

| # | Проблема | Severity | Описание |
|---|----------|----------|----------|
| 1 | **Stage-scoped uniqueness для results** | CRITICAL | `hard_skill_results` / `soft_skill_results` не имеют `diagnostic_stage_id` в unique constraint. `survey_360_assignments` имеет unique на `(evaluated_user_id, evaluating_user_id)` без stage — новый этап может конфликтовать со старым. |
| 2 | **Destructive DELETE в legacy хуках** | CRITICAL | `useSurvey360.ts:125-133` делает `DELETE FROM soft_skill_results WHERE evaluated_user_id AND evaluating_user_id` БЕЗ фильтра по stage. `useSkillSurvey.ts:130-134` — аналогично для `hard_skill_results`. Используются активно на `Survey360QuestionsPage` и `SkillSurveyQuestionsPage`. |
| 3 | **Агрегатные триггеры через live answer_options** | HIGH | `update_user_skills_from_survey()` и `update_user_qualities_from_survey()` джойнят live `hard_skill_answer_options` / `soft_skill_answer_options` для получения `numeric_value`. Изменение шкалы → пересчёт агрегатов. |
| 4 | **Отчёты через live metadata** | HIGH | Отчётные хуки (`useSurvey360ResultsEnhanced`, `useSkillSurveyResultsEnhanced`, `useCorrectAssessmentResults`) читают названия компетенций из live таблиц `hard_skills`, `soft_skills`, `category_*`. |
| 5 | **`raw_numeric_value` не пишется legacy хуками** | HIGH | `useSurvey360.ts` и `useSkillSurvey.ts` не записывают `raw_numeric_value` — только `answer_option_id`. Только `UnifiedAssessmentPage` пишет `raw_numeric_value`. |
| 6 | **Нет snapshot вопросов и компетенций** | MEDIUM | Набор вопросов, привязка к компетенциям, названия — всё читается из live таблиц. Переименование компетенции изменит исторический отчёт. |

---

## 8. Recommendation

### Где freeze должен срабатывать

**При INSERT в `diagnostic_stages`**, если `config_template_id IS NOT NULL`. Это самый простой и надёжный trigger point:

- Этап создаётся с шаблоном → сразу frozen
- Не зависит от `status` / `is_active` / lifecycle
- Immutability guard уже защищает от повторной записи
- `CreateStageDialog` уже передаёт `config_template_id` — единственная точка привязки шаблона

### Минимальный безопасный контракт

1. `frozen_config` заполняется автоматически при создании этапа с шаблоном
2. `frozen_config` immutable после создания (уже реализовано в trigger)
3. `useStageTemplateConfig` приоритизирует `frozen_config` (уже реализовано)
4. Этап без шаблона → `frozen_config = NULL`, legacy defaults (уже реализовано)
5. Шаблон должен быть `approved` для freeze (уже реализовано в trigger function)
6. Добавление участников после freeze — разрешено (participants не входят в frozen scope)

### Следующие треки после freeze (в порядке приоритета)

1. **Stage-scoped uniqueness** — добавить `diagnostic_stage_id` в unique constraints `survey_360_assignments` и результатов
2. **Устранение destructive deletes** — убрать глобальные DELETE из `useSurvey360.ts` и `useSkillSurvey.ts`
3. **`raw_numeric_value` backfill** — заполнить для всех существующих записей, обеспечить запись во всех write paths
4. **Competency snapshots** — отдельная таблица для snapshot'а названий компетенций/категорий

---

## 9. Acceptance Criteria

| # | Критерий | Как проверить |
|---|----------|--------------|
| AC1 | FreezeConfig заполняется при создании этапа с шаблоном | `SELECT frozen_config FROM diagnostic_stages WHERE config_template_id IS NOT NULL` → NOT NULL |
| AC2 | FreezeConfig = NULL для этапа без шаблона | `SELECT frozen_config FROM diagnostic_stages WHERE config_template_id IS NULL` → NULL |
| AC3 | Immutability: попытка изменить frozen_config → exception | `UPDATE diagnostic_stages SET frozen_config = '{}' WHERE frozen_config IS NOT NULL` → ошибка |
| AC4 | `useStageTemplateConfig` возвращает frozen данные | На странице `UnifiedAssessmentPage` для этапа с шаблоном → `stageConfig.isLegacy = false`, данные из frozen |
| AC5 | Изменение шаблона после freeze не влияет на этап | Изменить `hard_scale_max` в шаблоне → `frozen_config` этапа остаётся прежним |
| AC6 | Добавление участников после freeze работает | Добавить участника в frozen этап → success, без ошибок |
| AC7 | Legacy этапы работают как раньше | Этап без шаблона → оценка проходит, `stageConfig.isLegacy = true` |
| AC8 | Шаблон должен быть approved | Попытка создать этап с draft-шаблоном → ошибка от trigger |

---

## 10. Verification Checklist

### 10.1 По БД

```sql
-- 1. Freeze заполнен для template-based этапов
SELECT id, config_template_id, frozen_config IS NOT NULL as has_frozen
FROM diagnostic_stages
WHERE config_template_id IS NOT NULL;
-- Ожидание: has_frozen = true для всех

-- 2. Freeze пуст для legacy этапов
SELECT id, frozen_config
FROM diagnostic_stages
WHERE config_template_id IS NULL;
-- Ожидание: frozen_config = NULL

-- 3. Immutability guard работает
UPDATE diagnostic_stages
SET frozen_config = '{}'::jsonb
WHERE frozen_config IS NOT NULL;
-- Ожидание: ERROR 'frozen_config is immutable once set'

-- 4. Frozen содержит все обязательные ключи
SELECT id,
  frozen_config ? 'template_id' as has_tid,
  frozen_config ? 'template_name' as has_tname,
  frozen_config ? 'hard_scale_min' as has_hmin,
  frozen_config ? 'hard_scale_max' as has_hmax,
  frozen_config ? 'soft_scale_min' as has_smin,
  frozen_config ? 'soft_scale_max' as has_smax,
  frozen_config ? 'hard_scale_reversed' as has_hrev,
  frozen_config ? 'soft_scale_reversed' as has_srev,
  frozen_config ? 'hard_skills_enabled' as has_hse,
  frozen_config ? 'scale_labels' as has_labels,
  frozen_config ? 'comment_rules' as has_cr,
  frozen_config ? 'open_questions' as has_oq,
  frozen_config ? 'johari_rules' as has_jr
FROM diagnostic_stages
WHERE frozen_config IS NOT NULL;
-- Ожидание: все true

-- 5. Frozen содержит корректные данные шаблона
SELECT 
  ds.id,
  ds.frozen_config->>'template_id' as frozen_tid,
  ds.config_template_id::text as live_tid,
  ds.frozen_config->>'template_name' as frozen_name,
  dct.name as live_name
FROM diagnostic_stages ds
LEFT JOIN diagnostic_config_templates dct ON dct.id = ds.config_template_id
WHERE ds.frozen_config IS NOT NULL;
-- Ожидание: frozen_tid = live_tid, frozen_name = live_name (на момент создания)

-- 6. После изменения шаблона frozen не изменился
-- (Записать frozen_config, изменить hard_scale_max в шаблоне, перечитать frozen_config)
-- Ожидание: frozen_config не изменился
```

### 10.2 По UI flow

1. **Создать новый этап с approved шаблоном** → проверить в БД, что `frozen_config` заполнен
2. **Открыть `UnifiedAssessmentPage`** для этого этапа → проверить в console.log, что `isLegacy = false` и `hardSkillsEnabled` соответствует frozen
3. **Создать этап без шаблона** → проверить, что оценка работает в legacy mode, `isLegacy = true`
4. **DiagnosticStepper** → визуально отображает корректный step (не блокируется freeze)

### 10.3 По write flow

1. **Начать оценку** в template-based этапе → ответы сохраняются корректно
2. **`hardSkillsEnabled = false`** в шаблоне → hard skill вопросы не отображаются на `UnifiedAssessmentPage`
3. **Изменить шаблон** (например `hard_skills_enabled`) ПОСЛЕ создания этапа → в running этапе поведение НЕ изменилось (frozen_config сохранил старое значение)

### 10.4 По legacy flow

1. **Этап без checkbox «Диагностика»** → нет `diagnostic_stages`, нет проблемы с freeze
2. **Этап с «Диагностика» но без шаблона** (нет approved шаблонов) → `config_template_id = NULL`, `frozen_config = NULL`, legacy defaults работают, `useStageTemplateConfig` возвращает `LEGACY_DEFAULTS`
3. **Legacy write paths** (`Survey360QuestionsPage`, `SkillSurveyQuestionsPage`) → работают как раньше, freeze их не затрагивает

### 10.5 По template flow

1. **Утвердить шаблон → создать этап** → `frozen_config` содержит данные шаблона
2. **Архивировать шаблон** после создания этапа → `frozen_config` этапа не изменился, `useStageTemplateConfig` читает из frozen
3. **Создать этап с draft-шаблоном** → должна быть ошибка от trigger (шаблон не approved)
4. **Два этапа с одним шаблоном** → каждый имеет свой frozen_config (идентичные по содержимому, но независимые)
5. **Изменить шаблон между созданием двух этапов** → первый этап сохраняет старую конфигурацию, второй — новую

---

## Приложение: Граф зависимостей FreezeConfig

```
CreateStageDialog (UI)
  └── useDiagnosticStages.createStage()
       └── INSERT INTO diagnostic_stages (config_template_id = ?)
            └── [TRIGGER: set_diagnostic_stage_status] → status = 'upcoming'
            └── [TRIGGER: freeze_config_on_stage_activation] → ❌ НЕ СРАБАТЫВАЕТ (BEFORE UPDATE only)
                 ↓ (после fix'а → BEFORE INSERT OR UPDATE)
            └── frozen_config = snapshot(template + labels)
                 ↓
            useStageTemplateConfig(stageId)
              ├── Priority 1: frozen_config ✅ (после fix'а)
              ├── Priority 2: live template (fallback)
              └── Priority 3: LEGACY_DEFAULTS (fallback)
                   ↓
            UnifiedAssessmentPage → stageConfig.hardSkillsEnabled
            SkillSurveyQuestionsPage → stageConfig
```
