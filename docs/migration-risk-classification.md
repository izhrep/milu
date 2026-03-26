# Migration Risk Classification Report

**Дата генерации**: 2026-03-24
**Всего файлов проверено**: 407
**Всего SQL-блоков с DML или hardcoded UUID**: 721

## Сводка по классификации

| Классификация | Количество |
|---|---|
| `definitely_can_fail_on_prod` | 45 |
| `may_fail_on_prod` | 0 |
| `won't_fail_but_env_specific` | 7 |
| `reference_data_change` | 600 |
| `dev_only_seed_or_cleanup` | 69 |

## Сводка по рекомендованным действиям

| Действие | Количество |
|---|---|
| `KEEP` | 597 |
| `REWRITE` | 10 |
| `CUT` | 114 |
| `MANUAL` | 0 |

---

## Детальный отчёт

### `migrations/20260126105911_assignment_unique_constraint.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: unique
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- FIX BUG 1 & BUG 2: Update unique constraint to include diagnostic_stage_id
-- This ensures assignments are properly isolated between stages
-- ============================================

-- Step 1: Drop old unique constraints that don't include diagnostic_stage_id
ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_evaluating_unique;
```

---

### `migrations/20260126110423_participant_trigger.sql`

#### Блок 1

- **Строки**: 1–193
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments, tasks, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- FIX BUG 3: Create missing tasks for self and manager assignments
-- Also update the trigger to properly create tasks
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  stage_deadline DATE;
  stage_reminder DATE;
  existing_task_count INT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем руководителя и даты из parent_stages через parent_id
  SELECT u.manager_id, ps.end_date, ps.reminder_date
  INTO manager_user_id, stage_deadline, stage_reminder
  FROM users u
  CROSS JOIN diagnostic_stages ds
  LEFT JOIN parent_stages ps ON ps.id = ds.parent_id
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;

  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;

  -- Проверяем, есть ли уже задача на выбор респондентов для этого пользователя в этом этапе
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'peer_selection';

  -- Создаём SELF assignment для сотрудника (самооценка)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
  RETURNING id INTO self_assignment_id;

  -- Если assignment уже существовал, получаем его id
  IF self_assignment_id IS NULL THEN
    SELECT id INTO self_assignment_id
    FROM survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id;
  END IF;

  -- Создаём задачу на выбор респондентов (если ещё нет)
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360. Напоминание: ' || COALESCE(stage_reminder::text, 'не указано') || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'peer_selection',
      'assessment'
    );
  END IF;

  -- Создаём задачу на самооценку для сотрудника (если ещё нет)
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'diagnostic_stage';

  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка). Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'diagnostic_stage',
      'assessment'
    );
  END IF;

  -- Если есть руководитель, создаём manager assignment и задачу
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      is_manager_participant,
      status
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      true,
      'approved'
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
    RETURNING id INTO manager_assignment_id;

    -- Если assignment уже существовал, получаем его id
    IF manager_assignment_id IS NULL THEN
      SELECT id INTO manager_assignment_id
      FROM survey_360_assignments
      WHERE evaluated_user_id = NEW.user_id
        AND evaluating_user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id;
    END IF;

    -- Создаём задачу для руководителя (если ещё нет)
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;

    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
        'pending',
        stage_deadline,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `migrations/20260128124302_finalize_cascade.sql`

#### Блок 1

- **Строки**: 1–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, meeting_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ШАГ 1: Модифицировать функцию finalize_expired_stage для каскадной деактивации diagnostic_stages
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные meeting_stages
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = stage_id;

  -- Снапшотим статусы survey_360_assignments для этого этапа
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы tasks для этого этапа
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы one_on_one_meetings для этого этапа
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('approved', 'expired');
END;
$$;
```

#### Блок 2

- **Строки**: 61–113
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ШАГ 2: Модифицировать функцию reopen_expired_stage для каскадной активации diagnostic_stages
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно активируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = true, updated_at = now()
  WHERE parent_id = stage_id;

  -- Восстанавливаем статусы survey_360_assignments из снапшота
  UPDATE survey_360_assignments
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы tasks из снапшота
  UPDATE tasks
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы one_on_one_meetings из снапшота
  UPDATE one_on_one_meetings
  SET 
    status = COALESCE(status_at_stage_end, 'draft'),
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;
END;
$$;
```

---

### `migrations/20260129083403_pg_cron.sql`

#### Блок 1

- **Строки**: 7–70
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, meeting_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновляем функцию finalize_expired_stage с учётом rejected статуса
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = stage_id;

  -- 2. Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = stage_id;

  -- 3. Обновляем meeting_stages (без is_active, только timestamp)
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = stage_id;

  -- 4. Снапшотим и переводим незавершённые assignments в expired
  --    ВАЖНО: completed и rejected НЕ трогаем (финальные статусы)
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired', 'rejected');

  -- 5. Снапшотим и переводим незавершённые tasks в expired
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- 6. Снапшотим и переводим незавершённые meetings в expired
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('approved', 'expired');
  
  -- soft_skill_results и hard_skill_results НЕ изменяются (is_draft остаётся как есть)
END;
$function$;
```

---

### `migrations/20260303_comment_required_open_questions.sql`

#### Блок 1

- **Строки**: 27–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, open
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update open questions"
  ON open_questions FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'diagnostics.manage'));
```

#### Блок 2

- **Строки**: 72–85
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, own
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Evaluator can update own results"
  ON open_question_results FOR UPDATE TO authenticated
  USING (evaluating_user_id = auth.uid())
  WITH CHECK (
    evaluating_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM survey_360_assignments a
      WHERE a.id = assignment_id
        AND a.evaluating_user_id = auth.uid()
        AND a.evaluated_user_id = evaluated_user_id
        AND a.diagnostic_stage_id = diagnostic_stage_id
    )
  );
```

---

### `migrations/20260311_johari_rules_template.sql`

#### Блок 1

- **Строки**: 72–143
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: freeze
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Update freeze trigger to include johari_rules in frozen_config
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.freeze_template_config_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- IMMUTABILITY GUARD
  IF OLD.frozen_config IS NOT NULL
     AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
    RAISE EXCEPTION 'frozen_config is immutable once set';
  END IF;

  -- FREEZE on first activation with a template
  IF NEW.status = 'active'
     AND (OLD.status IS DISTINCT FROM 'active')
     AND NEW.config_template_id IS NOT NULL
     AND NEW.frozen_config IS NULL
  THEN
    SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
    END IF;
    IF tpl.status != 'approved' THEN
      RAISE EXCEPTION 'Template must be approved before stage activation';
    END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO hard_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'hard'
      AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO soft_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'soft'
      AND l.level_value BETWEEN tpl.soft_scale_min AND tpl.soft_scale_max;

    NEW.frozen_config := jsonb_build_object(
      'template_id', tpl.id,
      'template_name', tpl.name,
      'template_version', tpl.version,
      'hard_scale_min', tpl.hard_scale_min,
      'hard_scale_max', tpl.hard_scale_max,
      'soft_scale_min', tpl.soft_scale_min,
      'soft_scale_max', tpl.soft_scale_max,
      'hard_scale_reversed', tpl.hard_scale_reversed,
      'soft_scale_reversed', tpl.soft_scale_reversed,
      'hard_skills_enabled', tpl.hard_skills_enabled,
      'scale_labels', jsonb_build_object('hard', hard_labels, 'soft', soft_labels),
      'comment_rules', tpl.comment_rules,
      'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb),
      'johari_rules', tpl.johari_rules
    );
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20250908092749_8ce804c6-796f-4902-940c-ae3108e4a485.sql`

#### Блок 1

- **Строки**: 213–218
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create triggers for updated_at columns
CREATE TRIGGER update_development_plan_tasks_updated_at
  BEFORE UPDATE ON public.development_plan_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20250908093226_1710f3f4-ed96-47b1-892f-b04fc5c22240.sql`

#### Блок 1

- **Строки**: 39–44
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger for updated_at column
CREATE TRIGGER update_user_kpi_results_updated_at
  BEFORE UPDATE ON public.user_kpi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20250908093507_4c535b52-5cde-4b1a-a933-d1156201c595.sql`

#### Блок 1

- **Строки**: 50–55
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create triggers for updated_at columns
CREATE TRIGGER update_kpi_targets_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20250908094130_890500d5-5583-4d79-895d-e30bfd6f9cc4.sql`

#### Блок 1

- **Строки**: 87–91
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid()::text = user_id::text);
```

#### Блок 2

- **Строки**: 112–116
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their own skills"
ON public.user_skills
FOR UPDATE
USING (auth.uid()::text = user_id::text);
```

#### Блок 3

- **Строки**: 122–126
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their own qualities"
ON public.user_qualities
FOR UPDATE
USING (auth.uid()::text = user_id::text);
```

#### Блок 4

- **Строки**: 158–163
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert sample data for testing

-- First insert sample departments, positions, skills, qualities
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 9–14
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 15–18
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 19–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 26–32
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT DO NOTHING;
```

#### Блок 6

- **Строки**: 33–54
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: users
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

```sql
-- Insert a sample user
INSERT INTO public.users (
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date
) 
SELECT 
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  p.id,
  d.id,
  '2023-01-15'
FROM public.positions p, public.departments d
WHERE p.name = 'Продавец-консультант' AND d.name = 'Продажи'
ON CONFLICT (employee_number) DO NOTHING;
```

#### Блок 7

- **Строки**: 55–75
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Get the user ID for further inserts
-- Insert user profile
INSERT INTO public.user_profiles (
  user_id,
  phone,
  birth_date,
  bio,
  work_address,
  store_number
)
SELECT 
  u.id,
  '+7 (999) 123-45-67',
  '1990-05-15',
  'Опытный продавец-консультант с 2-летним стажем',
  'Ул. Красная Пресня 36 с1',
  '#00343'
FROM public.users u
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id) DO NOTHING;
```

#### Блок 8

- **Строки**: 76–82
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: achievements
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert achievements
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT DO NOTHING;
```

#### Блок 9

- **Строки**: 83–101
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_achievements
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link achievements to user
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  CASE 
    WHEN a.title = 'Лидер изменений' THEN '2024-11-15'::timestamp
    WHEN a.title = 'Тренинг-мастер' THEN '2024-10-20'::timestamp
    WHEN a.title = 'Продавец месяца' THEN '2024-12-01'::timestamp
  END,
  CASE 
    WHEN a.title = 'Лидер изменений' THEN 'Внедрил новую систему выкладки'
    WHEN a.title = 'Тренинг-мастер' THEN 'Завершил все обязательные курсы'
    WHEN a.title = 'Продавец месяца' THEN 'Превысил план продаж на 120%'
  END
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, achievement_id) DO NOTHING;
```

#### Блок 10

- **Строки**: 102–124
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link skills to user
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  CASE 
    WHEN s.name = 'Мерчендайзинг' THEN 4
    WHEN s.name = 'Знание продукта' THEN 3
    WHEN s.name = 'Продажи' THEN 4
    WHEN s.name = 'Консультирование' THEN 5
  END,
  5,
  NOW() - INTERVAL '30 days',
  CASE 
    WHEN s.name = 'Мерчендайзинг' THEN 'Отличные результаты по выкладке'
    WHEN s.name = 'Знание продукта' THEN 'Требует изучение новых категорий'
    WHEN s.name = 'Продажи' THEN 'Превосходные техники продаж'
    WHEN s.name = 'Консультирование' THEN 'Эксперт в консультировании'
  END
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, skill_id) DO NOTHING;
```

#### Блок 11

- **Строки**: 125–151
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link qualities to user  
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  CASE 
    WHEN q.name = 'Коммуникабельность' THEN 5
    WHEN q.name = 'Предприимчивость' THEN 3
    WHEN q.name = 'Ответственность' THEN 4
    WHEN q.name = 'Лидерство' THEN 2
  END,
  CASE 
    WHEN q.name = 'Предприимчивость' THEN 4
    WHEN q.name = 'Лидерство' THEN 4
    ELSE NULL
  END,
  NOW() - INTERVAL '60 days',
  CASE 
    WHEN q.name = 'Коммуникабельность' THEN 'Отлично работает с клиентами'
    WHEN q.name = 'Предприимчивость' THEN 'Нужно развивать инициативность'
    WHEN q.name = 'Ответственность' THEN 'Всегда выполняет обязательства'
    WHEN q.name = 'Лидерство' THEN 'Развивается как лидер команды'
  END
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001'
ON CONFLICT (user_id, quality_id) DO NOTHING;
```

---

### `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: user_skills
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix the data insertion by handling the CASE statement properly

-- First clear any partial data
DELETE FROM public.user_skills WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 2

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: user_qualities
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM public.user_qualities WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 3

- **Строки**: 6–6
- **Тип операции**: `DELETE`
- **Целевые таблицы**: user_achievements
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM public.user_achievements WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 4

- **Строки**: 7–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: user_profiles
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM public.user_profiles WHERE user_id IN (SELECT id FROM public.users WHERE employee_number = 'EMP001');
```

#### Блок 5

- **Строки**: 8–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: users
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM public.users WHERE employee_number = 'EMP001';
```

#### Блок 6

- **Строки**: 9–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert sample data for testing

-- First insert sample departments, positions, skills, qualities
INSERT INTO public.departments (name, description) VALUES 
('Продажи', 'Отдел продаж'),
('Маркетинг', 'Отдел маркетинга'),
('ИТ', 'Информационные технологии')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 7

- **Строки**: 18–23
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.position_categories (name, description) VALUES
('Продажи', 'Позиции связанные с продажами'),
('Управление', 'Управленческие позиции'),
('Техническая', 'Технические специалисты')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 8

- **Строки**: 24–27
- **Тип операции**: `INSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.positions (name, position_category_id) 
SELECT 'Продавец-консультант', id FROM public.position_categories WHERE name = 'Продажи'
AND NOT EXISTS (SELECT 1 FROM public.positions WHERE name = 'Продавец-консультант');
```

#### Блок 9

- **Строки**: 28–34
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.skills (name, description, category) VALUES
('Мерчендайзинг', 'Навыки выкладки и представления товаров', 'technical'),
('Знание продукта', 'Глубокие знания ассортимента и характеристик товаров', 'technical'),
('Продажи', 'Техники продаж и работы с клиентами', 'sales'),
('Консультирование', 'Умение консультировать клиентов', 'communication')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 10

- **Строки**: 35–41
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.qualities (name, description, is_universal) VALUES
('Коммуникабельность', 'Умение общаться с людьми', true),
('Предприимчивость', 'Инициативность и способность к инновациям', true),
('Ответственность', 'Исполнительность и надёжность', true),
('Лидерство', 'Способность вести за собой команду', false)
ON CONFLICT (name) DO NOTHING;
```

#### Блок 11

- **Строки**: 42–62
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

```sql
-- Insert a sample user
INSERT INTO public.users (
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date
) 
SELECT 
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  p.id,
  d.id,
  '2023-01-15'
FROM public.positions p, public.departments d
WHERE p.name = 'Продавец-консультант' AND d.name = 'Продажи';
```

#### Блок 12

- **Строки**: 63–81
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert user profile
INSERT INTO public.user_profiles (
  user_id,
  phone,
  birth_date,
  bio,
  work_address,
  store_number
)
SELECT 
  u.id,
  '+7 (999) 123-45-67',
  '1990-05-15',
  'Опытный продавец-консультант с 2-летним стажем',
  'Ул. Красная Пресня 36 с1',
  '#00343'
FROM public.users u
WHERE u.employee_number = 'EMP001';
```

#### Блок 13

- **Строки**: 82–88
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: achievements
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert achievements
INSERT INTO public.achievements (title, description, category) VALUES
('Лидер изменений', 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%', 'innovation'),
('Тренинг-мастер', 'Пройдены все тренинги из тренинг-плана', 'training'),
('Продавец месяца', 'Лучший продавец по итогам месяца', 'sales')
ON CONFLICT (title) DO NOTHING;
```

#### Блок 14

- **Строки**: 89–98
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_achievements
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link achievements to user
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-11-15'::timestamp,
  'Внедрил новую систему выкладки'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Лидер изменений';
```

#### Блок 15

- **Строки**: 99–107
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_achievements
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, notes)
SELECT 
  u.id,
  a.id,
  '2024-10-20'::timestamp,
  'Завершил все обязательные курсы'
FROM public.users u, public.achievements a
WHERE u.employee_number = 'EMP001' AND a.title = 'Тренинг-мастер';
```

#### Блок 16

- **Строки**: 108–119
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link skills to user
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  4,
  5,
  NOW() - INTERVAL '30 days',
  'Отличные результаты по выкладке'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Мерчендайзинг';
```

#### Блок 17

- **Строки**: 120–130
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  3,
  5,
  NOW() - INTERVAL '30 days',
  'Требует изучение новых категорий'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Знание продукта';
```

#### Блок 18

- **Строки**: 131–141
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  4,
  5,
  NOW() - INTERVAL '30 days',
  'Превосходные техники продаж'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Продажи';
```

#### Блок 19

- **Строки**: 142–152
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_skills (user_id, skill_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  s.id,
  5,
  5,
  NOW() - INTERVAL '30 days',
  'Эксперт в консультировании'
FROM public.users u, public.skills s
WHERE u.employee_number = 'EMP001' AND s.name = 'Консультирование';
```

#### Блок 20

- **Строки**: 153–164
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Link qualities to user  
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  5,
  5,
  NOW() - INTERVAL '60 days',
  'Отлично работает с клиентами'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Коммуникабельность';
```

#### Блок 21

- **Строки**: 165–175
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  3,
  4,
  NOW() - INTERVAL '60 days',
  'Нужно развивать инициативность'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Предприимчивость';
```

#### Блок 22

- **Строки**: 176–186
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at, notes)
SELECT 
  u.id,
  q.id,
  4,
  5,
  NOW() - INTERVAL '60 days',
  'Всегда выполняет обязательства'
FROM public.users u, public.qualities q
WHERE u.employee_number = 'EMP001' AND q.name = 'Ответственность';
```

---

### `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем отдел если его нет
INSERT INTO public.departments (id, name, description) 
VALUES (gen_random_uuid(), 'Отдел продаж', 'Отдел розничных продаж')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 5–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем категорию должности если её нет
INSERT INTO public.position_categories (id, name, description)
VALUES (gen_random_uuid(), 'Продажи', 'Категория должностей связанных с продажами')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 10–16
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем должность если её нет
INSERT INTO public.positions (id, position_category_id, name)
SELECT gen_random_uuid(), pc.id, 'Продавец-консультант'
FROM public.position_categories pc
WHERE pc.name = 'Продажи'
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 17–39
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

```sql
-- Добавляем пользователя Владимир Маршаков
INSERT INTO public.users (
  id,
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date,
  competency_level
) VALUES (
  gen_random_uuid(),
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  (SELECT id FROM public.positions WHERE name = 'Продавец-консультант' LIMIT 1),
  (SELECT id FROM public.departments WHERE name = 'Отдел продаж' LIMIT 1),
  '2023-01-15',
  'Средний'
);
```

#### Блок 5

- **Строки**: 40–62
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем профиль пользователя
INSERT INTO public.user_profiles (
  id,
  user_id,
  birth_date,
  phone,
  bio,
  work_address,
  store_number,
  emergency_contact_name,
  emergency_contact_phone
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.users WHERE full_name = 'Владимир Маршаков' LIMIT 1),
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);
```

---

### `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `INSERT`
- **Целевые таблицы**: departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440001` | unknown | unknown | no |

```sql
-- Добавляем отдел
INSERT INTO public.departments (id, name, description) 
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'Отдел продаж', 'Отдел розничных продаж');
```

#### Блок 2

- **Строки**: 4–7
- **Тип операции**: `INSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440002` | unknown | unknown | no |

```sql
-- Добавляем категорию должности
INSERT INTO public.position_categories (id, name, description)
VALUES ('550e8400-e29b-41d4-a716-446655440002', 'Продажи', 'Категория должностей связанных с продажами');
```

#### Блок 3

- **Строки**: 8–11
- **Тип операции**: `INSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440003` | unknown | unknown | no |
| `550e8400-e29b-41d4-a716-446655440002` | unknown | unknown | no |

```sql
-- Добавляем должность
INSERT INTO public.positions (id, position_category_id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Продавец-консультант');
```

#### Блок 4

- **Строки**: 12–34
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | unknown | yes |
| `550e8400-e29b-41d4-a716-446655440003` | user | unknown | yes |
| `550e8400-e29b-41d4-a716-446655440001` | user | unknown | yes |

```sql
-- Добавляем пользователя Владимир Маршаков
INSERT INTO public.users (
  id,
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date,
  competency_level
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Владимир Маршаков',
  'EMP001',
  'vladimir.marshakov@company.com',
  'Активный',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440001',
  '2023-01-15',
  'Средний'
);
```

#### Блок 5

- **Строки**: 35–57
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | unknown | unknown | no |
| `550e8400-e29b-41d4-a716-446655440004` | unknown | unknown | no |

```sql
-- Добавляем профиль пользователя
INSERT INTO public.user_profiles (
  id,
  user_id,
  birth_date,
  phone,
  bio,
  work_address,
  store_number,
  emergency_contact_name,
  emergency_contact_phone
) VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);
```

---

### `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql`

#### Блок 1

- **Строки**: 1–22
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | unknown | yes |

```sql
-- Добавляем пользователя Владимир Маршаков с уникальным номером
INSERT INTO public.users (
  id,
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date,
  competency_level
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Владимир Маршаков',
  'EMP010',
  'vladimir.marshakov@company.com',
  'Активный',
  (SELECT id FROM public.positions WHERE name = 'Менеджер по продажам' LIMIT 1),
  (SELECT id FROM public.departments WHERE name = 'Отдел по работе с клиентами' LIMIT 1),
  '2023-01-15',
  'Уровень 3 - Опытный'
);
```

#### Блок 2

- **Строки**: 23–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | unknown | unknown | no |
| `550e8400-e29b-41d4-a716-446655440004` | unknown | unknown | no |

```sql
-- Добавляем профиль пользователя
INSERT INTO public.user_profiles (
  id,
  user_id,
  birth_date,
  phone,
  bio,
  work_address,
  store_number,
  emergency_contact_name,
  emergency_contact_phone
) VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);
```

---

### `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql`

#### Блок 1

- **Строки**: 1–22
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | unknown | yes |

```sql
-- Добавляем пользователя Владимир Маршаков с уникальным номером
INSERT INTO public.users (
  id,
  full_name,
  employee_number,
  email,
  status,
  position_id,
  department_id,
  start_date,
  competency_level
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Владимир Маршаков',
  'EMP010',
  'vladimir.marshakov@company.com',
  'Активный',
  (SELECT id FROM public.positions WHERE name = 'Менеджер по продажам' LIMIT 1),
  (SELECT id FROM public.departments WHERE name = 'Отдел по работе с клиентами' LIMIT 1),
  '2023-01-15',
  'Уровень 3 - Опытный'
);
```

#### Блок 2

- **Строки**: 23–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | unknown | unknown | no |
| `550e8400-e29b-41d4-a716-446655440004` | unknown | unknown | no |

```sql
-- Добавляем профиль пользователя
INSERT INTO public.user_profiles (
  id,
  user_id,
  birth_date,
  phone,
  bio,
  work_address,
  store_number,
  emergency_contact_name,
  emergency_contact_phone
) VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  '1990-05-15',
  '+7 (999) 123-45-67',
  'Опытный продавец-консультант с 3-летним стажем работы в розничных продажах.',
  'г. Москва, ул. Тверская, д. 1, офис 101',
  'MSK001',
  'Маршакова Елена',
  '+7 (999) 987-65-43'
);
```

---

### `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql`

#### Блок 1

- **Строки**: 1–10
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `12345678-1234-5678-9012-123456789007` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789002` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789006` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789005` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789001` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789003` | user | unknown | yes |
| `12345678-1234-5678-9012-123456789004` | user | unknown | yes |

```sql
-- Добавим тестовых пользователей и связи между ними
INSERT INTO public.users (id, full_name, email, employee_number, status, supervisor_id) VALUES
  ('12345678-1234-5678-9012-123456789001', 'Владимир Маршаков', 'vladimir.marshakov@company.com', 'EMP001', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789002', 'Мария Завьялова', 'maria.zavyalova@company.com', 'EMP002', 'Активный', NULL),
  ('12345678-1234-5678-9012-123456789003', 'Антон Кораблев', 'anton.korablev@company.com', 'EMP003', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789004', 'Анна Макарова', 'anna.makarova@company.com', 'EMP004', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789005', 'Вероника Жогова', 'veronika.zhogova@company.com', 'EMP005', 'Активный', '12345678-1234-5678-9012-123456789002'),
  ('12345678-1234-5678-9012-123456789006', 'Петр Сидоров', 'petr.sidorov@company.com', 'EMP006', 'Активный', '12345678-1234-5678-9012-123456789001'),
  ('12345678-1234-5678-9012-123456789007', 'Екатерина Новикова', 'ekaterina.novikova@company.com', 'EMP007', 'Активный', '12345678-1234-5678-9012-123456789001')
ON CONFLICT (id) DO NOTHING;
```

---

### `supabase/migrations/20250908163010_e9acb18c-4756-4a26-8160-90ec4b1bfc55.sql`

#### Блок 1

- **Строки**: 42–47
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER update_survey_360_selections_updated_at
  BEFORE UPDATE ON public.survey_360_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_survey_360_selections_updated_at();
```

---

### `supabase/migrations/20250909103431_98f4e799-2579-45b7-ae05-a85a9af3552f.sql`

#### Блок 1

- **Строки**: 26–31
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем триггер для обновления updated_at
CREATE TRIGGER update_user_trade_points_updated_at
BEFORE UPDATE ON public.user_trade_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 2

- **Строки**: 32–36
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Вставляем торговую точку "ул. Центральная, 1" если её нет
INSERT INTO public.trade_points (name, address, status)
VALUES ('Торговая точка Центральная', 'ул. Центральная, 1', 'Активный')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 37–51
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Получаем ID торговой точки и связываем всех пользователей из департамента "Розница"
WITH trade_point AS (
  SELECT id FROM public.trade_points WHERE address = 'ул. Центральная, 1' LIMIT 1
),
retail_users AS (
  SELECT u.id as user_id
  FROM public.users u
  JOIN public.departments d ON u.department_id = d.id
  WHERE d.name = 'Розница' AND u.status = 'Активный'
)
INSERT INTO public.user_trade_points (user_id, trade_point_id)
SELECT ru.user_id, tp.id
FROM retail_users ru, trade_point tp
ON CONFLICT (user_id, trade_point_id) DO NOTHING;
```

---

### `supabase/migrations/20250909103451_9018ea03-bf79-488c-9668-f87f959f0e25.sql`

#### Блок 1

- **Строки**: 26–31
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем триггер для обновления updated_at
CREATE TRIGGER update_user_trade_points_updated_at
BEFORE UPDATE ON public.user_trade_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 2

- **Строки**: 32–35
- **Тип операции**: `INSERT`
- **Целевые таблицы**: trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Вставляем торговую точку "ул. Центральная, 1"
INSERT INTO public.trade_points (name, address, status)
VALUES ('Торговая точка Центральная', 'ул. Центральная, 1', 'Активный');
```

#### Блок 3

- **Строки**: 36–45
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Связываем всех пользователей из департамента "Розница" с торговой точкой
INSERT INTO public.user_trade_points (user_id, trade_point_id)
SELECT u.id, tp.id
FROM public.users u
JOIN public.departments d ON u.department_id = d.id
CROSS JOIN public.trade_points tp
WHERE d.name = 'Розница' 
  AND u.status = 'Активный'
  AND tp.address = 'ул. Центральная, 1';
```

---

### `supabase/migrations/20250909103544_4212f3f4-b583-4ab4-89be-886a56c56667.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем новую должность "Директор магазина"
-- Сначала получаем подходящую категорию должности или создаем новую
INSERT INTO public.position_categories (name, description)
VALUES ('Руководящие должности', 'Категория для руководящих должностей в компании')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 6–12
- **Тип операции**: `INSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем должность "Директор магазина" 
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
LIMIT 1;
```

---

### `supabase/migrations/20250909103556_acc79f3d-a33d-4c90-906c-5e3614e06987.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем новую должность "Директор магазина"
-- Сначала получаем подходящую категорию должности или создаем новую
INSERT INTO public.position_categories (name, description)
VALUES ('Руководящие должности', 'Категория для руководящих должностей в компании')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 6–12
- **Тип операции**: `INSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем должность "Директор магазина" 
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
LIMIT 1;
```

---

### `supabase/migrations/20250909103840_fac0136f-f368-44a2-a3dd-0f49cc4523bd.sql`

#### Блок 1

- **Строки**: 1–6
- **Тип операции**: `INSERT`
- **Целевые таблицы**: position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем категорию должности, если её нет
INSERT INTO public.position_categories (name, description)
SELECT 'Руководящие должности', 'Категория для руководящих должностей в компании'
WHERE NOT EXISTS (
  SELECT 1 FROM public.position_categories WHERE name = 'Руководящие должности'
);
```

#### Блок 2

- **Строки**: 7–16
- **Тип операции**: `INSERT`
- **Целевые таблицы**: positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем должность "Директор магазина" 
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
  AND NOT EXISTS (
    SELECT 1 FROM public.positions WHERE name = 'Директор магазина'
  )
LIMIT 1;
```

---

### `supabase/migrations/20250909112242_14b24f5d-253a-4d5e-ae61-63ea8f55fdf0.sql`

#### Блок 1

- **Строки**: 5–12
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем существующую торговую точку с правильными данными
UPDATE public.trade_points 
SET 
  address = 'Краснодар, Центральная улица, 1',
  latitude = 45.058071,
  longitude = 39.109530
WHERE address = 'ул. Центральная, 1';
```

---

### `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql`

#### Блок 1

- **Строки**: 1–32
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to update user qualities based on survey 360 results
CREATE OR REPLACE FUNCTION update_user_qualities_from_survey()
RETURNS trigger AS $$
BEGIN
    -- Insert or update user_qualities based on survey results
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.evaluated_user_id,
        sq.quality_id,
        ao.value,
        ao.value + 1, -- target level is current + 1
        NEW.created_at
    FROM survey_360_questions sq
    JOIN survey_360_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.value)
            FROM survey_360_results sr
            JOIN survey_360_answer_options ao ON ao.id = sr.answer_option_id
            JOIN survey_360_questions sq ON sq.id = sr.question_id
            WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
              AND sq.quality_id = user_qualities.quality_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Блок 2

- **Строки**: 39–71
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user, user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to update user skills based on skill survey results  
CREATE OR REPLACE FUNCTION update_user_skills_from_survey()
RETURNS trigger AS $$
BEGIN
    -- Insert or update user_skills based on skill survey results
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.user_id,
        ssq.skill_id,
        ao.step,
        ao.step + 1, -- target level is current + 1
        NEW.created_at
    FROM skill_survey_questions ssq
    JOIN skill_survey_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE ssq.id = NEW.question_id 
      AND ssq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.step)
            FROM skill_survey_results sr
            JOIN skill_survey_answer_options ao ON ao.id = sr.answer_option_id
            JOIN skill_survey_questions ssq ON ssq.id = sr.question_id
            WHERE sr.user_id = NEW.user_id 
              AND ssq.skill_id = user_skills.skill_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Блок 3

- **Строки**: 78–98
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, existing, user_qualities
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | user_id | yes |

```sql
-- Manually update existing data for Владимир Маршаков
INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid as user_id,
    sq.quality_id,
    AVG(ao.value) as current_level,
    AVG(ao.value) + 1 as target_level,
    MAX(sr.created_at) as last_assessed_at
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT (user_id, quality_id) 
DO UPDATE SET 
    current_level = EXCLUDED.current_level,
    target_level = EXCLUDED.target_level,
    last_assessed_at = EXCLUDED.last_assessed_at,
    updated_at = now();
```

---

### `supabase/migrations/20250909114236_bfc6ff41-ca83-48c4-b04a-8a1158928c23.sql`

#### Блок 1

- **Строки**: 1–36
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix security issues by setting search_path for functions
CREATE OR REPLACE FUNCTION update_user_qualities_from_survey()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Insert or update user_qualities based on survey results
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.evaluated_user_id,
        sq.quality_id,
        ao.value,
        ao.value + 1, -- target level is current + 1
        NEW.created_at
    FROM survey_360_questions sq
    JOIN survey_360_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.value)
            FROM survey_360_results sr
            JOIN survey_360_answer_options ao ON ao.id = sr.answer_option_id
            JOIN survey_360_questions sq ON sq.id = sr.question_id
            WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
              AND sq.quality_id = user_qualities.quality_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 37–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix security issues by setting search_path for functions
CREATE OR REPLACE FUNCTION update_user_skills_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Insert or update user_skills based on skill survey results
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.user_id,
        ssq.skill_id,
        ao.step,
        ao.step + 1, -- target level is current + 1
        NEW.created_at
    FROM skill_survey_questions ssq
    JOIN skill_survey_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE ssq.id = NEW.question_id 
      AND ssq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.step)
            FROM skill_survey_results sr
            JOIN skill_survey_answer_options ao ON ao.id = sr.answer_option_id
            JOIN skill_survey_questions ssq ON ssq.id = sr.question_id
            WHERE sr.user_id = NEW.user_id 
              AND ssq.skill_id = user_skills.skill_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql`

#### Блок 1

- **Строки**: 43–123
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to insert assessment results after survey completion
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
    -- Calculate average for this quality for this user
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      quality_id,
      quality_average,
      total_responses
    )
    SELECT 
      NEW.evaluated_user_id,
      'survey_360',
      NEW.evaluation_period,
      NEW.created_at,
      sq.quality_id,
      AVG(ao.value),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
      AND sq.quality_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY sq.quality_id
    ON CONFLICT (user_id, assessment_type, assessment_period, quality_id) 
    DO UPDATE SET 
      quality_average = EXCLUDED.quality_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      skill_id,
      skill_average,
      total_responses
    )
    SELECT 
      NEW.user_id,
      'skill_survey',
      NEW.evaluation_period,
      NEW.created_at,
      ssq.skill_id,
      AVG(ao.step),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = NEW.user_id 
      AND ssq.skill_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY ssq.skill_id
    ON CONFLICT (user_id, assessment_type, assessment_period, skill_id) 
    DO UPDATE SET 
      skill_average = EXCLUDED.skill_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 144–169
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | user_id | yes |

```sql
-- Populate existing data for the current user
INSERT INTO user_assessment_results (
  user_id,
  assessment_type,
  assessment_period,
  assessment_date,
  quality_id,
  quality_average,
  total_responses
)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'survey_360',
  'H2_2025',
  MAX(sr.created_at),
  sq.quality_id,
  AVG(ao.value),
  COUNT(*)
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql`

#### Блок 1

- **Строки**: 43–123
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to insert assessment results after survey completion
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
    -- Calculate average for this quality for this user
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      quality_id,
      quality_average,
      total_responses
    )
    SELECT 
      NEW.evaluated_user_id,
      'survey_360',
      NEW.evaluation_period,
      NEW.created_at,
      sq.quality_id,
      AVG(ao.value),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
      AND sq.quality_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY sq.quality_id
    ON CONFLICT (user_id, assessment_type, assessment_period, quality_id) 
    DO UPDATE SET 
      quality_average = EXCLUDED.quality_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      skill_id,
      skill_average,
      total_responses
    )
    SELECT 
      NEW.user_id,
      'skill_survey',
      NEW.evaluation_period,
      NEW.created_at,
      ssq.skill_id,
      AVG(ao.step),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = NEW.user_id 
      AND ssq.skill_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY ssq.skill_id
    ON CONFLICT (user_id, assessment_type, assessment_period, skill_id) 
    DO UPDATE SET 
      skill_average = EXCLUDED.skill_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 144–169
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | user | user_id | yes |

```sql
-- Populate existing data for the current user
INSERT INTO user_assessment_results (
  user_id,
  assessment_type,
  assessment_period,
  assessment_date,
  quality_id,
  quality_average,
  total_responses
)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'survey_360',
  'H2_2025',
  MAX(sr.created_at),
  sq.quality_id,
  AVG(ao.value),
  COUNT(*)
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20250909133543_1b834009-bc8e-47a8-8caf-812012cca77d.sql`

#### Блок 1

- **Строки**: 1–82
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix the insert_assessment_results function to avoid upsert conflict
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
    -- First delete existing record for this combination to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.evaluated_user_id 
      AND assessment_type = 'survey_360'
      AND assessment_period = NEW.evaluation_period
      AND quality_id = (SELECT quality_id FROM survey_360_questions WHERE id = NEW.question_id);
    
    -- Calculate average for this quality for this user
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      quality_id,
      quality_average,
      total_responses
    )
    SELECT 
      NEW.evaluated_user_id,
      'survey_360',
      NEW.evaluation_period,
      NEW.created_at,
      sq.quality_id,
      AVG(ao.value),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
      AND sq.quality_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY sq.quality_id;
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    -- First delete existing record for this combination to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.user_id 
      AND assessment_type = 'skill_survey'
      AND assessment_period = NEW.evaluation_period
      AND skill_id = (SELECT skill_id FROM skill_survey_questions WHERE id = NEW.question_id);
    
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      skill_id,
      skill_average,
      total_responses
    )
    SELECT 
      NEW.user_id,
      'skill_survey',
      NEW.evaluation_period,
      NEW.created_at,
      ssq.skill_id,
      AVG(ao.step),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = NEW.user_id 
      AND ssq.skill_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY ssq.skill_id;
  END IF;
  
  RETURN NEW;
END;
$function$
```

---

### `supabase/migrations/20250909133844_8c704828-d6e9-413f-bb87-286f338ee103.sql`

#### Блок 1

- **Строки**: 1–80
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix the insert_assessment_results function to properly handle bulk inserts
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
    -- Delete all existing records for this user and period to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.evaluated_user_id 
      AND assessment_type = 'survey_360'
      AND assessment_period = NEW.evaluation_period;
    
    -- Calculate average for all qualities for this user and period
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      quality_id,
      quality_average,
      total_responses
    )
    SELECT 
      NEW.evaluated_user_id,
      'survey_360',
      NEW.evaluation_period,
      NEW.created_at,
      sq.quality_id,
      AVG(ao.value),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
      AND sq.quality_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY sq.quality_id;
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    -- Delete all existing records for this user and period to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.user_id 
      AND assessment_type = 'skill_survey'
      AND assessment_period = NEW.evaluation_period;
    
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      skill_id,
      skill_average,
      total_responses
    )
    SELECT 
      NEW.user_id,
      'skill_survey',
      NEW.evaluation_period,
      NEW.created_at,
      ssq.skill_id,
      AVG(ao.step),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = NEW.user_id 
      AND ssq.skill_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY ssq.skill_id;
  END IF;
  
  RETURN NEW;
END;
$function$
```

---

### `supabase/migrations/20250910084503_8e065838-b797-451a-9447-cb93a91e3fbc.sql`

#### Блок 1

- **Строки**: 29–33
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "System can update assignment status" 
ON public.survey_360_assignments 
FOR UPDATE 
USING (true);
```

#### Блок 2

- **Строки**: 61–66
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "System can create and update tasks" 
ON public.tasks 
FOR ALL 
USING (true)
WITH CHECK (true);
```

#### Блок 3

- **Строки**: 73–78
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_survey_360_assignments_updated_at
BEFORE UPDATE ON public.survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 4

- **Строки**: 84–113
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to automatically create tasks when assignments are created
CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS TRIGGER AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT full_name INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Оценка 360',
    'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### Блок 5

- **Строки**: 120–143
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment, corresponding, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to update assignment status when evaluation is completed
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assignment status to completed
  UPDATE public.survey_360_assignments
  SET status = 'выполнено',
      updated_at = now()
  WHERE evaluated_user_id = NEW.evaluated_user_id 
    AND evaluating_user_id = NEW.evaluating_user_id;
  
  -- Update corresponding task status
  UPDATE public.tasks
  SET status = 'completed',
      updated_at = now()
  FROM public.survey_360_assignments sa
  WHERE tasks.assignment_id = sa.id
    AND sa.evaluated_user_id = NEW.evaluated_user_id
    AND sa.evaluating_user_id = NEW.evaluating_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### Блок 6

- **Строки**: 144–149
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger to update assignment status when survey is completed
CREATE TRIGGER update_assignment_on_survey_result
AFTER INSERT ON public.survey_360_results
FOR EACH ROW
EXECUTE FUNCTION public.update_assignment_on_survey_completion();
```

---

### `supabase/migrations/20250910090707_734e6f60-f42a-4af5-aba4-41a173592375.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Clear all data from survey_360_assignments table
DELETE FROM survey_360_assignments;
```

---

### `supabase/migrations/20250910111749_34fdccfd-7d39-4f5f-8241-c6b276aa49e4.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix RLS policies for skill_survey_assignments to allow inserts
-- Update the RLS policy to allow users to create assignments as the evaluated user
DROP POLICY IF EXISTS "Users can create skill survey assignments as evaluated user" ON skill_survey_assignments;
```

#### Блок 2

- **Строки**: 9–11
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: skill
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Also allow system updates for status changes
DROP POLICY IF EXISTS "System can update skill survey assignment status" ON skill_survey_assignments;
```

#### Блок 3

- **Строки**: 12–16
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, skill
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "System can update skill survey assignment status" 
ON skill_survey_assignments 
FOR UPDATE 
USING (true);
```

---

### `supabase/migrations/20250910112241_6a5ad53c-21ef-409b-989f-fb6dcfc361e7.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: skill
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can update skill survey assignment status" ON skill_survey_assignments;
```

#### Блок 2

- **Строки**: 20–25
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Allow updating assignments
CREATE POLICY "Allow updating skill survey assignments" 
ON skill_survey_assignments 
FOR UPDATE 
USING (true);
```

---

### `supabase/migrations/20250910113507_6f07623f-6f5d-47d5-8a00-cae305975eda.sql`

#### Блок 1

- **Строки**: 29–31
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update the foreign key to be more flexible or remove it entirely for now
-- We'll handle referential integrity at the application level
```

---

### `supabase/migrations/20250910113731_77e815ab-a42d-4513-a75f-583ee5ad7cc7.sql`

#### Блок 1

- **Строки**: 20–28
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skill_survey_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert test answer options
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 29–40
- **Тип операции**: `INSERT`
- **Целевые таблицы**: skill_survey_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Add some test skill survey questions if none exist
INSERT INTO skill_survey_questions (skill_id, question_text, order_index) 
SELECT 
  s.id as skill_id,
  'Оцените уровень навыка "' || s.name || '"' as question_text,
  1 as order_index
FROM skills s
WHERE NOT EXISTS (
  SELECT 1 FROM skill_survey_questions ssq WHERE ssq.skill_id = s.id
)
LIMIT 5;
```

---

### `supabase/migrations/20250910114711_9d8eb2a2-dfea-4463-9b5c-f392ae64dcc3.sql`

#### Блок 1

- **Строки**: 38–46
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skill_survey_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Insert test answer options
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20250910155224_a3187eb2-4f52-43e7-b297-74beeb77d74a.sql`

#### Блок 1

- **Строки**: 1–26
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skill_survey_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем тестовое назначение на самооценку навыков для пользователя Владимир Маршаков
-- Сначала найдем ID пользователя по email
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Ищем пользователя Владимир Маршаков
    SELECT id INTO user_id FROM users WHERE full_name = 'Владимир Маршаков' LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Создаем назначение на самооценку (evaluated_user_id = evaluating_user_id)
        INSERT INTO skill_survey_assignments (
            evaluated_user_id,
            evaluating_user_id,
            status
        ) VALUES (
            user_id,
            user_id,
            'отправлен запрос'
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Создано назначение на самооценку навыков для пользователя %', user_id;
    ELSE
        RAISE NOTICE 'Пользователь Владимир Маршаков не найден';
    END IF;
END $$;
```

---

### `supabase/migrations/20250910161756_6804f833-5b6f-4938-923b-3fd14aa58ff4.sql`

#### Блок 1

- **Строки**: 1–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем тестовое назначение на самооценку 360 качеств для полной диагностики
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Ищем пользователя Владимир Маршаков
    SELECT id INTO user_id FROM users WHERE full_name = 'Владимир Маршаков' LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Создаем назначение на самооценку 360 (evaluated_user_id = evaluating_user_id)
        INSERT INTO survey_360_assignments (
            evaluated_user_id,
            evaluating_user_id,
            status
        ) VALUES (
            user_id,
            user_id,
            'отправлен запрос'
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Создано назначение на самооценку 360 для пользователя %', user_id;
    ELSE
        RAISE NOTICE 'Пользователь Владимир Маршаков не найден';
    END IF;
END $$;
```

---

### `supabase/migrations/20250910170251_47d76d2e-8b4b-48e6-9f0d-6aae7f0a249e.sql`

#### Блок 1

- **Строки**: 26–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their own career progress" 
ON public.user_career_progress 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);
```

#### Блок 2

- **Строки**: 37–42
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_career_progress_updated_at
BEFORE UPDATE ON public.user_career_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20250911152420_8bcd628c-6d63-490b-a333-3ae46c04a40f.sql`

#### Блок 1

- **Строки**: 27–29
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing tasks to have proper type
UPDATE tasks SET task_type = 'assessment' WHERE assignment_id IS NOT NULL;
```

---

### `supabase/migrations/20251017125426_7ea29295-d630-49ee-958e-287f3c63b270.sql`

#### Блок 1

- **Строки**: 1–43
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем существующие записи пользователей случайными русскими ФИО
UPDATE users
SET 
  last_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Иванов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Петрова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Сидоров'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Козлова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Смирнов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Новикова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Морозов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Волкова'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Соколов'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Лебедева'
    ELSE 'Васильев'
  END,
  first_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Александр'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Анна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Дмитрий'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Елена'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Михаил'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Ольга'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Сергей'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Татьяна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Владимир'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Наталья'
    ELSE 'Андрей'
  END,
  middle_name = CASE 
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0) THEN 'Иванович'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1) THEN 'Петровна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 2) THEN 'Сергеевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 3) THEN 'Александровна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 4) THEN 'Дмитриевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 5) THEN 'Михайловна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 6) THEN 'Владимирович'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 7) THEN 'Николаевна'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 8) THEN 'Андреевич'
    WHEN id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 9) THEN 'Сергеевна'
    ELSE 'Павлович'
  END
WHERE last_name IS NULL OR first_name IS NULL OR middle_name IS NULL;
```

---

### `supabase/migrations/20251017131731_00053999-b87a-4ec6-a8fb-e375445d88a1.sql`

#### Блок 1

- **Строки**: 71–76
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_meeting_stages_updated_at
  BEFORE UPDATE ON public.meeting_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 2

- **Строки**: 136–143
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Employees can update their draft or returned meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    employee_id::text = auth.uid()::text 
    AND status IN ('draft', 'returned')
  );
```

#### Блок 3

- **Строки**: 144–151
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, submitted
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Managers can update submitted meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    manager_id::text = auth.uid()::text 
    AND status = 'submitted'
  );
```

#### Блок 4

- **Строки**: 152–156
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, all
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update all meetings"
  ON public.one_on_one_meetings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
```

#### Блок 5

- **Строки**: 183–193
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their own decisions"
  ON public.meeting_decisions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_decisions.meeting_id
      AND (m.employee_id::text = auth.uid()::text OR m.manager_id::text = auth.uid()::text)
    )
  );
```

#### Блок 6

- **Строки**: 199–236
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Функция для создания задачи при запуске этапа встреч
CREATE OR REPLACE FUNCTION public.create_meeting_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.meeting_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    'Встреча 1:1 - ' || stage_record.period,
    'Необходимо провести встречу 1:1 и заполнить форму. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'meeting',
    'Встречи 1:1'
  );
  
  RETURN NEW;
END;
$$;
```

#### Блок 7

- **Строки**: 243–265
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Функция для обновления задачи при изменении статуса встречи
CREATE OR REPLACE FUNCTION public.update_meeting_task_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем статус задачи при утверждении встречи
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = NEW.employee_id
      AND task_type = 'meeting'
      AND category = 'Встречи 1:1'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 8

- **Строки**: 266–272
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Триггер для автоматического обновления статуса задач
CREATE TRIGGER update_task_on_meeting_approval
  AFTER UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.update_meeting_task_status();
```

---

### `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | role | unknown | yes |

```sql
-- Добавляем роль admin для пользователя-администратора
INSERT INTO public.user_roles (user_id, role)
VALUES ('9138f9ee-ca94-4563-9016-05e5d2b496df', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### `supabase/migrations/20251017141929_863a7a4d-c088-45b8-832d-49d501952b47.sql`

#### Блок 1

- **Строки**: 16–27
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Админы могут обновлять и удалять этапы
CREATE POLICY "Admins can update meeting stages"
ON public.meeting_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
```

---

### `supabase/migrations/20251017142212_3d6729c4-8774-424e-baae-0d091a7eeed5.sql`

#### Блок 1

- **Строки**: 1–22
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

```sql
-- Добавляем роль admin для пользователя, если её нет
-- Сначала проверяем текущего пользователя в auth.users
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Получаем ID пользователя по email
  SELECT id INTO current_user_id
  FROM public.users
  WHERE email = 'draganova@raketa.im';
  
  -- Если пользователь найден, добавляем роль admin если её нет
  IF current_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role added/verified for user: %', current_user_id;
  ELSE
    RAISE NOTICE 'User with email draganova@raketa.im not found in users table';
  END IF;
END $$;
```

---

### `supabase/migrations/20251017143043_2233c2d7-54ed-4f9a-a6a3-7e0298ced06e.sql`

#### Блок 1

- **Строки**: 5–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admins can update meeting stages" ON public.meeting_stages;
```

#### Блок 2

- **Строки**: 16–22
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Админы могут обновлять этапы
CREATE POLICY "Admins can update meeting stages"
ON public.meeting_stages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

---

### `supabase/migrations/20251017143657_d3ed2ff4-2f0d-4a31-bf04-b0e81ce39eb8.sql`

#### Блок 1

- **Строки**: 7–7
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admins can update meeting stages" ON public.meeting_stages;
```

---

### `supabase/migrations/20251020074842_ef1f0e42-5b4b-4b55-968a-bf2892f4b128.sql`

#### Блок 1

- **Строки**: 3–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own decisions" ON meeting_decisions;
```

#### Блок 2

- **Строки**: 21–33
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, decisions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Сотрудники могут редактировать решения в своих встречах
CREATE POLICY "Employees can update decisions in their meetings"
ON meeting_decisions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND m.employee_id = auth.uid()
  )
);
```

#### Блок 3

- **Строки**: 34–46
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, decisions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Руководители могут редактировать решения в встречах подчиненных
CREATE POLICY "Managers can update decisions in subordinate meetings"
ON meeting_decisions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND m.manager_id = auth.uid()
  )
);
```

#### Блок 4

- **Строки**: 60–62
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: submitted
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Удаляем старую политику для обновления руководителями
DROP POLICY IF EXISTS "Managers can update submitted meetings" ON one_on_one_meetings;
```

#### Блок 5

- **Строки**: 63–72
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, subordinate
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Руководители могут обновлять встречи подчиненных (submitted и approved)
CREATE POLICY "Managers can update subordinate meetings"
ON one_on_one_meetings
FOR UPDATE
TO authenticated
USING (
  manager_id = auth.uid()
  AND status IN ('submitted', 'approved', 'returned')
);
```

---

### `supabase/migrations/20251024164900_bf4e62fa-c64c-43e6-a1ab-8f742a13ddf4.sql`

#### Блок 1

- **Строки**: 77–92
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.permissions (name, description, resource, action) VALUES
  ('view_own_data', 'Просмотр своих данных', 'user', 'read'),
  ('view_team_data', 'Просмотр данных команды', 'team', 'read'),
  ('view_all_users', 'Просмотр всех пользователей', 'users', 'read'),
  ('manage_users', 'Управление пользователями', 'users', 'write'),
  ('manage_surveys', 'Управление опросами', 'surveys', 'write'),
  ('view_surveys', 'Просмотр опросов', 'surveys', 'read'),
  ('manage_meetings', 'Управление встречами', 'meetings', 'write'),
  ('view_meetings', 'Просмотр встреч', 'meetings', 'read'),
  ('manage_tasks', 'Управление задачами', 'tasks', 'write'),
  ('view_tasks', 'Просмотр задач', 'tasks', 'read'),
  ('manage_career_tracks', 'Управление карьерными треками', 'career', 'write'),
  ('view_career_tracks', 'Просмотр карьерных треков', 'career', 'read'),
  ('manage_system', 'Администрирование системы', 'system', 'admin')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 93–97
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks')
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 98–102
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions 
WHERE name IN ('view_own_data', 'view_team_data', 'view_surveys', 'view_tasks', 'view_meetings', 'view_career_tracks', 'manage_meetings', 'manage_tasks')
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 103–107
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions 
WHERE name IN ('view_all_users', 'manage_users', 'manage_surveys', 'view_surveys', 'manage_meetings', 'view_meetings', 'manage_tasks', 'view_tasks', 'manage_career_tracks', 'view_career_tracks')
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 108–111
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20251024165157_80c586b3-ae9a-4a15-b8ea-130b4a70a5bb.sql`

#### Блок 1

- **Строки**: 32–57
- **Тип операции**: `INSERT`
- **Целевые таблицы**: audit_log
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_id UUID,
  _target_user_id UUID,
  _action_type TEXT,
  _field TEXT DEFAULT NULL,
  _old_value TEXT DEFAULT NULL,
  _new_value TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_log (admin_id, target_user_id, action_type, field, old_value, new_value, details)
  VALUES (_admin_id, _target_user_id, _action_type, _field, _old_value, _new_value, _details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;
```

---

### `supabase/migrations/20251024171243_b54ab4a7-8452-49e2-ad55-a3ce62d02eab.sql`

#### Блок 1

- **Строки**: 1–76
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем базовые права доступа для системы
INSERT INTO permissions (name, description, resource, action) VALUES
  -- Права на пользователей
  ('users.view', 'Просмотр пользователей', 'users', 'view'),
  ('users.create', 'Создание пользователей', 'users', 'create'),
  ('users.update', 'Редактирование пользователей', 'users', 'update'),
  ('users.delete', 'Удаление пользователей', 'users', 'delete'),
  ('users.manage_roles', 'Управление ролями пользователей', 'users', 'manage_roles'),
  
  -- Права на роли
  ('roles.view', 'Просмотр ролей', 'roles', 'view'),
  ('roles.create', 'Создание ролей', 'roles', 'create'),
  ('roles.update', 'Редактирование ролей', 'roles', 'update'),
  ('roles.delete', 'Удаление ролей', 'roles', 'delete'),
  
  -- Права на подразделения
  ('departments.view', 'Просмотр подразделений', 'departments', 'view'),
  ('departments.create', 'Создание подразделений', 'departments', 'create'),
  ('departments.update', 'Редактирование подразделений', 'departments', 'update'),
  ('departments.delete', 'Удаление подразделений', 'departments', 'delete'),
  
  -- Права на должности
  ('positions.view', 'Просмотр должностей', 'positions', 'view'),
  ('positions.create', 'Создание должностей', 'positions', 'create'),
  ('positions.update', 'Редактирование должностей', 'positions', 'update'),
  ('positions.delete', 'Удаление должностей', 'positions', 'delete'),
  
  -- Права на грейды
  ('grades.view', 'Просмотр грейдов', 'grades', 'view'),
  ('grades.create', 'Создание грейдов', 'grades', 'create'),
  ('grades.update', 'Редактирование грейдов', 'grades', 'update'),
  ('grades.delete', 'Удаление грейдов', 'grades', 'delete'),
  
  -- Права на навыки
  ('skills.view', 'Просмотр навыков', 'skills', 'view'),
  ('skills.create', 'Создание навыков', 'skills', 'create'),
  ('skills.update', 'Редактирование навыков', 'skills', 'update'),
  ('skills.delete', 'Удаление навыков', 'skills', 'delete'),
  
  -- Права на качества
  ('qualities.view', 'Просмотр качеств', 'qualities', 'view'),
  ('qualities.create', 'Создание качеств', 'qualities', 'create'),
  ('qualities.update', 'Редактирование качеств', 'qualities', 'update'),
  ('qualities.delete', 'Удаление качеств', 'qualities', 'delete'),
  
  -- Права на опросы
  ('surveys.view', 'Просмотр опросов', 'surveys', 'view'),
  ('surveys.create', 'Создание опросов', 'surveys', 'create'),
  ('surveys.assign', 'Назначение опросов', 'surveys', 'assign'),
  ('surveys.results', 'Просмотр результатов опросов', 'surveys', 'results'),
  
  -- Права на встречи
  ('meetings.view', 'Просмотр встреч', 'meetings', 'view'),
  ('meetings.create', 'Создание встреч', 'meetings', 'create'),
  ('meetings.update', 'Редактирование встреч', 'meetings', 'update'),
  ('meetings.approve', 'Утверждение встреч', 'meetings', 'approve'),
  
  -- Права на отчёты
  ('reports.view', 'Просмотр отчётов', 'reports', 'view'),
  ('reports.export', 'Экспорт отчётов', 'reports', 'export'),
  
  -- Права на настройки
  ('settings.view', 'Просмотр настроек', 'settings', 'view'),
  ('settings.update', 'Изменение настроек', 'settings', 'update'),
  
  -- Права на сессии
  ('sessions.view', 'Просмотр сессий', 'sessions', 'view'),
  ('sessions.revoke', 'Завершение сессий', 'sessions', 'revoke'),
  
  -- Права на аудит
  ('audit.view', 'Просмотр журнала аудита', 'audit', 'view'),
  
  -- Права на управление правами
  ('permissions.view', 'Просмотр прав доступа', 'permissions', 'view'),
  ('permissions.manage', 'Управление правами доступа', 'permissions', 'manage')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 77–93
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли HR BP
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'users.view',
  'users.create', 
  'users.update',
  'departments.view',
  'positions.view',
  'surveys.view',
  'surveys.assign',
  'surveys.results',
  'reports.view',
  'reports.export'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 94–108
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли Manager (Руководитель)
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'users.view',
  'surveys.view',
  'surveys.results',
  'meetings.view',
  'meetings.create',
  'meetings.update',
  'meetings.approve',
  'reports.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 109–118
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли Employee (Сотрудник)
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'surveys.view',
  'meetings.view',
  'meetings.create'
)
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20251024171304_169ddc7f-9ec7-47e0-b30c-663d46dac7d0.sql`

#### Блок 1

- **Строки**: 1–76
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем базовые права доступа для системы
INSERT INTO permissions (name, description, resource, action) VALUES
  -- Права на пользователей
  ('users.view', 'Просмотр пользователей', 'users', 'view'),
  ('users.create', 'Создание пользователей', 'users', 'create'),
  ('users.update', 'Редактирование пользователей', 'users', 'update'),
  ('users.delete', 'Удаление пользователей', 'users', 'delete'),
  ('users.manage_roles', 'Управление ролями пользователей', 'users', 'manage_roles'),
  
  -- Права на роли
  ('roles.view', 'Просмотр ролей', 'roles', 'view'),
  ('roles.create', 'Создание ролей', 'roles', 'create'),
  ('roles.update', 'Редактирование ролей', 'roles', 'update'),
  ('roles.delete', 'Удаление ролей', 'roles', 'delete'),
  
  -- Права на подразделения
  ('departments.view', 'Просмотр подразделений', 'departments', 'view'),
  ('departments.create', 'Создание подразделений', 'departments', 'create'),
  ('departments.update', 'Редактирование подразделений', 'departments', 'update'),
  ('departments.delete', 'Удаление подразделений', 'departments', 'delete'),
  
  -- Права на должности
  ('positions.view', 'Просмотр должностей', 'positions', 'view'),
  ('positions.create', 'Создание должностей', 'positions', 'create'),
  ('positions.update', 'Редактирование должностей', 'positions', 'update'),
  ('positions.delete', 'Удаление должностей', 'positions', 'delete'),
  
  -- Права на грейды
  ('grades.view', 'Просмотр грейдов', 'grades', 'view'),
  ('grades.create', 'Создание грейдов', 'grades', 'create'),
  ('grades.update', 'Редактирование грейдов', 'grades', 'update'),
  ('grades.delete', 'Удаление грейдов', 'grades', 'delete'),
  
  -- Права на навыки
  ('skills.view', 'Просмотр навыков', 'skills', 'view'),
  ('skills.create', 'Создание навыков', 'skills', 'create'),
  ('skills.update', 'Редактирование навыков', 'skills', 'update'),
  ('skills.delete', 'Удаление навыков', 'skills', 'delete'),
  
  -- Права на качества
  ('qualities.view', 'Просмотр качеств', 'qualities', 'view'),
  ('qualities.create', 'Создание качеств', 'qualities', 'create'),
  ('qualities.update', 'Редактирование качеств', 'qualities', 'update'),
  ('qualities.delete', 'Удаление качеств', 'qualities', 'delete'),
  
  -- Права на опросы
  ('surveys.view', 'Просмотр опросов', 'surveys', 'view'),
  ('surveys.create', 'Создание опросов', 'surveys', 'create'),
  ('surveys.assign', 'Назначение опросов', 'surveys', 'assign'),
  ('surveys.results', 'Просмотр результатов опросов', 'surveys', 'results'),
  
  -- Права на встречи
  ('meetings.view', 'Просмотр встреч', 'meetings', 'view'),
  ('meetings.create', 'Создание встреч', 'meetings', 'create'),
  ('meetings.update', 'Редактирование встреч', 'meetings', 'update'),
  ('meetings.approve', 'Утверждение встреч', 'meetings', 'approve'),
  
  -- Права на отчёты
  ('reports.view', 'Просмотр отчётов', 'reports', 'view'),
  ('reports.export', 'Экспорт отчётов', 'reports', 'export'),
  
  -- Права на настройки
  ('settings.view', 'Просмотр настроек', 'settings', 'view'),
  ('settings.update', 'Изменение настроек', 'settings', 'update'),
  
  -- Права на сессии
  ('sessions.view', 'Просмотр сессий', 'sessions', 'view'),
  ('sessions.revoke', 'Завершение сессий', 'sessions', 'revoke'),
  
  -- Права на аудит
  ('audit.view', 'Просмотр журнала аудита', 'audit', 'view'),
  
  -- Права на управление правами
  ('permissions.view', 'Просмотр прав доступа', 'permissions', 'view'),
  ('permissions.manage', 'Управление правами доступа', 'permissions', 'manage')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 77–93
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли HR BP
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'users.view',
  'users.create', 
  'users.update',
  'departments.view',
  'positions.view',
  'surveys.view',
  'surveys.assign',
  'surveys.results',
  'reports.view',
  'reports.export'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 94–108
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли Manager (Руководитель)
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'users.view',
  'surveys.view',
  'surveys.results',
  'meetings.view',
  'meetings.create',
  'meetings.update',
  'meetings.approve',
  'reports.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 109–118
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем базовые права для роли Employee (Сотрудник)
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'surveys.view',
  'meetings.view',
  'meetings.create'
)
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20251024172033_638aa638-b4f5-4b2b-a883-e0bb0b4abc1b.sql`

#### Блок 1

- **Строки**: 1–24
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Migrate existing roles from public.users to user_roles
-- user_roles references auth.users, so we need to link public.users.id to auth.users

-- First check if there's a link between public.users and auth.users
-- Typically public.users.id should match auth.users.id

INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN r.name ILIKE '%admin%' THEN 'admin'::app_role
    WHEN r.name ILIKE '%hr%' OR r.name ILIKE '%бизнес-партнер%' THEN 'hr_bp'::app_role
    WHEN r.name ILIKE '%manager%' OR r.name ILIKE '%руководитель%' THEN 'manager'::app_role
    ELSE 'employee'::app_role
  END
FROM public.users u
LEFT JOIN roles r ON u.role_id = r.id
INNER JOIN auth.users au ON au.id = u.id  -- Only migrate users that exist in auth
WHERE u.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### `supabase/migrations/20251024172728_8fd1328d-c399-41c7-a1a7-57d5b1f4e1d7.sql`

#### Блок 1

- **Строки**: 13–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Now add employee role for all active users who don't have a role yet
INSERT INTO user_roles (user_id, role)
SELECT 
  u.id,
  'employee'::app_role
FROM public.users u
WHERE u.status = true  -- Only active users
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### `supabase/migrations/20251024175424_aa85c563-28ea-4084-a0f4-b085c272c3dc.sql`

#### Блок 1

- **Строки**: 1–22
- **Тип операции**: `INSERT`
- **Целевые таблицы**: auth
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create auth users for existing users in the system
-- This will create auth.users entries with matching IDs to public.users

-- First, we need to insert users into auth.users
-- Since we can't directly insert into auth.users, we'll use a workaround:
-- Create a function that will be called to set up auth users

-- Note: This migration creates the framework. 
-- The actual user creation will be done via the admin API or manually in Supabase dashboard
-- For now, we'll document the process:

-- MANUAL STEPS REQUIRED:
-- 1. Go to Supabase Dashboard -> Authentication -> Users
-- 2. For each user in public.users table, create an auth user with:
--    - Email: same as in public.users
--    - Password: test123 (or any simple password)
--    - User ID: MUST match the ID from public.users table

-- Alternative: Use Supabase Admin API to create users programmatically

-- Add a comment to track this requirement
COMMENT ON TABLE public.users IS 'Each user must have a corresponding auth.users entry with matching ID';
```

---

### `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql`

#### Блок 1

- **Строки**: 1–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: audit_log
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
-- Удалить всех пользователей кроме администратора
-- Сначала удаляем связанные записи

-- Удаляем записи из audit_log
DELETE FROM public.audit_log 
WHERE target_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
   OR admin_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 2

- **Строки**: 8–11
- **Тип операции**: `DELETE`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | role | unknown | yes |

```sql
-- Удаляем записи из user_roles
DELETE FROM public.user_roles 
WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 3

- **Строки**: 12–14
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | task | unknown | yes |

```sql
-- Удаляем записи из других таблиц с foreign keys к users
DELETE FROM public.tasks WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 4

- **Строки**: 15–17
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | meeting | unknown | yes |

```sql
DELETE FROM public.one_on_one_meetings 
WHERE employee_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND manager_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 5

- **Строки**: 18–18
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_stage_participants
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.meeting_stage_participants WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 6

- **Строки**: 19–19
- **Тип операции**: `DELETE`
- **Целевые таблицы**: survey_360_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.survey_360_results WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 7

- **Строки**: 20–20
- **Тип операции**: `DELETE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | assignment | unknown | yes |

```sql
DELETE FROM public.survey_360_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 8

- **Строки**: 21–21
- **Тип операции**: `DELETE`
- **Целевые таблицы**: survey_360_selections
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.survey_360_selections WHERE selector_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 9

- **Строки**: 22–22
- **Тип операции**: `DELETE`
- **Целевые таблицы**: skill_survey_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.skill_survey_results WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 10

- **Строки**: 23–23
- **Тип операции**: `DELETE`
- **Целевые таблицы**: skill_survey_assignments
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.skill_survey_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 11

- **Строки**: 24–24
- **Тип операции**: `DELETE`
- **Целевые таблицы**: development_plans
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.development_plans WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 12

- **Строки**: 25–25
- **Тип операции**: `DELETE`
- **Целевые таблицы**: survey_assignments
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
DELETE FROM public.survey_assignments WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

#### Блок 13

- **Строки**: 26–29
- **Тип операции**: `DELETE`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | user | unknown | yes |

```sql
-- Теперь удаляем самих пользователей
DELETE FROM public.users 
WHERE id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

---

### `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql`

#### Блок 1

- **Строки**: 3–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, admin, auth
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |
| `00000000-0000-0000-0000-000000000000` | unknown | unknown | no |

```sql
-- Create or update admin user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@example.com',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token;
```

#### Блок 2

- **Строки**: 41–58
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | user | unknown | yes |

```sql
-- Ensure user exists in public.users
INSERT INTO public.users (id, employee_number, email, last_name, first_name, status)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'ADMIN001',
  'admin@example.com',
  'User',
  'Admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET
  employee_number = EXCLUDED.employee_number,
  email = EXCLUDED.email,
  last_name = EXCLUDED.last_name,
  first_name = EXCLUDED.first_name,
  status = EXCLUDED.status;
```

#### Блок 3

- **Строки**: 59–66
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | role | unknown | yes |

```sql
-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql`

#### Блок 1

- **Строки**: 3–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, admin, auth
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |
| `00000000-0000-0000-0000-000000000000` | unknown | unknown | no |

```sql
-- Create or update admin user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@example.com',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token;
```

#### Блок 2

- **Строки**: 41–58
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | user | unknown | yes |

```sql
-- Ensure user exists in public.users
INSERT INTO public.users (id, employee_number, email, last_name, first_name, status)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'ADMIN001',
  'admin@example.com',
  'User',
  'Admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET
  employee_number = EXCLUDED.employee_number,
  email = EXCLUDED.email,
  last_name = EXCLUDED.last_name,
  first_name = EXCLUDED.first_name,
  status = EXCLUDED.status;
```

#### Блок 3

- **Строки**: 59–66
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | role | unknown | yes |

```sql
-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df'::uuid,
  'admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### `supabase/migrations/20251024182157_7bfc2245-d76c-4d23-9419-9259b413ee08.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: auth
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | id | yes |

```sql
-- Fix the admin user's confirmation_token
UPDATE auth.users 
SET confirmation_token = NULL
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df';
```

---

### `supabase/migrations/20251024182318_2fa89074-53c7-48e5-80ea-f78aa4784b14.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: auth
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | id | yes |

```sql
-- Fix raw_app_meta_data for admin user
UPDATE auth.users 
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND raw_app_meta_data IS NULL;
```

---

### `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql`

#### Блок 1

- **Строки**: 32–43
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, auth_users
- **Классификация**: `won't_fail_but_env_specific`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | unknown | unknown | no |

```sql
-- Insert admin user with bcrypt hash for password 'test123'
-- Hash generated: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO public.auth_users (id, email, password_hash)
VALUES (
  '9138f9ee-ca94-4563-9016-05e5d2b496df',
  'admin@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    updated_at = now();
```

#### Блок 2

- **Строки**: 44–48
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | user | user_id | yes |

```sql
-- Link existing admin user to auth_users
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com';
```

---

### `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: auth_user_id, users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9138f9ee-ca94-4563-9016-05e5d2b496df` | user | user_id | yes |

```sql
-- Update auth_user_id for admin user to link correctly
UPDATE public.users
SET auth_user_id = '9138f9ee-ca94-4563-9016-05e5d2b496df'
WHERE email = 'admin@example.com' AND auth_user_id IS NULL;
```

---

### `supabase/migrations/20251024190505_56efe2c2-ec96-424e-b575-db03423c93ba.sql`

#### Блок 1

- **Строки**: 1–15
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение прав для ролей (только добавление недостающих)
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions WHERE name IN (
  'view_all_users', 'manage_users', 'permissions.view', 'permissions.manage', 
  'view_surveys', 'manage_surveys', 'view_meetings', 'manage_meetings',
  'view_tasks', 'manage_tasks', 'view_career_tracks', 'manage_career_tracks',
  'view_own_data', 'view_team_data', 'manage_system', 'audit.view',
  'departments.view', 'departments.create', 'departments.update', 'departments.delete',
  'grades.view', 'grades.create', 'grades.update', 'grades.delete',
  'users.create', 'users.update', 'users.delete', 'users.view',
  'roles.view', 'roles.manage', 'surveys.view', 'surveys.create',
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  'reports.view', 'positions.create'
)
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 16–23
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение базовых прав для роли manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'manage_meetings', 'view_meetings',
  'meetings.create', 'meetings.update', 'meetings.approve', 'reports.view', 'view_surveys'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 24–31
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение базовых прав для роли employee
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions WHERE name IN (
  'view_career_tracks', 'meetings.view', 'meetings.create', 'view_meetings',
  'surveys.view', 'view_surveys', 'view_tasks', 'view_own_data'
)
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20251024190704_74a6af7d-9f87-4bb3-91c5-22281f47914e.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновим связь между auth_users и users для admin пользователя
UPDATE users 
SET auth_user_id = (
  SELECT id FROM auth_users WHERE email = users.email LIMIT 1
)
WHERE auth_user_id IS NULL AND email IN (
  SELECT email FROM auth_users
);
```

---

### `supabase/migrations/20251024193835_5916cc73-b32d-4adc-8a3e-4b46f49ad868.sql`

#### Блок 1

- **Строки**: 9–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: decisions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Employees can update decisions in their meetings" ON meeting_decisions;
```

#### Блок 2

- **Строки**: 10–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: decisions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Managers can update decisions in subordinate meetings" ON meeting_decisions;
```

#### Блок 3

- **Строки**: 40–42
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: one_on_one_meetings =======
DROP POLICY IF EXISTS "Admins can update all meetings" ON one_on_one_meetings;
```

#### Блок 4

- **Строки**: 45–45
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Employees can update their draft or returned meetings" ON one_on_one_meetings;
```

#### Блок 5

- **Строки**: 47–47
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: subordinate
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Managers can update subordinate meetings" ON one_on_one_meetings;
```

#### Блок 6

- **Строки**: 71–71
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own qualities" ON user_qualities;
```

#### Блок 7

- **Строки**: 81–81
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can create and update tasks" ON tasks;
```

#### Блок 8

- **Строки**: 100–100
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can update assignment status" ON survey_360_assignments;
```

#### Блок 9

- **Строки**: 114–114
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own career progress" ON user_career_progress;
```

#### Блок 10

- **Строки**: 141–141
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own skills" ON user_skills;
```

---

### `supabase/migrations/20251024193944_2900c51f-4eb4-43d1-8f1e-4b80847137a9.sql`

#### Блок 1

- **Строки**: 38–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all, subordinate, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: one_on_one_meetings =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can update all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Admins can view all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can create their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can update their draft or returned meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can view their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can update subordinate meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can view their subordinates' meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all read access to one_on_one_meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all write access to one_on_one_meetings" ON one_on_one_meetings;

  CREATE POLICY "Allow all read access to one_on_one_meetings"
  ON one_on_one_meetings FOR SELECT
  USING (true);

  CREATE POLICY "Allow all write access to one_on_one_meetings"
  ON one_on_one_meetings FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 2

- **Строки**: 75–88
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_qualities =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can update their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can view their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Allow all access to user_qualities" ON user_qualities;

  CREATE POLICY "Allow all access to user_qualities"
  ON user_qualities FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 3

- **Строки**: 89–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: tasks =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all tasks" ON tasks;
  DROP POLICY IF EXISTS "System can create and update tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;

  CREATE POLICY "Allow all access to tasks"
  ON tasks FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 4

- **Строки**: 116–131
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: survey_360_assignments =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "System can update assignment status" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can create assignments as evaluated user" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can manage survey assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can view assignments involving them" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Allow all access to survey_360_assignments" ON survey_360_assignments;

  CREATE POLICY "Allow all access to survey_360_assignments"
  ON survey_360_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 5

- **Строки**: 132–147
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_career_progress =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow user_career_progress operations for admin panel" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can create their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can update their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can view their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow all access to user_career_progress" ON user_career_progress;

  CREATE POLICY "Allow all access to user_career_progress"
  ON user_career_progress FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 6

- **Строки**: 173–186
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_skills =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can update their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can view their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Allow all access to user_skills" ON user_skills;

  CREATE POLICY "Allow all access to user_skills"
  ON user_skills FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

---

### `supabase/migrations/20251024194014_73f3368f-7c43-4a73-8027-96026d0a587e.sql`

#### Блок 1

- **Строки**: 38–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all, subordinate, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: one_on_one_meetings =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can update all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Admins can view all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can create their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can update their draft or returned meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can view their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can update subordinate meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can view their subordinates' meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all read access to one_on_one_meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all write access to one_on_one_meetings" ON one_on_one_meetings;

  CREATE POLICY "Allow all read access to one_on_one_meetings"
  ON one_on_one_meetings FOR SELECT
  USING (true);

  CREATE POLICY "Allow all write access to one_on_one_meetings"
  ON one_on_one_meetings FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 2

- **Строки**: 75–88
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_qualities =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can update their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can view their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Allow all access to user_qualities" ON user_qualities;

  CREATE POLICY "Allow all access to user_qualities"
  ON user_qualities FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 3

- **Строки**: 89–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: tasks =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all tasks" ON tasks;
  DROP POLICY IF EXISTS "System can create and update tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;

  CREATE POLICY "Allow all access to tasks"
  ON tasks FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 4

- **Строки**: 116–131
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: survey_360_assignments =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "System can update assignment status" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can create assignments as evaluated user" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can manage survey assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can view assignments involving them" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Allow all access to survey_360_assignments" ON survey_360_assignments;

  CREATE POLICY "Allow all access to survey_360_assignments"
  ON survey_360_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 5

- **Строки**: 132–147
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_career_progress =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow user_career_progress operations for admin panel" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can create their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can update their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can view their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow all access to user_career_progress" ON user_career_progress;

  CREATE POLICY "Allow all access to user_career_progress"
  ON user_career_progress FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 6

- **Строки**: 173–186
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_skills =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can update their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can view their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Allow all access to user_skills" ON user_skills;

  CREATE POLICY "Allow all access to user_skills"
  ON user_skills FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

---

### `supabase/migrations/20251024194053_68a9c71f-300c-4886-916b-387bf8d6a841.sql`

#### Блок 1

- **Строки**: 38–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all, subordinate, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: one_on_one_meetings =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can update all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Admins can view all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can create their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can update their draft or returned meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can view their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can update subordinate meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can view their subordinates' meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all read access to one_on_one_meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all write access to one_on_one_meetings" ON one_on_one_meetings;

  CREATE POLICY "Allow all read access to one_on_one_meetings"
  ON one_on_one_meetings FOR SELECT
  USING (true);

  CREATE POLICY "Allow all write access to one_on_one_meetings"
  ON one_on_one_meetings FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 2

- **Строки**: 75–88
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_qualities =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can update their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can view their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Allow all access to user_qualities" ON user_qualities;

  CREATE POLICY "Allow all access to user_qualities"
  ON user_qualities FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 3

- **Строки**: 89–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: tasks =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all tasks" ON tasks;
  DROP POLICY IF EXISTS "System can create and update tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;

  CREATE POLICY "Allow all access to tasks"
  ON tasks FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 4

- **Строки**: 116–131
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: survey_360_assignments =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "System can update assignment status" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can create assignments as evaluated user" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can manage survey assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can view assignments involving them" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Allow all access to survey_360_assignments" ON survey_360_assignments;

  CREATE POLICY "Allow all access to survey_360_assignments"
  ON survey_360_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 5

- **Строки**: 132–147
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_career_progress =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow user_career_progress operations for admin panel" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can create their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can update their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can view their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow all access to user_career_progress" ON user_career_progress;

  CREATE POLICY "Allow all access to user_career_progress"
  ON user_career_progress FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

#### Блок 6

- **Строки**: 173–186
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ======= ТАБЛИЦА: user_skills =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can update their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can view their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Allow all access to user_skills" ON user_skills;

  CREATE POLICY "Allow all access to user_skills"
  ON user_skills FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;
```

---

### `supabase/migrations/20251028092127_11b746f7-d4cf-4744-9152-66799b7df4c0.sql`

#### Блок 1

- **Строки**: 47–52
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON, updated_at
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger to update updated_at
CREATE TRIGGER update_diagnostic_stages_updated_at
BEFORE UPDATE ON public.diagnostic_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 2

- **Строки**: 53–90
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to create diagnostic task for participant
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    'Диагностика - ' || stage_record.period,
    'Необходимо пройти опросы по навыкам и качествам. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'assessment',
    'Диагностика'
  );
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251029095316_9358cf45-d8c8-45c4-8351-bd9b4fedf151.sql`

#### Блок 1

- **Строки**: 26–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their skill survey assignments"
ON public.skill_survey_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = skill_survey_assignments.evaluated_user_id
      OR admin_sessions.user_id = skill_survey_assignments.evaluating_user_id
  )
);
```

#### Блок 2

- **Строки**: 104–113
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their 360 assignments"
ON public.survey_360_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = survey_360_assignments.evaluated_user_id
      OR admin_sessions.user_id = survey_360_assignments.evaluating_user_id
  )
);
```

---

### `supabase/migrations/20251029100621_95f7623b-e555-4238-875f-fe02188572a4.sql`

#### Блок 1

- **Строки**: 119–119
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update qualities" ON public.user_qualities FOR UPDATE USING (true);
```

---

### `supabase/migrations/20251029111800_ec571a29-2ef3-4d1d-8305-c2a463c0a029.sql`

#### Блок 1

- **Строки**: 142–142
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their skill survey assignments" ON public.skill_survey_assignments;
```

#### Блок 2

- **Строки**: 163–176
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own assignments
CREATE POLICY "Users can update their skill survey assignments"
ON public.skill_survey_assignments FOR UPDATE
USING (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
)
WITH CHECK (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user()
  OR is_current_user_admin()
);
```

---

### `supabase/migrations/20251029123032_7769b251-4103-4109-bf51-835b0b4e2ebd.sql`

#### Блок 1

- **Строки**: 5–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: created_by
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update created_by to be NOT NULL if it's currently nullable
ALTER TABLE diagnostic_stages 
ALTER COLUMN created_by SET NOT NULL;
```

#### Блок 2

- **Строки**: 59–103
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic, diagnostic_stages, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to update diagnostic stage status and progress
CREATE OR REPLACE FUNCTION update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
BEGIN
  -- Find the active stage for this participant
  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = COALESCE(NEW.user_id, NEW.evaluated_user_id)
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    -- Calculate new progress
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
    -- Determine new status
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    -- Update the stage
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 104–106
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: progress
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create triggers to update progress when surveys are completed
DROP TRIGGER IF EXISTS update_diagnostic_progress_on_skill_survey ON skill_survey_results;
```

#### Блок 4

- **Строки**: 117–119
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: progress
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger to update progress when participants are added
DROP TRIGGER IF EXISTS update_diagnostic_progress_on_participant ON diagnostic_stage_participants;
```

---

### `supabase/migrations/20251029151904_f4086e82-f2cb-4818-b71b-4478d7252036.sql`

#### Блок 1

- **Строки**: 3–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: certification_id, grades
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Migrate existing text data if needed (optional, for data preservation)
-- Update certification_id based on existing certification text field if there are matches
-- UPDATE grades g
-- SET certification_id = c.id
-- FROM certifications c
-- WHERE g.certification = c.name;
```

---

### `supabase/migrations/20251029153232_cd7f39e5-7c16-45c0-b797-5e92fab66ecc.sql`

#### Блок 1

- **Строки**: 22–28
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: category_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Migrate existing skill categories to category_skills table
INSERT INTO category_skills (name)
SELECT DISTINCT category
FROM skills
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 32–37
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Migrate data from skills.category to skills.category_id
UPDATE skills s
SET category_id = cs.id
FROM category_skills cs
WHERE s.category = cs.name;
```

---

### `supabase/migrations/20251029162142_a67b8e49-8769-430e-bb7f-9c1e0c0af62b.sql`

#### Блок 1

- **Строки**: 7–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing users to have a default grade if needed
-- (You can set a specific default grade or leave as NULL for now)
```

---

### `supabase/migrations/20251029172457_4d2bdd04-59fb-462e-b486-d531ae7d5532.sql`

#### Блок 1

- **Строки**: 3–36
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем отдельную функцию для обновления статуса при добавлении участника диагностики
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  -- Calculate new progress for this stage
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  -- Determine new status
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  -- Update the stage
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030042851_e745548c-2e7d-4ce9-9ba8-fab84c987077.sql`

#### Блок 1

- **Строки**: 114–166
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО НАЗНАЧЕНИЯ ОПРОСОВ
-- =====================================================

CREATE OR REPLACE FUNCTION assign_surveys_to_diagnostic_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  evaluator_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  IF stage_record.evaluation_period IS NULL THEN
    RAISE EXCEPTION 'Evaluation period not set for diagnostic stage';
  END IF;
  
  -- Назначаем skill survey самому участнику (самооценка)
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT DO NOTHING;
  
  -- Назначаем 360 опрос от менеджера (если есть)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 174–222
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. ФУНКЦИЯ ДЛЯ ЗАВЕРШЕНИЯ ЗАДАЧИ ДИАГНОСТИКИ
-- =====================================================

CREATE OR REPLACE FUNCTION complete_diagnostic_task_on_surveys_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  has_skill_survey boolean;
  has_360_survey boolean;
BEGIN
  -- Определяем пользователя в зависимости от таблицы
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  -- Проверяем наличие обоих опросов
  SELECT EXISTS (
    SELECT 1 FROM skill_survey_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM survey_360_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_360_survey;
  
  -- Если оба опроса заполнены, завершаем задачу
  IF has_skill_survey AND has_360_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030043736_f8e89db4-090b-49a7-b402-903edde5b986.sql`

#### Блок 1

- **Строки**: 53–59
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own skills
CREATE POLICY "Users can update their own skills"
ON user_skills
FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());
```

#### Блок 2

- **Строки**: 83–89
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own qualities
CREATE POLICY "Users can update their own qualities"
ON user_qualities
FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());
```

#### Блок 3

- **Строки**: 119–125
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: CAREER, career_tracks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 6: UPDATE CAREER TRACK POLICIES
-- ============================================================================

-- Update career_tracks policies (remove overly permissive ones)
DROP POLICY IF EXISTS "Allow career_tracks operations for admin panel" ON career_tracks;
```

#### Блок 4

- **Строки**: 132–134
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: career_track_steps
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update career_track_steps policies
DROP POLICY IF EXISTS "Allow career_track_steps operations for admin panel testing" ON career_track_steps;
```

#### Блок 5

- **Строки**: 141–150
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: REFERENCE, qualities, skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 7: UPDATE REFERENCE TABLE POLICIES
-- ============================================================================

-- Update skills policies (already has good policies, just verify)
-- skills already has proper policies

-- Update qualities policies (remove overly permissive ones)
DROP POLICY IF EXISTS "Allow qualities operations for admin panel" ON qualities;
```

#### Блок 6

- **Строки**: 157–159
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: category_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update category_skills policies
DROP POLICY IF EXISTS "Admins can manage category_skills" ON category_skills;
```

#### Блок 7

- **Строки**: 166–171
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: grade_qualities, grade_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update grade_skills policies (already has good policies)
-- grade_skills already has proper policies

-- Update grade_qualities policies
DROP POLICY IF EXISTS "Allow grade_qualities operations for admin panel" ON grade_qualities;
```

#### Блок 8

- **Строки**: 178–239
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: FUNCTIONS, SURVEY, calculate_diagnostic_stage_progress
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 8: UPDATE SURVEY QUESTION AND ANSWER OPTION POLICIES
-- ============================================================================

-- All survey questions and answer options remain public for SELECT
-- Only admins can modify them
-- Policies already exist and are correct

-- ============================================================================
-- PART 9: UPDATE FUNCTIONS WITH SECURITY DEFINER
-- ============================================================================

-- Update calculate_diagnostic_stage_progress to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  total_required integer;
  completed_total integer;
  progress numeric;
BEGIN
  -- Count total participants
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  -- If no participants, return 0
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  -- Each participant needs to complete both skill survey and 360 survey
  total_required := total_participants * 2;
  
  -- Count completed skill surveys for participants
  SELECT COUNT(DISTINCT ssr.user_id) INTO completed_skill_surveys
  FROM skill_survey_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Count completed 360 surveys for participants
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM survey_360_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Total completed
  completed_total := completed_skill_surveys + completed_360_surveys;
  
  -- Calculate progress percentage
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;
```

#### Блок 9

- **Строки**: 240–273
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, the, update_diagnostic_stage_on_participant_add
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update update_diagnostic_stage_on_participant_add to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  -- Calculate new progress for this stage
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  -- Determine new status
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  -- Update the stage
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 10

- **Строки**: 274–324
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: assign_surveys_to_diagnostic_participant, skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update assign_surveys_to_diagnostic_participant to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  stage_record RECORD;
  evaluator_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  IF stage_record.evaluation_period IS NULL THEN
    RAISE EXCEPTION 'Evaluation period not set for diagnostic stage';
  END IF;
  
  -- Назначаем skill survey самому участнику (самооценка)
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT DO NOTHING;
  
  -- Назначаем 360 опрос от менеджера (если есть)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 11

- **Строки**: 325–371
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: complete_diagnostic_task_on_surveys_completion, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update complete_diagnostic_task_on_surveys_completion to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_user_id uuid;
  has_skill_survey boolean;
  has_360_survey boolean;
BEGIN
  -- Определяем пользователя в зависимости от таблицы
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  -- Проверяем наличие обоих опросов
  SELECT EXISTS (
    SELECT 1 FROM skill_survey_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM survey_360_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_360_survey;
  
  -- Если оба опроса заполнены, завершаем задачу
  IF has_skill_survey AND has_360_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 12

- **Строки**: 372–437
- **Тип операции**: `INSERT`
- **Целевые таблицы**: admin_activity_logs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 10: ADD ADMIN ACTIVITY LOGGING
-- ============================================================================

-- Create function to log diagnostic stage changes
CREATE OR REPLACE FUNCTION log_diagnostic_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.full_name,
      'CREATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'period', NEW.period,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      )
    FROM users u
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      INSERT INTO admin_activity_logs (
        user_id,
        user_name,
        action,
        entity_type,
        entity_name,
        details
      )
      VALUES (
        get_current_session_user(),
        (SELECT full_name FROM users WHERE id = get_current_session_user()),
        'UPDATE',
        'diagnostic_stage',
        NEW.period,
        jsonb_build_object(
          'stage_id', NEW.id,
          'field', 'status',
          'old_value', OLD.status,
          'new_value', NEW.status
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251030044326_65b0f33e-f4d7-44c6-83d4-65bdad65d9f6.sql`

#### Блок 1

- **Строки**: 1–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: REMAINING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- FINAL RLS SETUP - UPDATE REMAINING TABLES AND FUNCTIONS
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE RLS ON REMAINING TABLES
-- ============================================================================

ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
```

#### Блок 2

- **Строки**: 12–57
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ALL
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 2: UPDATE ALL AUTOMATION FUNCTIONS TO SECURITY DEFINER
-- ============================================================================

-- Already done in previous migration, just verify they are SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  total_required integer;
  completed_total integer;
  progress numeric;
BEGIN
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  total_required := total_participants * 2;
  
  SELECT COUNT(DISTINCT ssr.user_id) INTO completed_skill_surveys
  FROM skill_survey_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM survey_360_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  completed_total := completed_skill_surveys + completed_360_surveys;
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;
```

#### Блок 3

- **Строки**: 177–238
- **Тип операции**: `INSERT`
- **Целевые таблицы**: admin_activity_logs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 3: ADD ADMIN ACTIVITY LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_diagnostic_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.full_name,
      'CREATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'period', NEW.period,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      )
    FROM users u
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    VALUES (
      get_current_session_user(),
      (SELECT full_name FROM users WHERE id = get_current_session_user()),
      'UPDATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251030050310_d6b8a75f-9c92-40e9-a617-3ed52912837e.sql`

#### Блок 1

- **Строки**: 103–119
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RELATED, for
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 7: UPDATE RELATED FUNCTIONS WITH SECURITY DEFINER
-- ============================================================================

-- No specific functions to update for these tables
-- All existing diagnostic functions are already SECURITY DEFINER

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- ✅ RLS enabled on all career and quality tables
-- ✅ Admins have full access (SELECT, INSERT, UPDATE, DELETE)
-- ✅ All users can view reference data (public read)
-- ✅ No manager-specific access needed (reference data is public)
-- ✅ All policies use is_current_user_admin() based on admin_sessions
-- ============================================================================
```

---

### `supabase/migrations/20251030052152_17bff35a-687c-41b2-9e32-a93fb7c18f69.sql`

#### Блок 1

- **Строки**: 96–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: DIAGNOSTIC
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 4: UPDATE DIAGNOSTIC STAGE POLICIES FOR CONSISTENCY
-- ============================================================================

-- Drop and recreate diagnostic_stage_participants policies for consistency
DROP POLICY IF EXISTS "Admins can manage participants" ON diagnostic_stage_participants;
```

#### Блок 2

- **Строки**: 127–170
- **Тип операции**: `INSERT`
- **Целевые таблицы**: FUNCTIONS, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 5: UPDATE FUNCTIONS WITH PROPER SECURITY DEFINER
-- ============================================================================

-- Ensure all stage-related functions have SECURITY DEFINER
-- These already exist but we're explicitly setting SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.create_meeting_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.meeting_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    'Встреча 1:1 - ' || stage_record.period,
    'Необходимо провести встречу 1:1 и заполнить форму. Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'meeting',
    'Встречи 1:1'
  );
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030052821_48ce57ce-cae6-4522-9141-dce645aaf27d.sql`

#### Блок 1

- **Строки**: 46–53
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- ENSURE created_by HAS DEFAULT VALUE
-- ============================================================================

-- Update the column to have a default value for created_by
ALTER TABLE diagnostic_stages 
ALTER COLUMN created_by SET DEFAULT get_current_session_user();
```

---

### `supabase/migrations/20251030052833_41a1cacb-0c03-4798-b403-eea04e2335b9.sql`

#### Блок 1

- **Строки**: 46–53
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- ENSURE created_by HAS DEFAULT VALUE
-- ============================================================================

-- Update the column to have a default value for created_by
ALTER TABLE diagnostic_stages 
ALTER COLUMN created_by SET DEFAULT get_current_session_user();
```

---

### `supabase/migrations/20251030053047_a5a292d1-37b1-4c8c-a8c6-b2e3f3c027f4.sql`

#### Блок 1

- **Строки**: 1–63
- **Тип операции**: `INSERT`
- **Целевые таблицы**: admin_activity_logs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- FIX log_diagnostic_stage_changes FUNCTION
-- ============================================================================
-- Replace full_name with email since full_name column doesn't exist
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_diagnostic_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.email,
      'CREATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'period', NEW.period,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      )
    FROM users u
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    VALUES (
      get_current_session_user(),
      (SELECT email FROM users WHERE id = get_current_session_user()),
      'UPDATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030053322_09b44ea9-35ee-45bf-ab5c-25220d030a83.sql`

#### Блок 1

- **Строки**: 1–42
- **Тип операции**: `INSERT`
- **Целевые таблицы**: all, create_task_for_assignment, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- REPLACE full_name WITH NAME CONCATENATION IN ALL FUNCTIONS
-- ============================================================================
-- Update all database functions to use CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
-- ============================================================================

-- ============================================================================
-- PART 1: UPDATE create_task_for_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Оценка 360',
    'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 43–79
- **Тип операции**: `INSERT`
- **Целевые таблицы**: create_task_for_skill_assignment, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 2: UPDATE create_task_for_skill_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_skill_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Опросник профессиональных навыков',
    'Необходимо пройти опрос профессиональных навыков для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030053439_587880f5-a539-4ac5-be65-81f220c29adf.sql`

#### Блок 1

- **Строки**: 1–42
- **Тип операции**: `INSERT`
- **Целевые таблицы**: all, create_task_for_assignment, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- REPLACE full_name WITH NAME CONCATENATION IN ALL FUNCTIONS
-- ============================================================================
-- Update all database functions to use CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
-- ============================================================================

-- ============================================================================
-- PART 1: UPDATE create_task_for_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Оценка 360',
    'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 43–79
- **Тип операции**: `INSERT`
- **Целевые таблицы**: create_task_for_skill_assignment, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- PART 2: UPDATE create_task_for_skill_assignment FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_task_for_skill_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Опросник профессиональных навыков',
    'Необходимо пройти опрос профессиональных навыков для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030053625_8acb4d5d-5167-49ba-a321-56cc7432b5f7.sql`

#### Блок 1

- **Строки**: 1–27
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: get_user_with_role
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- UPDATE get_user_with_role FUNCTION TO USE NAME COMPONENTS
-- ============================================================================
-- Replace full_name with CONCAT of last_name, first_name, middle_name
-- Note: This function uses user_roles instead of roles table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_with_role(user_email text)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  email text, 
  role_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id, 
    CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, '')) as full_name,
    u.email, 
    ur.role::text as role_name
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.email = user_email;
$$;
```

---

### `supabase/migrations/20251030053759_edd620bb-e7cc-494a-89f1-ac3fd5b55c94.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: policies
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- FIX user_profiles RLS AND POLICIES
-- ============================================================================
-- Enable RLS and update policies to use custom auth system
-- ============================================================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

#### Блок 2

- **Строки**: 13–13
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
```

#### Блок 3

- **Строки**: 29–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());
```

---

### `supabase/migrations/20251030053941_2e26fc9e-2923-41bf-bba7-62f1916896a3.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: policies
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- FIX user_profiles RLS AND POLICIES
-- ============================================================================
-- Enable RLS and update policies to use custom auth system
-- ============================================================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

#### Блок 2

- **Строки**: 13–13
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
```

#### Блок 3

- **Строки**: 29–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());
```

---

### `supabase/migrations/20251030060639_7efdf5de-c1a3-4070-b9c7-9975cfb8efbe.sql`

#### Блок 1

- **Строки**: 1–60
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stages, skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление функции назначения опросов участникам диагностики
-- Убираем проверку evaluation_period и устанавливаем его автоматически

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  eval_period text;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем задание на оценку 360 от руководителя
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251030065426_cda42fbf-2efb-489e-ba72-39fb232dcf40.sql`

#### Блок 1

- **Строки**: 1–74
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stages, skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление логики создания участников этапа диагностики и встреч 1:1

-- 1. Обновляем функцию создания заданий для участника диагностики
-- Добавляем создание самооценки 360
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  eval_period text;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- 1. Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 2. Создаем задание на самооценку 360
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 3. Создаем задание на оценку 360 от руководителя (если есть)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
    AND u.manager_id != NEW.user_id  -- Избегаем дублирования с самооценкой
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251030071131_693ca8d4-d62f-461b-8754-8b6f7e1574a9.sql`

#### Блок 1

- **Строки**: 14–70
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Исправляем функцию update_diagnostic_stage_status для работы с обеими таблицами
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
  target_user_id uuid;
BEGIN
  -- Определяем user_id в зависимости от таблицы
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  ELSIF TG_TABLE_NAME = 'diagnostic_stage_participants' THEN
    target_user_id := NEW.user_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Находим активный этап для этого участника
  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = target_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    -- Вычисляем новый прогресс
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
    -- Определяем новый статус
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    -- Обновляем этап
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251031103523_8718d494-f25e-4614-bb9e-2e56229ff23a.sql`

#### Блок 1

- **Строки**: 1–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: status
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Add new status values and approval fields to survey_360_assignments
-- Update status field to support new workflow: pending_approval, approved, in_progress, completed

-- Add is_manager_participant field to track if manager is participating
ALTER TABLE survey_360_assignments 
ADD COLUMN IF NOT EXISTS is_manager_participant boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;
```

#### Блок 2

- **Строки**: 15–50
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to auto-assign manager as evaluator when employee starts assessment
CREATE OR REPLACE FUNCTION auto_assign_manager_for_360()
RETURNS TRIGGER AS $$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Get the manager of the evaluated user
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.evaluated_user_id;
  
  -- If manager exists and this is the first assignment (self-assessment)
  IF manager_user_id IS NOT NULL AND NEW.evaluating_user_id = NEW.evaluated_user_id THEN
    -- Create manager assignment
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      is_manager_participant,
      approved_by,
      approved_at
    ) VALUES (
      NEW.evaluated_user_id,
      manager_user_id,
      'approved',
      true,
      NEW.evaluated_user_id,
      now()
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### Блок 3

- **Строки**: 58–95
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to create tasks when assignments are approved
CREATE OR REPLACE FUNCTION create_task_on_assignment_approval()
RETURNS TRIGGER AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Create task for evaluating user
    INSERT INTO tasks (
      user_id,
      assignment_id,
      title,
      description,
      status,
      task_type,
      category
    ) VALUES (
      NEW.evaluating_user_id,
      NEW.id,
      'Оценка 360',
      'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
      'pending',
      'assessment',
      'Оценка 360'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

### `supabase/migrations/20251031114159_a6ac3e1e-9044-478d-b279-b451f2e30e03.sql`

#### Блок 1

- **Строки**: 1–24
- **Тип операции**: `DELETE`
- **Целевые таблицы**: public
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем функцию для удаления всех данных из таблицы (только для администраторов)
CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Выполняем удаление всех записей из указанной таблицы
  EXECUTE format('DELETE FROM public.%I', table_name);
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;
```

---

### `supabase/migrations/20251031114813_1bd4f7db-6a87-4101-82bf-582c5414ada3.sql`

#### Блок 1

- **Строки**: 3–31
- **Тип операции**: `DELETE`
- **Целевые таблицы**: public
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем улучшенную функцию для удаления всех данных из таблицы
CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
  sql_query text;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Формируем SQL запрос с полным путем к таблице
  sql_query := format('DELETE FROM public.%I', table_name);
  
  -- Выполняем удаление
  EXECUTE sql_query;
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;
```

#### Блок 2

- **Строки**: 32–104
- **Тип операции**: `DELETE`
- **Целевые таблицы**: career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_results, survey_360_results, tasks
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Также создаем вспомогательную функцию для удаления в правильном порядке с учетом зависимостей
CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
  table_result jsonb;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. survey_360_results
  DELETE FROM public.survey_360_results;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_results', 'count', deleted_count);
  
  -- 9. skill_survey_results
  DELETE FROM public.skill_survey_results;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_results', 'count', deleted_count);
  
  -- 10. career_tracks
  DELETE FROM public.career_tracks;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'career_tracks', 'count', deleted_count);
  
  RETURN result;
END;
$$;
```

---

### `supabase/migrations/20251031124244_ce982c67-4355-48af-b615-046468f06379.sql`

#### Блок 1

- **Строки**: 8–52
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер create_task_on_assignment_approval для проверки наличия пользователя
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Оценка 360',
        'Необходимо пройти оценку 360 для ' || evaluated_user_name,
        'pending',
        'assessment',
        'Оценка 360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031125053_d58c3509-1d7e-4bdd-ad31-51306a340866.sql`

#### Блок 1

- **Строки**: 12–58
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем улучшенную функцию для survey_360_assignments
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Оценка 360',
        'Необходимо пройти оценку 360 для ' || evaluated_user_name,
        'pending',
        'assessment',
        'Оценка 360',
        'survey_360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 59–105
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем функцию для skill_survey_assignments
CREATE OR REPLACE FUNCTION public.create_task_on_skill_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Опросник профессиональных навыков',
        'Необходимо пройти опрос профессиональных навыков для ' || evaluated_user_name,
        'pending',
        'assessment',
        'Опросник навыков',
        'skill_survey'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031125259_623bdf00-ef4d-449f-9eb2-34712337803e.sql`

#### Блок 1

- **Строки**: 1–86
- **Тип операции**: `DELETE`
- **Целевые таблицы**: career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_assignments, skill_survey_results, survey_360_assignments, survey_360_results, tasks, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию admin_cleanup_all_data, добавляя survey_360_assignments и user_assessment_results
CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. survey_360_results
  DELETE FROM public.survey_360_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_results', 'count', deleted_count);
  
  -- 9. skill_survey_results
  DELETE FROM public.skill_survey_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments (НОВОЕ)
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  -- 12. skill_survey_assignments (для полноты)
  DELETE FROM public.skill_survey_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_assignments', 'count', deleted_count);
  
  -- 13. career_tracks
  DELETE FROM public.career_tracks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'career_tracks', 'count', deleted_count);
  
  RETURN result;
END;
$function$;
```

---

### `supabase/migrations/20251031131615_072e33c9-46d7-47bb-997d-c414e2ef24f3.sql`

#### Блок 1

- **Строки**: 1–85
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stages, skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию для автоматического создания survey_360_assignments при добавлении участников диагностики
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  eval_period text;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- 1. Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 2. Создаем задание на самооценку 360 со статусом approved
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved',
    NEW.stage_id,
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 3. Создаем задание на оценку 360 от руководителя (если есть) со статусом approved
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    is_manager_participant,
    approved_at,
    approved_by
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'approved',
    NEW.stage_id,
    true,
    now(),
    NEW.user_id
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
    AND u.manager_id != NEW.user_id
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 86–145
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию создания задач, чтобы создавать задачи и для самооценки
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- Only create task if status is 'approved' and this is a new approval
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Determine task title and description based on whether this is self-assessment or peer assessment
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        -- Self-assessment
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        -- Peer/manager assessment
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        task_title,
        task_description,
        'pending',
        'assessment',
        'Оценка 360',
        'survey_360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 3

- **Строки**: 146–205
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию для создания задач при утверждении skill_survey_assignments
CREATE OR REPLACE FUNCTION public.create_task_on_skill_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- Only create task if status is 'approved' and this is a new approval
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Determine task title and description based on whether this is self-assessment
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        -- Self-assessment
        task_title := 'Самооценка навыков';
        task_description := 'Необходимо пройти самооценку профессиональных навыков';
      ELSE
        -- Peer assessment
        task_title := 'Опросник профессиональных навыков';
        task_description := 'Необходимо пройти опрос профессиональных навыков для ' || evaluated_user_name;
      END IF;
      
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        task_title,
        task_description,
        'pending',
        'assessment',
        'Опросник навыков',
        'skill_survey'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031141822_0ea7fbee-5b66-478f-a6ff-ab8793ab1de1.sql`

#### Блок 1

- **Строки**: 61–65
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, assessment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "System can update assessment results"
  ON user_assessment_results
  FOR UPDATE
  USING (true);
```

#### Блок 2

- **Строки**: 71–146
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to aggregate survey_360 results by evaluator type
CREATE OR REPLACE FUNCTION aggregate_survey_360_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 147–222
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Function to aggregate skill_survey results by evaluator type
CREATE OR REPLACE FUNCTION aggregate_skill_survey_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM skill_survey_results sr
  JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
  JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id;
  
  RETURN NEW;
END;
$$;
```

#### Блок 4

- **Строки**: 234–239
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON, trigger
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update trigger for updated_at
CREATE TRIGGER update_user_assessment_results_updated_at
  BEFORE UPDATE ON user_assessment_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### `supabase/migrations/20251031142614_88246b03-60df-4326-90c0-2fb8b92450dc.sql`

#### Блок 1

- **Строки**: 1–95
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Aggregate existing data directly without calling trigger functions
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  -- Aggregate survey_360_results for each evaluated user
  FOR user_rec IN 
    SELECT DISTINCT evaluated_user_id
    FROM survey_360_results
  LOOP
    -- Delete existing aggregated results for this user
    DELETE FROM user_assessment_results
    WHERE user_id = user_rec.evaluated_user_id;
    
    -- Insert aggregated quality results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      quality_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.evaluated_user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.evaluated_user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      sq.quality_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.evaluated_user_id THEN ao.value ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.evaluated_user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id)
        THEN ao.value 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id) THEN ao.value ELSE NULL END),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = user_rec.evaluated_user_id
      AND sq.quality_id IS NOT NULL
    GROUP BY sq.quality_id;
  END LOOP;
  
  -- Aggregate skill_survey_results for each user
  FOR user_rec IN 
    SELECT DISTINCT user_id
    FROM skill_survey_results
  LOOP
    -- Insert aggregated skill results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      skill_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      ssq.skill_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.user_id THEN ao.step ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.user_id)
        THEN ao.step 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.user_id) THEN ao.step ELSE NULL END),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = user_rec.user_id
      AND ssq.skill_id IS NOT NULL
    GROUP BY ssq.skill_id;
  END LOOP;
END $$;
```

---

### `supabase/migrations/20251031173924_55cc7cef-0d4d-48cf-922a-93d93d9d86fb.sql`

#### Блок 1

- **Строки**: 1–83
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер агрегации результатов 360, чтобы правильно обрабатывать оценки руководителя
CREATE OR REPLACE FUNCTION public.aggregate_survey_360_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id
  ON CONFLICT (user_id, quality_id, assessment_period) 
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    peers_average = EXCLUDED.peers_average,
    manager_assessment = EXCLUDED.manager_assessment,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 84–167
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер агрегации результатов навыков
CREATE OR REPLACE FUNCTION public.aggregate_skill_survey_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM skill_survey_results sr
  JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
  JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id
  ON CONFLICT (user_id, skill_id, assessment_period) 
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    peers_average = EXCLUDED.peers_average,
    manager_assessment = EXCLUDED.manager_assessment,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031173941_07839630-4318-49b2-a1bf-83e7872777ed.sql`

#### Блок 1

- **Строки**: 1–83
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер агрегации результатов 360, чтобы правильно обрабатывать оценки руководителя
CREATE OR REPLACE FUNCTION public.aggregate_survey_360_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id
  ON CONFLICT (user_id, quality_id, assessment_period) 
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    peers_average = EXCLUDED.peers_average,
    manager_assessment = EXCLUDED.manager_assessment,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 84–167
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер агрегации результатов навыков
CREATE OR REPLACE FUNCTION public.aggregate_skill_survey_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM skill_survey_results sr
  JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
  JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id
  ON CONFLICT (user_id, skill_id, assessment_period) 
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    peers_average = EXCLUDED.peers_average,
    manager_assessment = EXCLUDED.manager_assessment,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031174607_ddff9245-f99c-4415-ac90-5206c73547f4.sql`

#### Блок 1

- **Строки**: 1–77
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Убираем ON CONFLICT из триггеров агрегации, так как уникальные индексы уже созданы
-- Теперь используем простой INSERT без ON CONFLICT

CREATE OR REPLACE FUNCTION public.aggregate_survey_360_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031174622_53a47031-abdd-4bfd-ad08-f7c0d89b47a4.sql`

#### Блок 1

- **Строки**: 1–77
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Убираем ON CONFLICT из триггеров агрегации, так как уникальные индексы уже созданы
-- Теперь используем простой INSERT без ON CONFLICT

CREATE OR REPLACE FUNCTION public.aggregate_survey_360_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031181817_ec87b155-c042-461b-bd3e-2b3205b9ef29.sql`

#### Блок 1

- **Строки**: 1–39
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Изменяем функцию создания задачи для участника диагностики
-- Теперь создаётся только одна задача типа "diagnostic_stage"
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем только одну задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    stage_record.period,
    'Необходимо пройти комплексную оценку компетенций (профессиональные навыки и личные качества). Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'diagnostic_stage',
    'Диагностика'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031181901_1b22899b-e6d7-4f0b-a466-1ff2bdaca229.sql`

#### Блок 1

- **Строки**: 1–39
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Изменяем функцию создания задачи для участника диагностики
-- Теперь создаётся только одна задача типа "diagnostic_stage"
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаем только одну задачу для участника
  INSERT INTO public.tasks (
    user_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    stage_record.period,
    'Необходимо пройти комплексную оценку компетенций (профессиональные навыки и личные качества). Срок: ' || stage_record.deadline_date::text,
    'pending',
    stage_record.deadline_date,
    'diagnostic_stage',
    'Диагностика'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031182338_216c60e3-f868-40da-bd3c-886b20b01efa.sql`

#### Блок 1

- **Строки**: 1–94
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stages, skill_survey_assignments, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Проверка и исправление функции автоматического создания назначений при добавлении участника диагностики
-- Эта функция должна создавать:
-- 1. Самооценку 360 (approved)
-- 2. Оценку от руководителя 360 (approved)
-- 3. Самооценку навыков (approved)

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  eval_period text;
  manager_user_id uuid;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- 1. Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 2. Создаем задание на самооценку 360 со статусом approved
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved',
    NEW.stage_id,
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 3. Создаем задание на оценку 360 от руководителя (если есть) со статусом approved
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      diagnostic_stage_id,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      'approved',
      NEW.stage_id,
      true,
      now(),
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031185524_1fbc207b-675f-42d5-90ea-f4a25371dbc7.sql`

#### Блок 1

- **Строки**: 10–103
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем улучшенную функцию создания задач при добавлении участника
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Проверяем, что задача для участника еще не создана
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    -- Создаем только одну задачу для участника
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Комплексная диагностика',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег для оценки 360). Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Если есть руководитель, создаем задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Проверяем, что задача для руководителя еще не создана
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      -- Создаем задачу для руководителя
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 104–143
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем функцию удаления задач при удалении участника
CREATE OR REPLACE FUNCTION public.delete_diagnostic_tasks_on_participant_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Удаляем задачу участника
  DELETE FROM public.tasks
  WHERE user_id = OLD.user_id
    AND diagnostic_stage_id = OLD.stage_id
    AND task_type = 'diagnostic_stage';
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = OLD.user_id;
  
  IF manager_user_id IS NOT NULL THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
    INTO participant_full_name
    FROM public.users
    WHERE id = OLD.user_id;
    
    -- Удаляем задачу руководителя для этого участника
    DELETE FROM public.tasks
    WHERE user_id = manager_user_id
      AND diagnostic_stage_id = OLD.stage_id
      AND task_type = 'survey_360_evaluation'
      AND title ILIKE '%' || participant_full_name || '%';
  END IF;
  
  RETURN OLD;
END;
$$;
```

---

### `supabase/migrations/20251031190620_016a4ccc-5c17-452a-88a7-89faecf6331a.sql`

#### Блок 1

- **Строки**: 1–91
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию создания задач при добавлении участника в этап диагностики
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаём только одну задачу для участника: комплексная диагностика
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Комплексная диагностика (самооценка + выбор коллег)',
      'Необходимо пройти комплексную оценку компетенций. Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные будут расшифрованы на клиенте)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031191204_17593ff6-c3bd-4b8c-bdf0-4a8f5d45fa75.sql`

#### Блок 1

- **Строки**: 1–61
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию создания задач для 360 assignments
-- Теперь она НЕ создаёт задачи, если assignment связан с diagnostic_stage_id
-- (задачи создаются только через триггер create_diagnostic_task_for_participant)
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- НЕ создаём задачи для assignments в контексте diagnostic stage
  -- (задачи создаются через триггер create_diagnostic_task_for_participant)
  IF NEW.diagnostic_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Только для assignments вне diagnostic stage создаём задачу
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        task_title,
        task_description,
        'pending',
        'assessment',
        'Оценка 360',
        'survey_360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031192352_d0fd1e52-aa22-4f45-933b-dfc1151b22a6.sql`

#### Блок 1

- **Строки**: 1–9
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Удаляем все задачи "Оценка 360" без diagnostic_stage_id
DELETE FROM tasks 
WHERE diagnostic_stage_id IS NULL 
  AND (
    task_type IN ('survey_360', 'assessment_360') 
    OR assignment_type = 'survey_360'
    OR title ILIKE '%Оценка 360%'
    OR category = 'Оценка 360'
  );
```

#### Блок 2

- **Строки**: 10–70
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем функцию create_task_on_assignment_approval 
-- чтобы НЕ создавать задачи для assignments в diagnostic stage
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- НЕ создаём задачи для assignments в контексте diagnostic stage
  -- (задачи создаются через триггер create_diagnostic_task_for_participant)
  IF NEW.diagnostic_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Только для assignments вне diagnostic stage создаём задачу
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        task_title,
        task_description,
        'pending',
        'assessment',
        'Оценка 360',
        'survey_360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251031195715_eb63bf82-d04d-4441-92e4-ef3b9493a1be.sql`

#### Блок 1

- **Строки**: 6–14
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем существующие записи на основе is_manager_participant и сравнения user_id
UPDATE public.survey_360_assignments
SET assignment_type = CASE
  WHEN evaluated_user_id = evaluating_user_id THEN 'self'
  WHEN is_manager_participant = true THEN 'manager'
  ELSE 'peer'
END
WHERE assignment_type IS NULL;
```

#### Блок 2

- **Строки**: 38–129
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Улучшаем триггер создания задач для участников диагностики
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаём только одну задачу для участника: комплексная диагностика
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Комплексная диагностика (самооценка + выбор коллег)',
      'Необходимо пройти комплексную оценку компетенций. Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные будут расшифрованы на клиенте)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 136–217
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stages, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. Триггер для автоматического создания self и manager assignments
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  eval_period text;
  manager_user_id uuid;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем задание на самооценку 360 со статусом approved и типом self
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    assignment_type,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved',
    NEW.stage_id,
    'self',
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем задание на оценку 360 от руководителя (если есть) со статусом approved и типом manager
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      diagnostic_stage_id,
      assignment_type,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      'approved',
      NEW.stage_id,
      'manager',
      true,
      now(),
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 4

- **Строки**: 224–263
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Триггер удаления задач при удалении участника
CREATE OR REPLACE FUNCTION public.delete_diagnostic_tasks_on_participant_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Удаляем задачу участника
  DELETE FROM public.tasks
  WHERE user_id = OLD.user_id
    AND diagnostic_stage_id = OLD.stage_id
    AND task_type = 'diagnostic_stage';
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = OLD.user_id;
  
  IF manager_user_id IS NOT NULL THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
    INTO participant_full_name
    FROM public.users
    WHERE id = OLD.user_id;
    
    -- Удаляем задачу руководителя для этого участника
    DELETE FROM public.tasks
    WHERE user_id = manager_user_id
      AND diagnostic_stage_id = OLD.stage_id
      AND task_type = 'survey_360_evaluation'
      AND title ILIKE '%' || participant_full_name || '%';
  END IF;
  
  RETURN OLD;
END;
$$;
```

---

### `supabase/migrations/20251031205116_b7458d96-6a2e-4a79-9129-1f08dc227c21.sql`

#### Блок 1

- **Строки**: 17–98
- **Тип операции**: `DELETE`
- **Целевые таблицы**: career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_results, survey_360_assignments, survey_360_results, tasks, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Обновляем функцию очистки данных (исключаем skill_survey_assignments)
CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. survey_360_results
  DELETE FROM public.survey_360_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_results', 'count', deleted_count);
  
  -- 9. skill_survey_results
  DELETE FROM public.skill_survey_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  -- 12. career_tracks
  DELETE FROM public.career_tracks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'career_tracks', 'count', deleted_count);
  
  RETURN result;
END;
$function$;
```

---

### `supabase/migrations/20251031205734_4ba83934-9f75-4982-a1be-8effd5379f28.sql`

#### Блок 1

- **Строки**: 57–132
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 11. Обновляем функцию агрегации результатов soft skills (survey_360)
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 133–208
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 12. Обновляем функцию агрегации результатов hard skills (skill_survey)
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions ssq ON sr.question_id = ssq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 3

- **Строки**: 239–282
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 16. Обновляем функцию завершения диагностических задач
CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  has_hard_skill_survey boolean;
  has_soft_skill_survey boolean;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM hard_skill_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_hard_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM soft_skill_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_soft_skill_survey;
  
  IF has_hard_skill_survey AND has_soft_skill_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251101113911_216049f0-599c-444d-b49f-fa6acc080730.sql`

#### Блок 1

- **Строки**: 1–76
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update admin_cleanup_all_data function to exclude career_tracks table
CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. soft_skill_results (survey_360_results)
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 9. hard_skill_results (skill_survey_results)
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  RETURN result;
END;
$function$;
```

---

### `supabase/migrations/20251101121747_ffb85ce4-12e4-43ca-93c0-9b1d842f3c8c.sql`

#### Блок 1

- **Строки**: 42–113
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- 3. ОБНОВЛЕНИЕ ФУНКЦИЙ АГРЕГАЦИИ
-- ============================================================================

-- 3.1. Функция агрегации для hard_skill_results
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Получаем diagnostic_stage_id
  stage_id := NEW.diagnostic_stage_id;
  
  -- Получаем manager_id
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Удаляем существующие агрегированные результаты для этого этапа
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id
    AND skill_id IS NOT NULL;
  
  -- Агрегируем результаты по навыкам
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    manager_assessment,
    peers_average,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    get_evaluation_period(NOW()),
    NOW(),
    hq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peers average
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value 
      ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 114–181
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3.2. Функция агрегации для soft_skill_results
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Получаем diagnostic_stage_id
  stage_id := NEW.diagnostic_stage_id;
  
  -- Получаем manager_id
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Удаляем существующие агрегированные результаты для этого этапа
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id
    AND quality_id IS NOT NULL;
  
  -- Агрегируем результаты по качествам
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    manager_assessment,
    peers_average,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    get_evaluation_period(NOW()),
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peers average
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value 
      ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 3

- **Строки**: 182–225
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- 4. ОБНОВЛЕНИЕ ФУНКЦИЙ ДЛЯ USER_SKILLS И USER_QUALITIES
-- ============================================================================

-- 4.1. Обновление user_skills из hard_skill_results
CREATE OR REPLACE FUNCTION public.update_user_skills_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      hq.skill_id,
      ao.numeric_value,
      ao.numeric_value + 1,
      NEW.created_at
    FROM hard_skill_questions hq
    JOIN hard_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE hq.id = NEW.question_id 
      AND hq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM hard_skill_results sr
        JOIN hard_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN hard_skill_questions hq ON hq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND hq.skill_id = user_skills.skill_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 4

- **Строки**: 226–265
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4.2. Обновление user_qualities из soft_skill_results
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      ao.numeric_value + 1,
      NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM soft_skill_results sr
        JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN soft_skill_questions sq ON sq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND sq.quality_id = user_qualities.quality_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 5

- **Строки**: 266–331
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- 5. ОБНОВЛЕНИЕ ТРИГГЕРА НАЗНАЧЕНИЙ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем самооценку
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем оценку руководителя (если есть)
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 6

- **Строки**: 332–355
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- 6. СИНХРОНИЗАЦИЯ СТАТУСОВ ЗАДАЧ И НАЗНАЧЕНИЙ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Если статус assignment стал 'completed', обновляем все связанные задачи
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE assignment_id = NEW.id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 7

- **Строки**: 389–395
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update hard_skill_results"
  ON hard_skill_results FOR UPDATE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );
```

#### Блок 8

- **Строки**: 426–432
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update soft_skill_results"
  ON soft_skill_results FOR UPDATE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );
```

#### Блок 9

- **Строки**: 448–453
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем новые триггеры
CREATE TRIGGER aggregate_hard_skill_results_trigger
  AFTER INSERT OR UPDATE ON hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_hard_skill_results();
```

---

### `supabase/migrations/20251101133545_1f64e97c-6d1e-400f-b991-219a67d7cc9e.sql`

#### Блок 1

- **Строки**: 1–24
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =========================================================
-- Выравнивание статусов: БД использует 'completed', UI - 'Выполнено'
-- =========================================================

-- 1. Исправляем триггер update_task_status_on_assignment_change
CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Если статус assignment стал 'completed', обновляем все связанные задачи
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE assignment_id = NEW.id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 25–52
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assignment, corresponding, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Исправляем триггер update_assignment_on_survey_completion
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update assignment status to completed
  UPDATE public.survey_360_assignments
  SET status = 'completed',
      updated_at = now()
  WHERE evaluated_user_id = NEW.evaluated_user_id 
    AND evaluating_user_id = NEW.evaluating_user_id;
  
  -- Update corresponding task status
  UPDATE public.tasks
  SET status = 'completed',
      updated_at = now()
  FROM public.survey_360_assignments sa
  WHERE tasks.assignment_id = sa.id
    AND sa.evaluated_user_id = NEW.evaluated_user_id
    AND sa.evaluating_user_id = NEW.evaluating_user_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 3

- **Строки**: 53–57
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновляем существующие записи с 'выполнено' на 'completed'
UPDATE public.survey_360_assignments
SET status = 'completed'
WHERE status = 'выполнено';
```

#### Блок 4

- **Строки**: 58–61
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
UPDATE public.tasks
SET status = 'completed'
WHERE status = 'выполнено';
```

---

### `supabase/migrations/20251101150721_f049de38-cadd-4c02-9b88-ae21a0cf4eab.sql`

#### Блок 1

- **Строки**: 1–62
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление триггера создания assignments при добавлении участника в этап диагностики
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем самооценку
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    manager_user_id  -- ✅ ИСПРАВЛЕНО: теперь руководитель
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем оценку руководителя (если есть)
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id  -- ✅ ИСПРАВЛЕНО: теперь руководитель
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 63–181
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление триггера создания задач при добавлении участника в этап диагностики
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Получаем ID самооценки из survey_360_assignments
  SELECT id INTO self_assignment_id
  FROM public.survey_360_assignments
  WHERE evaluated_user_id = NEW.user_id
    AND evaluating_user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND assignment_type = 'self';
  
  -- Создаём только одну задачу для участника: самооценка
  IF self_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
      AND assignment_id = self_assignment_id
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Получаем ID назначения руководителя из survey_360_assignments
    SELECT id INTO manager_assignment_id
    FROM public.survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND assignment_type = 'manager';
    
    -- Получаем ФИО участника
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF manager_assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND assignment_id = manager_assignment_id
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251101152358_65de083d-a682-45e3-a4a5-167babccf4b5.sql`

#### Блок 1

- **Строки**: 4–140
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём единый триггер с правильным порядком действий
CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
BEGIN
  -- Получаем руководителя участника и дедлайн этапа
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id
    AND ds.id = NEW.stage_id;
  
  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users
  WHERE id = NEW.user_id;
  
  -- ШАГ 1: Создаём самооценку в survey_360_assignments
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type
  RETURNING id INTO self_assignment_id;
  
  -- ШАГ 2: Создаём задачу для участника (самооценка)
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    assignment_id,
    assignment_type,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    self_assignment_id,
    'self',
    'Пройти самооценку',
    'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
    'pending',
    stage_deadline,
    'diagnostic_stage',
    'Диагностика'
  )
  ON CONFLICT DO NOTHING;
  
  -- ШАГ 3: Если есть руководитель, создаём оценку руководителя
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Создаём назначение для руководителя
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type
    RETURNING id INTO manager_assignment_id;
    
    -- ШАГ 4: Создаём задачу для руководителя
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      manager_user_id,
      NEW.stage_id,
      manager_assignment_id,
      'manager',
      'Оценка подчинённого: ' || participant_full_name,
      'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
      'pending',
      stage_deadline,
      'survey_360_evaluation',
      'Оценка 360'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251101153107_76fe0837-cc87-467f-a292-43992a82603b.sql`

#### Блок 1

- **Строки**: 33–169
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Создаём функцию с СТРОГОЙ последовательностью
CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
BEGIN
  -- Получаем руководителя участника и дедлайн этапа
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id
    AND ds.id = NEW.stage_id;
  
  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users
  WHERE id = NEW.user_id;
  
  -- ШАГ 1: Создаём самооценку в survey_360_assignments
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type
  RETURNING id INTO self_assignment_id;
  
  -- ШАГ 2: Создаём задачу для участника (самооценка)
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    assignment_id,
    assignment_type,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    self_assignment_id,
    'self',
    'Пройти самооценку',
    'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
    'pending',
    stage_deadline,
    'diagnostic_stage',
    'assessment'
  )
  ON CONFLICT DO NOTHING;
  
  -- ШАГ 3: Если есть руководитель, создаём оценку руководителя
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Создаём назначение для руководителя
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type
    RETURNING id INTO manager_assignment_id;
    
    -- ШАГ 4: Создаём задачу для руководителя
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      manager_user_id,
      NEW.stage_id,
      manager_assignment_id,
      'manager',
      'Оценка подчинённого: ' || participant_full_name,
      'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
      'pending',
      stage_deadline,
      'survey_360_evaluation',
      'assessment'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251101153610_ba1b0ce3-69fd-4b5a-a0b0-340e065d5473.sql`

#### Блок 1

- **Строки**: 1–155
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем триггер: убираем ON CONFLICT DO NOTHING из tasks
-- так как нет уникальных constraints кроме PRIMARY KEY

CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
  existing_task_count INT;
BEGIN
  -- Получаем руководителя участника и дедлайн этапа
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id
    AND ds.id = NEW.stage_id;
  
  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users
  WHERE id = NEW.user_id;
  
  -- ШАГ 1: Создаём самооценку в survey_360_assignments
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type
  RETURNING id INTO self_assignment_id;
  
  -- ШАГ 2: Проверяем, есть ли уже задача для этого assignment
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id;
  
  -- Создаём задачу только если её ещё нет
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
      'pending',
      stage_deadline,
      'diagnostic_stage',
      'assessment'
    );
  END IF;
  
  -- ШАГ 3: Если есть руководитель, создаём оценку руководителя
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Создаём назначение для руководителя
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type
    RETURNING id INTO manager_assignment_id;
    
    -- ШАГ 4: Проверяем, есть ли уже задача для руководителя
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;
    
    -- Создаём задачу только если её ещё нет
    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
        'pending',
        stage_deadline,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251101153935_19d61fa6-8026-4954-80e6-be992ea89220.sql`

#### Блок 1

- **Строки**: 1–67
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем триггер create_task_on_assignment_approval
-- Теперь берём assignment_type из survey_360_assignments, а не хардкодим 'survey_360'

CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- НЕ создаём задачи для assignments в контексте diagnostic stage
  -- (задачи создаются через триггер handle_diagnostic_participant_added)
  IF NEW.diagnostic_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Только для assignments вне diagnostic stage создаём задачу
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      -- Проверяем, нет ли уже задачи для этого assignment
      IF NOT EXISTS (
        SELECT 1 FROM tasks 
        WHERE assignment_id = NEW.id 
          AND user_id = NEW.evaluating_user_id
      ) THEN
        INSERT INTO tasks (
          user_id,
          assignment_id,
          title,
          description,
          status,
          task_type,
          category,
          assignment_type
        ) VALUES (
          NEW.evaluating_user_id,
          NEW.id,
          task_title,
          task_description,
          'pending',
          'assessment',
          'assessment',
          NEW.assignment_type  -- ✅ ИСПРАВЛЕНО: берём из assignment, а не хардкодим
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251101154416_0f00b72a-4f8e-4a06-9538-1fe54077fabc.sql`

#### Блок 1

- **Строки**: 1–48
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем триггер auto_assign_manager_for_360
-- Теперь явно устанавливаем assignment_type='manager'

CREATE OR REPLACE FUNCTION public.auto_assign_manager_for_360()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Get the manager of the evaluated user
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.evaluated_user_id;
  
  -- If manager exists and this is the first assignment (self-assessment)
  IF manager_user_id IS NOT NULL AND NEW.evaluating_user_id = NEW.evaluated_user_id THEN
    -- Create manager assignment with explicit assignment_type='manager'
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_by,
      approved_at
    ) VALUES (
      NEW.evaluated_user_id,
      manager_user_id,
      NEW.diagnostic_stage_id,  -- ✅ Передаём diagnostic_stage_id из самооценки
      'manager',                 -- ✅ ИСПРАВЛЕНО: явно устанавливаем assignment_type
      'approved',
      true,
      manager_user_id,           -- ✅ Утверждает руководитель
      now()
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251101161419_de9ef741-2189-42a4-80bf-6355f6d5907b.sql`

#### Блок 1

- **Строки**: 1–36
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- ДОБАВЛЕНИЕ ПРАВ ДОСТУПА ДЛЯ ДИАГНОСТИКИ КОМПЕТЕНЦИЙ
-- =====================================================

-- Добавляем права для диагностики, если их ещё нет
INSERT INTO permissions (name, description, resource, action)
VALUES 
  -- Диагностика компетенций
  ('diagnostics.create', 'Создание этапов диагностики', 'diagnostics', 'create'),
  ('diagnostics.view', 'Просмотр этапов диагностики', 'diagnostics', 'view'),
  ('diagnostics.update', 'Редактирование этапов диагностики', 'diagnostics', 'update'),
  ('diagnostics.delete', 'Удаление этапов диагностики', 'diagnostics', 'delete'),
  ('diagnostics.manage_participants', 'Управление участниками диагностики', 'diagnostics', 'manage_participants'),
  ('diagnostics.view_results', 'Просмотр результатов диагностики', 'diagnostics', 'view_results'),
  ('diagnostics.export_results', 'Экспорт результатов диагностики', 'diagnostics', 'export_results'),
  
  -- Задачи
  ('tasks.create', 'Создание задач', 'tasks', 'create'),
  ('tasks.view', 'Просмотр задач', 'tasks', 'view'),
  ('tasks.update', 'Редактирование задач', 'tasks', 'update'),
  ('tasks.delete', 'Удаление задач', 'tasks', 'delete'),
  
  -- Карьерные треки
  ('career.create', 'Создание карьерных треков', 'career', 'create'),
  ('career.update', 'Редактирование карьерных треков', 'career', 'update'),
  ('career.delete', 'Удаление карьерных треков', 'career', 'delete'),
  
  -- Команда
  ('team.view', 'Просмотр команды', 'team', 'view'),
  ('team.manage', 'Управление командой', 'team', 'manage'),
  
  -- Развитие
  ('development.view', 'Просмотр планов развития', 'development', 'view'),
  ('development.create', 'Создание планов развития', 'development', 'create'),
  ('development.update', 'Редактирование планов развития', 'development', 'update')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 37–50
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем права администратору (он должен иметь все права)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'tasks.create', 'tasks.view', 'tasks.update', 'tasks.delete',
  'career.create', 'career.update', 'career.delete',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 3

- **Строки**: 51–63
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем права HR BP
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.create', 'diagnostics.view', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.manage_participants', 'diagnostics.view_results', 'diagnostics.export_results',
  'team.view', 'team.manage',
  'development.view', 'development.create', 'development.update',
  'reports.view', 'reports.export'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 4

- **Строки**: 64–77
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем права руководителю
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view', 'diagnostics.view_results',
  'team.view', 'team.manage',
  'meetings.create', 'meetings.view', 'meetings.update', 'meetings.approve',
  'tasks.view', 'tasks.create', 'tasks.update',
  'development.view', 'development.create', 'development.update',
  'reports.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 5

- **Строки**: 78–91
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначаем права сотруднику
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, p.id
FROM permissions p
WHERE p.name IN (
  'diagnostics.view',
  'surveys.view',
  'tasks.view',
  'development.view',
  'career.read',
  'meetings.create', 'meetings.view', 'meetings.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

---

### `supabase/migrations/20251106072712_af4f57ee-d5a2-45a1-8d5c-2282d1e9a3af.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: DROP, RLS, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update RLS policy for survey_360_assignments to allow managers to update
DROP POLICY IF EXISTS "Users can update their 360 assignments" ON survey_360_assignments;
```

#### Блок 2

- **Строки**: 3–12
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users can update their 360 assignments" 
ON survey_360_assignments
FOR UPDATE 
USING (
  (evaluated_user_id = get_current_session_user()) 
  OR (evaluating_user_id = get_current_session_user())
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);
```

---

### `supabase/migrations/20251106122618_85e2bde1-7072-4ced-bfb7-c6d94b9a4e88.sql`

#### Блок 1

- **Строки**: 20–25
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own career progress
CREATE POLICY "Users can update their own career progress"
ON public.user_career_progress
FOR UPDATE
USING (user_id = get_current_session_user() OR is_current_user_admin());
```

---

### `supabase/migrations/20251106144056_ccd48a07-f5e8-4db1-9d3a-790b2369150d.sql`

#### Блок 1

- **Строки**: 1–53
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление функции update_diagnostic_stage_status
-- Проблема: для hard_skill_results использовалось NEW.user_id, но поле называется evaluated_user_id

CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
  target_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;  -- ИСПРАВЛЕНО: было NEW.user_id
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  ELSIF TG_TABLE_NAME = 'diagnostic_stage_participants' THEN
    target_user_id := NEW.user_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = target_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251106144748_f68c26c4-b18b-47d0-8ea3-900ef2f942a3.sql`

#### Блок 1

- **Строки**: 1–46
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправление функции complete_diagnostic_task_on_surveys_completion
-- Проблема: для hard_skill_results использовалось NEW.user_id и WHERE user_id, 
-- но поле называется evaluated_user_id

CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  has_hard_skill_survey boolean;
  has_soft_skill_survey boolean;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;  -- ИСПРАВЛЕНО: было NEW.user_id
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM hard_skill_results 
    WHERE evaluated_user_id = target_user_id  -- ИСПРАВЛЕНО: было user_id
    LIMIT 1
  ) INTO has_hard_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM soft_skill_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_soft_skill_survey;
  
  IF has_hard_skill_survey AND has_soft_skill_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251113105319_004d6b10-211b-4712-a4a2-dfa60f02f783.sql`

#### Блок 1

- **Строки**: 35–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: own
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
```

#### Блок 2

- **Строки**: 56–56
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can update skills" ON public.user_skills;
```

#### Блок 3

- **Строки**: 62–62
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can update qualities" ON public.user_qualities;
```

#### Блок 4

- **Строки**: 228–232
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "profiles_update_own"
ON public.user_profiles FOR UPDATE
USING (user_id = get_current_session_user())
WITH CHECK (user_id = get_current_session_user());
```

---

### `supabase/migrations/20251113110202_444eff51-5d1a-4250-820f-a43639afa667.sql`

#### Блок 1

- **Строки**: 65–77
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "meeting_decisions_update_participants"
ON public.meeting_decisions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM one_on_one_meetings m
  WHERE m.id = meeting_decisions.meeting_id
    AND (m.employee_id = get_current_session_user() OR m.manager_id = get_current_session_user())
));
```

---

### `supabase/migrations/20251113140622_efad24ee-7111-4928-ba39-e108c574ef27.sql`

#### Блок 1

- **Строки**: 1–99
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ ДИАГНОСТИКИ (ЧАСТЬ 2)
-- Пересоздание всех функций и триггеров
-- ========================================

-- ФУНКЦИЯ 1: обработка добавления участника диагностики (ПЕРЕПИСАНА)
CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
  existing_task_count INT;
BEGIN
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;
  
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;
  
  INSERT INTO survey_360_assignments (
    evaluated_user_id, evaluating_user_id, diagnostic_stage_id,
    assignment_type, status, approved_at, approved_by
  ) VALUES (
    NEW.user_id, NEW.user_id, NEW.stage_id,
    'self', 'approved', now(), COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type,
    status = 'approved'
  RETURNING id INTO self_assignment_id;
  
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id;
  
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id, diagnostic_stage_id, assignment_id, assignment_type,
      title, description, status, deadline, task_type, category
    ) VALUES (
      NEW.user_id, NEW.stage_id, self_assignment_id, 'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
      'pending', stage_deadline, 'diagnostic_stage', 'assessment'
    );
  END IF;
  
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id, evaluating_user_id, diagnostic_stage_id,
      assignment_type, status, is_manager_participant, approved_at, approved_by
    ) VALUES (
      NEW.user_id, manager_user_id, NEW.stage_id,
      'manager', 'approved', true, now(), manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type,
      status = 'approved'
    RETURNING id INTO manager_assignment_id;
    
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;
    
    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id, diagnostic_stage_id, assignment_id, assignment_type,
        title, description, status, deadline, task_type, category
      ) VALUES (
        manager_user_id, NEW.stage_id, manager_assignment_id, 'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
        'pending', stage_deadline, 'survey_360_evaluation', 'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 100–146
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ФУНКЦИЯ 2: агрегация hard_skill_results (ИСПРАВЛЕНА)
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND skill_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), hq.skill_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id;
  
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 147–193
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ФУНКЦИЯ 3: агрегация soft_skill_results (ИСПРАВЛЕНА)
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$$;
```

#### Блок 4

- **Строки**: 194–210
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ФУНКЦИЯ 4: автообновление assignment при завершении опроса
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_draft = false AND NEW.assignment_id IS NOT NULL THEN
    UPDATE survey_360_assignments
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.assignment_id AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$$;
```

#### Блок 5

- **Строки**: 211–227
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ФУНКЦИЯ 5: автообновление статуса задачи при изменении assignment
CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$$;
```

#### Блок 6

- **Строки**: 228–269
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ФУНКЦИЯ 6: создание задач при утверждении assignment
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  IF NEW.diagnostic_stage_id IS NOT NULL THEN RETURN NEW; END IF;
  
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360: ' || evaluated_user_name;
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE assignment_id = NEW.id AND user_id = NEW.evaluating_user_id) THEN
        INSERT INTO tasks (
          user_id, assignment_id, title, description,
          status, task_type, category, assignment_type
        ) VALUES (
          NEW.evaluating_user_id, NEW.id, task_title, task_description,
          'pending', 'assessment', 'assessment', NEW.assignment_type
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251113140825_ca1a3363-737d-4a86-9864-fb8b30ee6819.sql`

#### Блок 1

- **Строки**: 68–72
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Триггеры для survey_360_assignments
CREATE TRIGGER update_survey_360_assignments_updated_at
BEFORE UPDATE ON survey_360_assignments
FOR EACH ROW EXECUTE FUNCTION update_survey_360_selections_updated_at();
```

#### Блок 2

- **Строки**: 81–85
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Триггеры для one_on_one_meetings
CREATE TRIGGER update_meeting_task_on_approval
AFTER UPDATE ON one_on_one_meetings
FOR EACH ROW EXECUTE FUNCTION update_meeting_task_status();
```

#### Блок 3

- **Строки**: 86–94
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ИСПРАВЛЕНИЕ ДАННЫХ В БАЗЕ
-- ==========================

-- 1. Обновляем все задачи диагностики, чтобы category было 'assessment'
UPDATE tasks
SET category = 'assessment'
WHERE task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey')
  AND category != 'assessment';
```

#### Блок 4

- **Строки**: 95–104
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Обновляем статусы назначений, у которых есть результаты, но статус не 'completed'
UPDATE survey_360_assignments sa
SET status = 'completed', updated_at = now()
WHERE sa.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM soft_skill_results ssr
    WHERE ssr.assignment_id = sa.id
      AND ssr.is_draft = false
  );
```

#### Блок 5

- **Строки**: 105–112
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновляем статусы задач, у которых assignment completed, но задача pending
UPDATE tasks t
SET status = 'completed', updated_at = now()
FROM survey_360_assignments sa
WHERE t.assignment_id = sa.id
  AND sa.status = 'completed'
  AND t.status != 'completed';
```

#### Блок 6

- **Строки**: 113–121
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. Убеждаемся, что у всех self-assignments есть diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.assignment_type = 'self'
  AND sa.diagnostic_stage_id IS NULL;
```

#### Блок 7

- **Строки**: 122–131
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Убеждаемся, что у всех manager-assignments есть diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp, users u
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = u.manager_id
  AND sa.assignment_type = 'manager'
  AND sa.diagnostic_stage_id IS NULL
  AND dsp.user_id = u.id;
```

#### Блок 8

- **Строки**: 132–139
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 6. Обновляем все назначения peer, у которых нет diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.assignment_type = 'peer'
  AND sa.diagnostic_stage_id IS NULL;
```

---

### `supabase/migrations/20251113143447_e4dd6f64-70f4-43ae-83bd-20946ac030cc.sql`

#### Блок 1

- **Строки**: 1–83
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ: ИСПРАВЛЕНИЕ СТАТУСОВ И ОПТИМИЗАЦИЯ
-- ============================================================================
-- Дата: 13.11.2025
-- Описание: Корректировка статусов незавершённых peer assignments и создание
--           недостающих задач для коллег

-- 1. Обновляем статусы peer assignments без результатов
-- Если коллега ещё не прошёл оценку, assignment должен оставаться в статусе 'approved'
-- но нужно убедиться, что для него есть задача

DO $$
DECLARE
  peer_assignment RECORD;
  peer_task_exists BOOLEAN;
  evaluated_user_name TEXT;
BEGIN
  -- Проходим по всем peer assignments без результатов
  FOR peer_assignment IN 
    SELECT 
      sa.id,
      sa.evaluated_user_id,
      sa.evaluating_user_id,
      sa.diagnostic_stage_id
    FROM survey_360_assignments sa
    WHERE sa.assignment_type = 'peer'
      AND sa.diagnostic_stage_id IS NOT NULL
      AND sa.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM hard_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
      AND NOT EXISTS (
        SELECT 1 FROM soft_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
  LOOP
    -- Проверяем, есть ли задача для этого assignment
    SELECT EXISTS (
      SELECT 1 FROM tasks 
      WHERE assignment_id = peer_assignment.id
    ) INTO peer_task_exists;
    
    -- Если задачи нет, создаём её
    IF NOT peer_task_exists THEN
      -- Получаем имя оцениваемого пользователя
      SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
      INTO evaluated_user_name
      FROM users
      WHERE id = peer_assignment.evaluated_user_id;
      
      -- Создаём задачу для коллеги
      INSERT INTO tasks (
        user_id,
        assignment_id,
        diagnostic_stage_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      )
      SELECT
        peer_assignment.evaluating_user_id,
        peer_assignment.id,
        peer_assignment.diagnostic_stage_id,
        'peer',
        'Оценка коллеги: ' || evaluated_user_name,
        'Необходимо пройти оценку 360 для коллеги ' || evaluated_user_name || '. Срок: ' || ds.deadline_date::text,
        'pending',
        ds.deadline_date,
        'survey_360_evaluation',
        'assessment'
      FROM diagnostic_stages ds
      WHERE ds.id = peer_assignment.diagnostic_stage_id;
      
      RAISE NOTICE 'Создана задача для peer assignment %', peer_assignment.id;
    END IF;
  END LOOP;
END $$;
```

---

### `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql`

#### Блок 1

- **Строки**: 55–70
- **Тип операции**: `DELETE`
- **Целевые таблицы**: role_permissions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- ЭТАП 2: Обновление и синхронизация таблицы permissions
-- =====================================================

-- Удаляем устаревшие разрешения (дубликаты с разными форматами)
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE name IN (
    'view_career_tracks', 'manage_career_tracks', 
    'view_meetings', 'manage_meetings',
    'view_surveys', 'manage_surveys',
    'view_tasks', 'manage_tasks',
    'view_all_users', 'manage_users', 'manage_system',
    'view_own_data', 'view_team_data'
  )
);
```

#### Блок 2

- **Строки**: 71–79
- **Тип операции**: `DELETE`
- **Целевые таблицы**: permissions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM permissions WHERE name IN (
  'view_career_tracks', 'manage_career_tracks', 
  'view_meetings', 'manage_meetings',
  'view_surveys', 'manage_surveys',
  'view_tasks', 'manage_tasks',
  'view_all_users', 'manage_users', 'manage_system',
  'view_own_data', 'view_team_data'
);
```

#### Блок 3

- **Строки**: 80–122
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем недостающие разрешения
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Пользователи
  ('users.manage_roles', 'users', 'manage_roles', 'Управление ролями пользователей'),
  
  -- Встречи
  ('meetings.delete', 'meetings', 'delete', 'Удаление встреч'),
  ('meetings.return', 'meetings', 'return', 'Возврат встреч на доработку'),
  
  -- Опросы
  ('surveys.delete', 'surveys', 'delete', 'Удаление опросов'),
  ('surveys.update', 'surveys', 'update', 'Редактирование опросов'),
  ('surveys.manage', 'surveys', 'manage', 'Управление всеми опросами'),
  
  -- Навыки
  ('skills.create', 'skills', 'create', 'Создание навыков'),
  ('skills.update', 'skills', 'update', 'Редактирование навыков'),
  ('skills.delete', 'skills', 'delete', 'Удаление навыков'),
  ('skills.view', 'skills', 'view', 'Просмотр навыков'),
  
  -- Качества
  ('qualities.create', 'qualities', 'create', 'Создание качеств'),
  ('qualities.update', 'qualities', 'update', 'Редактирование качеств'),
  ('qualities.delete', 'qualities', 'delete', 'Удаление качеств'),
  ('qualities.view', 'qualities', 'view', 'Просмотр качеств'),
  
  -- Должности
  ('positions.update', 'positions', 'update', 'Редактирование должностей'),
  ('positions.delete', 'positions', 'delete', 'Удаление должностей'),
  
  -- Отчёты
  ('reports.create', 'reports', 'create', 'Создание отчётов'),
  ('reports.update', 'reports', 'update', 'Редактирование отчётов'),
  ('reports.delete', 'reports', 'delete', 'Удаление отчётов'),
  
  -- Развитие
  ('development.delete', 'development', 'delete', 'Удаление планов развития'),
  
  -- Задачи
  ('tasks.view_all', 'tasks', 'view_all', 'Просмотр всех задач'),
  ('tasks.view_team', 'tasks', 'view_team', 'Просмотр задач команды')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 123–129
- **Тип операции**: `DELETE`
- **Целевые таблицы**: role_permissions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- ЭТАП 3: Обновление role_permissions для всех ролей
-- =====================================================

-- Очищаем все связи для пересоздания
DELETE FROM role_permissions;
```

#### Блок 5

- **Строки**: 130–133
- **Тип операции**: `INSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Роль: admin (автоматически получает все права через has_permission, но заполним для UI)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions;
```

#### Блок 6

- **Строки**: 134–161
- **Тип операции**: `INSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Роль: hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи
  'users.view', 'users.create', 'users.update',
  -- Диагностика
  'diagnostics.view', 'diagnostics.create', 'diagnostics.update', 'diagnostics.delete',
  'diagnostics.view_results', 'diagnostics.export_results', 'diagnostics.manage_participants',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update', 'development.delete',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.assign', 'surveys.results', 'surveys.manage',
  -- Карьера
  'career.update', 'career.create', 'career.delete',
  -- Отчёты
  'reports.view', 'reports.export',
  -- Подразделения
  'departments.view',
  -- Должности
  'positions.view'
);
```

#### Блок 7

- **Строки**: 162–184
- **Тип операции**: `INSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Роль: manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions WHERE name IN (
  -- Пользователи (только просмотр)
  'users.view',
  -- Диагностика
  'diagnostics.view', 'diagnostics.view_results',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update', 'meetings.approve',
  -- Развитие
  'development.view', 'development.create', 'development.update',
  -- Задачи
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.view_team',
  -- Команда
  'team.view', 'team.manage',
  -- Опросы
  'surveys.view', 'surveys.results',
  -- Карьера
  'career.update',
  -- Отчёты
  'reports.view'
);
```

#### Блок 8

- **Строки**: 185–201
- **Тип операции**: `INSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Роль: employee
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee'::app_role, id FROM permissions WHERE name IN (
  -- Диагностика
  'diagnostics.view',
  -- Встречи
  'meetings.view', 'meetings.create', 'meetings.update',
  -- Развитие
  'development.view',
  -- Задачи
  'tasks.view',
  -- Опросы
  'surveys.view',
  -- Карьера (просмотр)
  'career.update'
);
```

#### Блок 9

- **Строки**: 245–250
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, can, users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users with users.update can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'users.update'));
```

#### Блок 10

- **Строки**: 264–264
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
```

#### Блок 11

- **Строки**: 266–266
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
```

#### Блок 12

- **Строки**: 270–270
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "HR can update all profiles" ON user_profiles;
```

#### Блок 13

- **Строки**: 279–284
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, can, profiles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users with users.update can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'users.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'users.update'));
```

#### Блок 14

- **Строки**: 295–295
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: user
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
```

#### Блок 15

- **Строки**: 337–348
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, can, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users with tasks.update can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.update')
  )
  WITH CHECK (
    user_id = get_current_session_user()
    OR has_permission(get_current_session_user(), 'tasks.update')
  );
```

#### Блок 16

- **Строки**: 376–381
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, can, plans
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Users with development.update can update plans"
  ON development_plans FOR UPDATE
  TO authenticated
  USING (has_permission(get_current_session_user(), 'development.update'))
  WITH CHECK (has_permission(get_current_session_user(), 'development.update'));
```

---

### `supabase/migrations/20251113170450_2cd48a6d-06d0-470a-8591-1387103cbf70.sql`

#### Блок 1

- **Строки**: 1–20
- **Тип операции**: `INSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ: PERMISSION-BASED АРХИТЕКТУРА
-- ============================================================
-- Полное переписывание всех RLS политик на has_permission()
-- Удаление всех deprecated функций
-- Добавление недостающих permissions
-- ============================================================

-- 1. ДОБАВИТЬ НЕДОСТАЮЩИЕ PERMISSIONS
-- ============================================================

-- Проверка, существуют ли уже эти permissions
DO $$
BEGIN
  -- diagnostics.manage (используется в RLS, но отсутствует)
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'diagnostics.manage') THEN
    INSERT INTO permissions (name, resource, action, description)
    VALUES ('diagnostics.manage', 'diagnostics', 'manage', 'Полное управление диагностикой');
  END IF;
END $$;
```

#### Блок 2

- **Строки**: 154–154
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update hard_skill_results" ON hard_skill_results;
```

#### Блок 3

- **Строки**: 168–173
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "hard_skill_results_update" ON hard_skill_results
  FOR UPDATE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );
```

#### Блок 4

- **Строки**: 196–196
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Participants can update meeting decisions" ON meeting_decisions;
```

#### Блок 5

- **Строки**: 266–268
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: meetings
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- one_on_one_meetings
DROP POLICY IF EXISTS "Employees and managers can update meetings" ON one_on_one_meetings;
```

#### Блок 6

- **Строки**: 272–283
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "one_on_one_meetings_update" ON one_on_one_meetings
  FOR UPDATE USING (
    (employee_id = get_current_session_user() AND status IN ('draft', 'returned', 'submitted')) OR
    (manager_id = get_current_session_user() AND status IN ('submitted', 'approved', 'returned')) OR
    has_permission(get_current_session_user(), 'meetings.update')
  )
  WITH CHECK (
    (employee_id = get_current_session_user() AND status IN ('draft', 'returned', 'submitted')) OR
    (manager_id = get_current_session_user() AND status IN ('submitted', 'approved', 'returned')) OR
    has_permission(get_current_session_user(), 'meetings.update')
  );
```

#### Блок 7

- **Строки**: 348–348
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update soft_skill_results" ON soft_skill_results;
```

#### Блок 8

- **Строки**: 362–367
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "soft_skill_results_update" ON soft_skill_results
  FOR UPDATE USING (
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage')
  );
```

#### Блок 9

- **Строки**: 384–384
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update their 360 assignments" ON survey_360_assignments;
```

#### Блок 10

- **Строки**: 398–409
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "survey_360_assignments_update" ON survey_360_assignments
  FOR UPDATE USING (
    evaluated_user_id = get_current_session_user() OR 
    evaluating_user_id = get_current_session_user() OR 
    has_permission(get_current_session_user(), 'surveys.manage') OR
    (has_permission(get_current_session_user(), 'team.view') AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = get_current_session_user()
    ))
  );
```

---

### `supabase/migrations/20251113181617_7b0d920d-eed4-4b71-8244-d8f88e1248b1.sql`

#### Блок 1

- **Строки**: 22–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update: their own data or if they have permission
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE
  USING (
    id = get_current_user_id() OR
    has_permission('users.update_all') OR
    (has_permission('users.update_team') AND is_users_manager(id))
  )
  WITH CHECK (
    id = get_current_user_id() OR
    has_permission('users.update_all') OR
    (has_permission('users.update_team') AND is_users_manager(id))
  );
```

#### Блок 2

- **Строки**: 59–70
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own profile or if they have permission
CREATE POLICY "user_profiles_update_policy" ON public.user_profiles
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('users.update_all')
  );
```

#### Блок 3

- **Строки**: 95–108
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own tasks or if they have permission
CREATE POLICY "tasks_update_policy" ON public.tasks
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('tasks.update_all') OR
    (has_permission('tasks.update_team') AND is_users_manager(user_id))
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('tasks.update_all') OR
    (has_permission('tasks.update_team') AND is_users_manager(user_id))
  );
```

#### Блок 4

- **Строки**: 135–140
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, diagnostic
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Only users with permission can update diagnostic stages
CREATE POLICY "diagnostic_stages_update_policy" ON public.diagnostic_stages
  FOR UPDATE
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));
```

#### Блок 5

- **Строки**: 165–170
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, participants
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Only users with permission can update participants
CREATE POLICY "diagnostic_stage_participants_update_policy" ON public.diagnostic_stage_participants
  FOR UPDATE
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));
```

#### Блок 6

- **Строки**: 198–211
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own assignments or if they have permission
CREATE POLICY "survey_360_assignments_update_policy" ON public.survey_360_assignments
  FOR UPDATE
  USING (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.update_all') OR
    (has_permission('surveys.update_team') AND is_users_manager(evaluated_user_id))
  )
  WITH CHECK (
    evaluating_user_id = get_current_user_id() OR
    has_permission('surveys.update_all') OR
    (has_permission('surveys.update_team') AND is_users_manager(evaluated_user_id))
  );
```

#### Блок 7

- **Строки**: 236–247
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own evaluations or if they have permission
CREATE POLICY "hard_skill_results_update_policy" ON public.hard_skill_results
  FOR UPDATE
  USING (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  )
  WITH CHECK (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  );
```

#### Блок 8

- **Строки**: 272–283
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own evaluations or if they have permission
CREATE POLICY "soft_skill_results_update_policy" ON public.soft_skill_results
  FOR UPDATE
  USING (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  )
  WITH CHECK (
    (evaluating_user_id = get_current_user_id() AND is_draft = true) OR
    has_permission('surveys.update_all')
  );
```

#### Блок 9

- **Строки**: 307–312
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, meeting
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Only users with permission can update meeting stages
CREATE POLICY "meeting_stages_update_policy" ON public.meeting_stages
  FOR UPDATE
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));
```

#### Блок 10

- **Строки**: 337–342
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, participants
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Only users with permission can update participants
CREATE POLICY "meeting_stage_participants_update_policy" ON public.meeting_stage_participants
  FOR UPDATE
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));
```

#### Блок 11

- **Строки**: 368–383
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own meetings or if they have permission
CREATE POLICY "one_on_one_meetings_update_policy" ON public.one_on_one_meetings
  FOR UPDATE
  USING (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.update_all') OR
    (has_permission('meetings.update_team') AND is_users_manager(employee_id))
  )
  WITH CHECK (
    employee_id = get_current_user_id() OR
    manager_id = get_current_user_id() OR
    has_permission('meetings.update_all') OR
    (has_permission('meetings.update_team') AND is_users_manager(employee_id))
  );
```

#### Блок 12

- **Строки**: 410–421
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, decisions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update decisions they created or if they have permission
CREATE POLICY "meeting_decisions_update_policy" ON public.meeting_decisions
  FOR UPDATE
  USING (
    created_by = get_current_user_id() OR
    has_permission('meetings.update_all')
  )
  WITH CHECK (
    created_by = get_current_user_id() OR
    has_permission('meetings.update_all')
  );
```

#### Блок 13

- **Строки**: 449–462
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own development plans or if they have permission
CREATE POLICY "development_plans_update_policy" ON public.development_plans
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('development.update_all') OR
    (has_permission('development.update_team') AND is_users_manager(user_id))
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('development.update_all') OR
    (has_permission('development.update_team') AND is_users_manager(user_id))
  );
```

#### Блок 14

- **Строки**: 478–494
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Only system can insert sessions (for dev login)
CREATE POLICY "admin_sessions_insert_policy" ON public.admin_sessions
  FOR INSERT
  WITH CHECK (true); -- System needs to create sessions during dev login

-- Users can update their own sessions or if they have permission
CREATE POLICY "admin_sessions_update_policy" ON public.admin_sessions
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    has_permission('security.manage')
  );
```

---

### `supabase/migrations/20251113184003_b4988151-d84c-4aeb-a8ac-fd0d1aa1a08c.sql`

#### Блок 1

- **Строки**: 39–62
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: user_effective_permissions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. ФУНКЦИИ ОБНОВЛЕНИЯ КЭШ-ПРАВ
-- ========================================

CREATE OR REPLACE FUNCTION refresh_user_effective_permissions(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_effective_permissions WHERE user_id = target_user_id;
  
  INSERT INTO user_effective_permissions (user_id, permission_name)
  SELECT DISTINCT
    target_user_id,
    p.name
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role = ur.role
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = target_user_id
  ON CONFLICT (user_id, permission_name) DO NOTHING;
END;
$$;
```

#### Блок 2

- **Строки**: 163–175
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permission_groups
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO permission_groups (name, label, description, icon, display_order) VALUES
  ('users', 'Пользователи', 'Управление пользователями и профилями', '👤', 1),
  ('diagnostics', 'Диагностика', 'Управление диагностическими этапами и результатами', '📊', 2),
  ('surveys', 'Опросы', 'Управление опросами навыков и 360', '📝', 3),
  ('meetings', 'Встречи 1:1', 'Управление встречами один на один', '🤝', 4),
  ('development', 'Развитие', 'Управление планами развития и задачами', '🎯', 5),
  ('tasks', 'Задачи', 'Управление задачами', '✅', 6),
  ('team', 'Команда', 'Просмотр и управление командой', '👥', 7),
  ('analytics', 'Аналитика', 'Доступ к аналитике и отчётам', '📈', 8),
  ('security', 'Безопасность', 'Управление безопасностью и правами доступа', '🔒', 9),
  ('profile', 'Профиль', 'Управление профилями', '👨‍💼', 10)
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 176–192
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permission_group_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO permission_group_permissions (group_id, permission_id)
SELECT pg.id, p.id
FROM permissions p
CROSS JOIN permission_groups pg
WHERE 
  (pg.name = 'users' AND p.resource = 'users') OR
  (pg.name = 'diagnostics' AND p.resource = 'diagnostics') OR
  (pg.name = 'surveys' AND p.resource = 'surveys') OR
  (pg.name = 'meetings' AND p.resource = 'meetings') OR
  (pg.name = 'development' AND p.resource = 'development') OR
  (pg.name = 'tasks' AND p.resource = 'tasks') OR
  (pg.name = 'team' AND p.resource = 'team') OR
  (pg.name = 'analytics' AND p.resource = 'analytics') OR
  (pg.name = 'security' AND p.resource = 'security') OR
  (pg.name = 'profile' AND p.resource = 'profile')
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20251113192335_5c6d0249-856f-4d18-b497-50c82164885d.sql`

#### Блок 1

- **Строки**: 1–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- МОДЕРНИЗАЦИЯ СИСТЕМЫ БЕЗОПАСНОСТИ
-- Приведение всех RLS-политик к единому стандарту
-- ============================================

-- ============================================
-- ЧАСТЬ 1: Добавление permissions для справочников
-- ============================================

-- Permissions для управления навыками (skills)
INSERT INTO permissions (name, resource, action, description) VALUES
('skills.create', 'skills', 'create', 'Создание навыков'),
('skills.update', 'skills', 'update', 'Редактирование навыков'),
('skills.delete', 'skills', 'delete', 'Удаление навыков'),
('skills.view', 'skills', 'view', 'Просмотр навыков')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 18–25
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для категорий навыков
INSERT INTO permissions (name, resource, action, description) VALUES
('categories.create', 'categories', 'create', 'Создание категорий навыков'),
('categories.update', 'categories', 'update', 'Редактирование категорий'),
('categories.delete', 'categories', 'delete', 'Удаление категорий'),
('categories.view', 'categories', 'view', 'Просмотр категорий')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 26–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для сертификаций
INSERT INTO permissions (name, resource, action, description) VALUES
('certifications.create', 'certifications', 'create', 'Создание сертификаций'),
('certifications.update', 'certifications', 'update', 'Редактирование сертификаций'),
('certifications.delete', 'certifications', 'delete', 'Удаление сертификаций'),
('certifications.view', 'certifications', 'view', 'Просмотр сертификаций')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 34–41
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для уровней компетенций
INSERT INTO permissions (name, resource, action, description) VALUES
('competency_levels.create', 'competency_levels', 'create', 'Создание уровней компетенций'),
('competency_levels.update', 'competency_levels', 'update', 'Редактирование уровней'),
('competency_levels.delete', 'competency_levels', 'delete', 'Удаление уровней'),
('competency_levels.view', 'competency_levels', 'view', 'Просмотр уровней')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 5

- **Строки**: 42–49
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для производителей
INSERT INTO permissions (name, resource, action, description) VALUES
('manufacturers.create', 'manufacturers', 'create', 'Создание производителей'),
('manufacturers.update', 'manufacturers', 'update', 'Редактирование производителей'),
('manufacturers.delete', 'manufacturers', 'delete', 'Удаление производителей'),
('manufacturers.view', 'manufacturers', 'view', 'Просмотр производителей')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 6

- **Строки**: 50–57
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для торговых точек
INSERT INTO permissions (name, resource, action, description) VALUES
('trade_points.create', 'trade_points', 'create', 'Создание торговых точек'),
('trade_points.update', 'trade_points', 'update', 'Редактирование торговых точек'),
('trade_points.delete', 'trade_points', 'delete', 'Удаление торговых точек'),
('trade_points.view', 'trade_points', 'view', 'Просмотр торговых точек')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 7

- **Строки**: 58–65
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для типов треков
INSERT INTO permissions (name, resource, action, description) VALUES
('track_types.create', 'track_types', 'create', 'Создание типов треков'),
('track_types.update', 'track_types', 'update', 'Редактирование типов'),
('track_types.delete', 'track_types', 'delete', 'Удаление типов'),
('track_types.view', 'track_types', 'view', 'Просмотр типов')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 8

- **Строки**: 66–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для задач развития
INSERT INTO permissions (name, resource, action, description) VALUES
('development_tasks.create', 'development_tasks', 'create', 'Создание задач развития'),
('development_tasks.update', 'development_tasks', 'update', 'Редактирование задач'),
('development_tasks.delete', 'development_tasks', 'delete', 'Удаление задач'),
('development_tasks.view', 'development_tasks', 'view', 'Просмотр задач')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 9

- **Строки**: 74–81
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для вопросов опросов
INSERT INTO permissions (name, resource, action, description) VALUES
('survey_questions.create', 'survey_questions', 'create', 'Создание вопросов опросов'),
('survey_questions.update', 'survey_questions', 'update', 'Редактирование вопросов'),
('survey_questions.delete', 'survey_questions', 'delete', 'Удаление вопросов'),
('survey_questions.view', 'survey_questions', 'view', 'Просмотр вопросов')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 10

- **Строки**: 82–88
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Permissions для результатов оценки
INSERT INTO permissions (name, resource, action, description) VALUES
('assessment_results.view_all', 'assessment_results', 'view_all', 'Просмотр всех результатов оценки'),
('assessment_results.view_team', 'assessment_results', 'view_team', 'Просмотр результатов команды'),
('assessment_results.export', 'assessment_results', 'export', 'Экспорт результатов оценки')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 11

- **Строки**: 89–102
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- ЧАСТЬ 2: Назначение permissions для ролей
-- ============================================

-- Admin получает все permissions для справочников
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE resource IN (
  'skills', 'categories', 'certifications', 'competency_levels',
  'manufacturers', 'trade_points', 'track_types', 'development_tasks',
  'survey_questions', 'assessment_results'
)
ON CONFLICT DO NOTHING;
```

#### Блок 12

- **Строки**: 103–117
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- HR BP получает права на просмотр и управление справочниками
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', id FROM permissions 
WHERE name IN (
  'skills.view', 'skills.create', 'skills.update',
  'categories.view', 'categories.create', 'categories.update',
  'certifications.view', 'certifications.create', 'certifications.update',
  'competency_levels.view', 'competency_levels.create', 'competency_levels.update',
  'development_tasks.view', 'development_tasks.create', 'development_tasks.update',
  'survey_questions.view', 'survey_questions.create', 'survey_questions.update',
  'assessment_results.view_all', 'assessment_results.export',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 13

- **Строки**: 118–128
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Manager получает права на просмотр справочников и результатов команды
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'survey_questions.view', 'assessment_results.view_team',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 14

- **Строки**: 129–138
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Employee получает базовые права на просмотр
INSERT INTO role_permissions (role, permission_id)
SELECT 'employee', id FROM permissions 
WHERE name IN (
  'skills.view', 'categories.view', 'certifications.view',
  'competency_levels.view', 'development_tasks.view',
  'trade_points.view', 'manufacturers.view', 'track_types.view'
)
ON CONFLICT DO NOTHING;
```

#### Блок 15

- **Строки**: 153–156
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "skills_update_policy" ON skills
  FOR UPDATE USING (has_permission('skills.update'))
  WITH CHECK (has_permission('skills.update'));
```

#### Блок 16

- **Строки**: 169–172
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "category_skills_update_policy" ON category_skills
  FOR UPDATE USING (has_permission('categories.update'))
  WITH CHECK (has_permission('categories.update'));
```

#### Блок 17

- **Строки**: 185–188
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "qualities_update_policy" ON qualities
  FOR UPDATE USING (has_permission('qualities.update'))
  WITH CHECK (has_permission('qualities.update'));
```

#### Блок 18

- **Строки**: 201–204
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "certifications_update_policy" ON certifications
  FOR UPDATE USING (has_permission('certifications.update'))
  WITH CHECK (has_permission('certifications.update'));
```

#### Блок 19

- **Строки**: 218–221
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "competency_levels_update_policy" ON competency_levels
  FOR UPDATE USING (has_permission('competency_levels.update'))
  WITH CHECK (has_permission('competency_levels.update'));
```

#### Блок 20

- **Строки**: 234–237
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "departments_update_policy" ON departments
  FOR UPDATE USING (has_permission('departments.update'))
  WITH CHECK (has_permission('departments.update'));
```

#### Блок 21

- **Строки**: 250–253
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "manufacturers_update_policy" ON manufacturers
  FOR UPDATE USING (has_permission('manufacturers.update'))
  WITH CHECK (has_permission('manufacturers.update'));
```

#### Блок 22

- **Строки**: 266–269
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "position_categories_update_policy" ON position_categories
  FOR UPDATE USING (has_permission('positions.update'))
  WITH CHECK (has_permission('positions.update'));
```

#### Блок 23

- **Строки**: 282–285
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (has_permission('positions.update'))
  WITH CHECK (has_permission('positions.update'));
```

#### Блок 24

- **Строки**: 298–301
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "grades_update_policy" ON grades
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));
```

#### Блок 25

- **Строки**: 314–317
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "grade_skills_update_policy" ON grade_skills
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));
```

#### Блок 26

- **Строки**: 330–333
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "grade_qualities_update_policy" ON grade_qualities
  FOR UPDATE USING (has_permission('grades.update'))
  WITH CHECK (has_permission('grades.update'));
```

#### Блок 27

- **Строки**: 346–349
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "career_tracks_update_policy" ON career_tracks
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));
```

#### Блок 28

- **Строки**: 362–365
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "career_track_steps_update_policy" ON career_track_steps
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));
```

#### Блок 29

- **Строки**: 378–381
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "trade_points_update_policy" ON trade_points
  FOR UPDATE USING (has_permission('trade_points.update'))
  WITH CHECK (has_permission('trade_points.update'));
```

#### Блок 30

- **Строки**: 395–398
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "track_types_update_policy" ON track_types
  FOR UPDATE USING (has_permission('track_types.update'))
  WITH CHECK (has_permission('track_types.update'));
```

#### Блок 31

- **Строки**: 412–415
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "development_tasks_update_policy" ON development_tasks
  FOR UPDATE USING (has_permission('development_tasks.update'))
  WITH CHECK (has_permission('development_tasks.update'));
```

#### Блок 32

- **Строки**: 428–431
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "hard_skill_questions_update_policy" ON hard_skill_questions
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));
```

#### Блок 33

- **Строки**: 444–447
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "hard_skill_answer_options_update_policy" ON hard_skill_answer_options
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));
```

#### Блок 34

- **Строки**: 460–463
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "soft_skill_questions_update_policy" ON soft_skill_questions
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));
```

#### Блок 35

- **Строки**: 476–479
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "soft_skill_answer_options_update_policy" ON soft_skill_answer_options
  FOR UPDATE USING (has_permission('survey_questions.update'))
  WITH CHECK (has_permission('survey_questions.update'));
```

#### Блок 36

- **Строки**: 490–490
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: assessment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "System can update assessment results" ON user_assessment_results;
```

#### Блок 37

- **Строки**: 498–504
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_assessment_results_insert_policy" ON user_assessment_results
  FOR INSERT WITH CHECK (true); -- Система создаёт через триггеры

CREATE POLICY "user_assessment_results_update_policy" ON user_assessment_results
  FOR UPDATE USING (true) -- Система обновляет через триггеры
  WITH CHECK (true);
```

#### Блок 38

- **Строки**: 524–533
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_skills_update_policy" ON user_skills
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );
```

#### Блок 39

- **Строки**: 545–545
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Users can update qualities" ON user_qualities;
```

#### Блок 40

- **Строки**: 559–568
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_qualities_update_policy" ON user_qualities
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('users.update_all')
  );
```

#### Блок 41

- **Строки**: 590–593
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_roles_update_policy" ON user_roles
  FOR UPDATE USING (has_permission('users.manage_roles'))
  WITH CHECK (has_permission('users.manage_roles'));
```

#### Блок 42

- **Строки**: 615–624
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_career_progress_update_policy" ON user_career_progress
  FOR UPDATE USING (
    user_id = get_current_user_id()
    OR has_permission('career.update')
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR has_permission('career.update')
  );
```

#### Блок 43

- **Строки**: 642–645
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_career_ratings_update_policy" ON user_career_ratings
  FOR UPDATE USING (has_permission('career.update'))
  WITH CHECK (has_permission('career.update'));
```

#### Блок 44

- **Строки**: 663–666
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_kpi_results_update_policy" ON user_kpi_results
  FOR UPDATE USING (has_permission('analytics.manage'))
  WITH CHECK (has_permission('analytics.manage'));
```

#### Блок 45

- **Строки**: 684–687
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_trade_points_update_policy" ON user_trade_points
  FOR UPDATE USING (has_permission('users.update_all'))
  WITH CHECK (has_permission('users.update_all'));
```

---

### `supabase/migrations/20251113194652_fe08abd3-a730-4010-a50a-337597e60f86.sql`

#### Блок 1

- **Строки**: 33–39
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: Only users with diagnostics.manage permission
CREATE POLICY "diagnostic_stage_participants_update_policy" 
ON public.diagnostic_stage_participants
FOR UPDATE
USING (has_permission('diagnostics.manage'))
WITH CHECK (has_permission('diagnostics.manage'));
```

#### Блок 2

- **Строки**: 75–81
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: Only users with meetings.manage permission
CREATE POLICY "meeting_stage_participants_update_policy" 
ON public.meeting_stage_participants
FOR UPDATE
USING (has_permission('meetings.manage'))
WITH CHECK (has_permission('meetings.manage'));
```

---

### `supabase/migrations/20251113200617_220bf8f4-0b5d-4bb6-867b-435d475cae97.sql`

#### Блок 1

- **Строки**: 1–88
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- FINAL CLEANUP: Remove all old role-based functions
-- Replace with permission-based equivalents
-- =====================================================
-- Date: 2025-11-13
-- Issue: Found 2 functions still using deprecated is_current_user_admin()
-- Solution: Replace with has_permission('security.manage')
-- =====================================================

-- =====================================================
-- STEP 1: UPDATE admin_cleanup_all_data()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. soft_skill_results (survey_360_results)
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 9. hard_skill_results (skill_survey_results)
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  RETURN result;
END;
$$;
```

#### Блок 2

- **Строки**: 92–123
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: admin_delete_all_from_table, public
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- STEP 2: UPDATE admin_delete_all_from_table()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
  sql_query text;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Формируем SQL запрос с полным путем к таблице
  sql_query := format('DELETE FROM public.%I', table_name);
  
  -- Выполняем удаление
  EXECUTE sql_query;
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;
```

---

### `supabase/migrations/20251113200810_188f341b-54f9-42f0-a689-1fe5eef3b22c.sql`

#### Блок 1

- **Строки**: 1–88
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- FINAL CLEANUP: Remove all old role-based functions
-- Replace with permission-based equivalents
-- =====================================================
-- Date: 2025-11-13
-- Issue: Found 2 functions still using deprecated is_current_user_admin()
-- Solution: Replace with has_permission('security.manage')
-- =====================================================

-- =====================================================
-- STEP 1: UPDATE admin_cleanup_all_data()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. soft_skill_results (survey_360_results)
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 9. hard_skill_results (skill_survey_results)
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  RETURN result;
END;
$$;
```

#### Блок 2

- **Строки**: 92–123
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: admin_delete_all_from_table, public
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- STEP 2: UPDATE admin_delete_all_from_table()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
  sql_query text;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Формируем SQL запрос с полным путем к таблице
  sql_query := format('DELETE FROM public.%I', table_name);
  
  -- Выполняем удаление
  EXECUTE sql_query;
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;
```

---

### `supabase/migrations/20251113215807_10f50ac4-e6e9-45cb-8762-4c36c236254c.sql`

#### Блок 1

- **Строки**: 52–80
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Create trigger function to auto-create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 88–90
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 7. Update RLS policies for users table
DROP POLICY IF EXISTS users_select_policy ON users;
```

#### Блок 3

- **Строки**: 108–118
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY users_update_auth_policy ON users
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR has_permission('users.manage')
  )
  WITH CHECK (
    id = auth.uid()
    OR has_permission('users.manage')
  );
```

#### Блок 4

- **Строки**: 125–127
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 8. Update RLS for user_profiles
DROP POLICY IF EXISTS user_profiles_select_temp_policy ON user_profiles;
```

#### Блок 5

- **Строки**: 137–141
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY user_profiles_update_auth_policy ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('users.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('users.manage'));
```

#### Блок 6

- **Строки**: 148–150
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 9. Update RLS for tasks
DROP POLICY IF EXISTS tasks_select_temp_policy ON tasks;
```

#### Блок 7

- **Строки**: 160–164
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY tasks_update_auth_policy ON tasks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('tasks.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('tasks.manage'));
```

#### Блок 8

- **Строки**: 171–173
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 10. Update RLS for survey_360_assignments
DROP POLICY IF EXISTS survey_360_assignments_select_temp_policy ON survey_360_assignments;
```

#### Блок 9

- **Строки**: 193–205
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY survey_360_assignments_update_auth_policy ON survey_360_assignments
  FOR UPDATE
  TO authenticated
  USING (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  )
  WITH CHECK (
    evaluated_user_id = auth.uid()
    OR evaluating_user_id = auth.uid()
    OR has_permission('diagnostics.manage')
  );
```

#### Блок 10

- **Строки**: 206–208
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 11. Update RLS for hard_skill_results
DROP POLICY IF EXISTS hard_skill_results_select_temp_policy ON hard_skill_results;
```

#### Блок 11

- **Строки**: 225–229
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY hard_skill_results_update_auth_policy ON hard_skill_results
  FOR UPDATE
  TO authenticated
  USING (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'))
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));
```

#### Блок 12

- **Строки**: 230–232
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 12. Update RLS for soft_skill_results
DROP POLICY IF EXISTS soft_skill_results_select_temp_policy ON soft_skill_results;
```

#### Блок 13

- **Строки**: 249–253
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY soft_skill_results_update_auth_policy ON soft_skill_results
  FOR UPDATE
  TO authenticated
  USING (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'))
  WITH CHECK (evaluating_user_id = auth.uid() OR has_permission('diagnostics.manage'));
```

#### Блок 14

- **Строки**: 254–256
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 13. Update RLS for diagnostic_stages
DROP POLICY IF EXISTS diagnostic_stages_select_temp_policy ON diagnostic_stages;
```

#### Блок 15

- **Строки**: 272–276
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY diagnostic_stages_update_auth_policy ON diagnostic_stages
  FOR UPDATE
  TO authenticated
  USING (has_permission('diagnostics.manage'))
  WITH CHECK (has_permission('diagnostics.manage'));
```

#### Блок 16

- **Строки**: 277–279
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 14. Update RLS for diagnostic_stage_participants
DROP POLICY IF EXISTS diagnostic_stage_participants_select_temp_policy ON diagnostic_stage_participants;
```

#### Блок 17

- **Строки**: 299–301
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 15. Update RLS for meeting_stages
DROP POLICY IF EXISTS meeting_stages_select_temp_policy ON meeting_stages;
```

#### Блок 18

- **Строки**: 317–321
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY meeting_stages_update_auth_policy ON meeting_stages
  FOR UPDATE
  TO authenticated
  USING (has_permission('meetings.manage'))
  WITH CHECK (has_permission('meetings.manage'));
```

#### Блок 19

- **Строки**: 322–324
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 16. Update RLS for meeting_stage_participants
DROP POLICY IF EXISTS meeting_stage_participants_select_temp_policy ON meeting_stage_participants;
```

#### Блок 20

- **Строки**: 338–340
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 17. Update RLS for one_on_one_meetings
DROP POLICY IF EXISTS one_on_one_meetings_select_temp_policy ON one_on_one_meetings;
```

#### Блок 21

- **Строки**: 361–373
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY one_on_one_meetings_update_auth_policy ON one_on_one_meetings
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  );
```

#### Блок 22

- **Строки**: 374–376
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 18. Update RLS for development_plans
DROP POLICY IF EXISTS development_plans_select_temp_policy ON development_plans;
```

#### Блок 23

- **Строки**: 392–396
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY development_plans_update_auth_policy ON development_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('development.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('development.manage'));
```

#### Блок 24

- **Строки**: 397–399
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 19. Update RLS for user_career_progress
DROP POLICY IF EXISTS user_career_progress_select_temp_policy ON user_career_progress;
```

#### Блок 25

- **Строки**: 415–419
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY user_career_progress_update_auth_policy ON user_career_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('career.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('career.manage'));
```

#### Блок 26

- **Строки**: 420–422
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 20. Update RLS for user_career_ratings
DROP POLICY IF EXISTS user_career_ratings_select_temp_policy ON user_career_ratings;
```

#### Блок 27

- **Строки**: 436–438
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 21. Update RLS for meeting_decisions
DROP POLICY IF EXISTS meeting_decisions_select_temp_policy ON meeting_decisions;
```

#### Блок 28

- **Строки**: 459–463
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY meeting_decisions_update_auth_policy ON meeting_decisions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR has_permission('meetings.manage'))
  WITH CHECK (created_by = auth.uid() OR has_permission('meetings.manage'));
```

#### Блок 29

- **Строки**: 464–466
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 22. Update RLS for user_kpi_results
DROP POLICY IF EXISTS user_kpi_results_select_temp_policy ON user_kpi_results;
```

#### Блок 30

- **Строки**: 482–486
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY user_kpi_results_update_auth_policy ON user_kpi_results
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_permission('kpi.manage'))
  WITH CHECK (user_id = auth.uid() OR has_permission('kpi.manage'));
```

---

### `supabase/migrations/20251113220420_31cf6158-2aa3-4b0b-adb0-150bb8960288.sql`

#### Блок 1

- **Строки**: 1–33
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix trigger to bypass RLS when creating user record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert bypasses RLS because function is SECURITY DEFINER
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the auth user creation
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 34–36
- **Тип операции**: `INSERT`
- **Целевые таблицы**: users
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Add policy to allow service role to insert into users
DROP POLICY IF EXISTS users_insert_service_role_policy ON users;
```

---

### `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql`

#### Блок 1

- **Строки**: 1–32
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: accordingly, user_roles, users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | yes |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | email |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | user | unknown | yes |

```sql
-- Check if user exists and create/update accordingly
DO $$
DECLARE
  admin_user_id UUID := 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = admin_user_id) INTO user_exists;

  IF NOT user_exists THEN
    -- Create user record
    INSERT INTO users (id, email, first_name, last_name, employee_number, status, created_at, updated_at)
    VALUES (
      admin_user_id,
      'alena.draganova@gmail.com',
      'Алена',
      'Драганова',
      'ADMIN_' || substring(admin_user_id::text, 1, 8),
      true,
      NOW(),
      NOW()
    );
  END IF;

  -- Assign admin role (idempotent)
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Refresh effective permissions
  PERFORM refresh_user_effective_permissions(admin_user_id);
END $$;
```

---

### `supabase/migrations/20251114101941_67f58cf0-e279-4d20-954c-d9ff7d276144.sql`

#### Блок 1

- **Строки**: 93–103
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "users_update_policy"
ON public.users
FOR UPDATE
USING (
  -- Пользователь обновляет свою запись
  auth.uid() = id
  OR
  -- Или имеет право управления пользователями
  has_permission('users.manage')
);
```

#### Блок 2

- **Строки**: 157–170
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "tasks_update_auth_policy"
ON public.tasks
FOR UPDATE
USING (
  -- Обновляет свою задачу
  user_id = auth.uid()
  OR
  -- Или руководитель владельца задачи
  is_users_manager(user_id)
  OR
  -- Или имеет право управления задачами
  has_permission('tasks.manage')
);
```

#### Блок 3

- **Строки**: 206–214
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "development_plans_update_auth_policy"
ON public.development_plans
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  has_permission('development.manage')
);
```

#### Блок 4

- **Строки**: 239–243
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "diagnostic_stages_update_auth_policy"
ON public.diagnostic_stages
FOR UPDATE
USING (has_permission('diagnostics.manage'));
```

#### Блок 5

- **Строки**: 268–272
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "diagnostic_stage_participants_update_auth_policy"
ON public.diagnostic_stage_participants
FOR UPDATE
USING (has_permission('diagnostics.manage'));
```

#### Блок 6

- **Строки**: 304–308
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "meeting_stages_update_auth_policy"
ON public.meeting_stages
FOR UPDATE
USING (has_permission('meetings.manage'));
```

#### Блок 7

- **Строки**: 357–367
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "one_on_one_meetings_update_auth_policy"
ON public.one_on_one_meetings
FOR UPDATE
USING (
  employee_id = auth.uid()
  OR
  manager_id = auth.uid()
  OR
  has_permission('meetings.manage')
);
```

#### Блок 8

- **Строки**: 396–404
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "meeting_decisions_update_auth_policy"
ON public.meeting_decisions
FOR UPDATE
USING (
  is_meeting_participant(meeting_id, auth.uid())
  OR
  has_permission('meetings.manage')
);
```

#### Блок 9

- **Строки**: 424–432
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "survey_360_assignments_update_auth_policy"
ON public.survey_360_assignments
FOR UPDATE
USING (
  evaluated_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);
```

#### Блок 10

- **Строки**: 459–467
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "hard_skill_results_update_auth_policy"
ON public.hard_skill_results
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);
```

#### Блок 11

- **Строки**: 494–502
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "soft_skill_results_update_auth_policy"
ON public.soft_skill_results
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR
  has_permission('diagnostics.manage')
);
```

---

### `supabase/migrations/20251114103629_a72a00a6-e9eb-4c66-8c55-74a086ee75d9.sql`

#### Блок 1

- **Строки**: 71–84
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: себя или с правами users.manage
CREATE POLICY "users_update_policy"
ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR has_permission('users.manage')
)
WITH CHECK (
  id = auth.uid()
  OR has_permission('users.manage')
);
```

#### Блок 2

- **Строки**: 118–127
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "tasks_update_auth_policy"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR is_users_manager(auth.uid(), user_id)
  OR has_permission('tasks.manage')
);
```

---

### `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: audit_log
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | unknown | unknown | no |

```sql
-- ====================================================================
-- ОЧИСТКА ДАННЫХ: УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ КРОМЕ АДМИНА (С ЛОГАМИ)
-- ====================================================================

-- 1. Удаляем логи аудита для всех пользователей кроме админа
DELETE FROM audit_log 
WHERE admin_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572'
   OR target_user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 2

- **Строки**: 9–12
- **Тип операции**: `DELETE`
- **Целевые таблицы**: admin_activity_logs
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | unknown | unknown | no |

```sql
-- 2. Удаляем логи активности админа
DELETE FROM admin_activity_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 3

- **Строки**: 13–16
- **Тип операции**: `DELETE`
- **Целевые таблицы**: access_denied_logs
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | unknown | unknown | no |

```sql
-- 3. Удаляем логи отказов в доступе
DELETE FROM access_denied_logs 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 4

- **Строки**: 17–20
- **Тип операции**: `DELETE`
- **Целевые таблицы**: diagnostic_stage_participants
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | unknown | unknown | no |

```sql
-- 4. Очищаем диагностические этапы и этапы встреч
DELETE FROM diagnostic_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 5

- **Строки**: 21–23
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_stage_participants
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | unknown | unknown | no |

```sql
DELETE FROM meeting_stage_participants 
WHERE user_id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

#### Блок 6

- **Строки**: 24–30
- **Тип операции**: `DELETE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Удаляем этапы без участников
DELETE FROM diagnostic_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM diagnostic_stage_participants
);
```

#### Блок 7

- **Строки**: 31–36
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_stages
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DELETE FROM meeting_stages 
WHERE id NOT IN (
  SELECT DISTINCT stage_id 
  FROM meeting_stage_participants
);
```

#### Блок 8

- **Строки**: 37–40
- **Тип операции**: `DELETE`
- **Целевые таблицы**: users
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `e033ec4d-0155-44c9-8aaf-b4a79adbc572` | user | unknown | yes |

```sql
-- 6. Удаляем всех пользователей кроме админа
DELETE FROM users 
WHERE id != 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
```

---

### `supabase/migrations/20251114113704_ecddf320-4fc4-47e3-8157-da2c2aebf7c8.sql`

#### Блок 1

- **Строки**: 61–66
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: только с правом users.manage
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE
  USING (can_manage_users(auth.uid()))
  WITH CHECK (can_manage_users(auth.uid()));
```

---

### `supabase/migrations/20251114115919_b8aa746a-e7eb-4a38-a333-aa90c73edded.sql`

#### Блок 1

- **Строки**: 75–81
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: Только пользователи с разрешением users.manage
CREATE POLICY "users_update_auth_policy"
ON public.users
FOR UPDATE
TO authenticated
USING (can_manage_users(auth.uid()));
```

---

### `supabase/migrations/20251114134632_169827a9-7fd6-4a7e-9a8d-814d30c23063.sql`

#### Блок 1

- **Строки**: 1–8
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем разрешение security.manage с указанием resource и action
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.manage', 'security', 'manage', 'Управление безопасностью и пользователями')
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description;
```

#### Блок 2

- **Строки**: 9–17
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Связываем разрешение с ролью admin через role_permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 
  'admin'::app_role,
  p.id
FROM permissions p
WHERE p.name = 'security.manage'
ON CONFLICT (role, permission_id) DO NOTHING;
```

---

### `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql`

#### Блок 1

- **Строки**: 1–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ====================================================================
-- Миграция: Исправление системы прав для роли manager
-- Цель: Ограничить доступ manager к админ-панели и всем пользователям
-- ====================================================================

-- 1. Создание нового разрешения для доступа к админ-панели
INSERT INTO permissions (name, resource, action, description)
VALUES ('security.view_admin_panel', 'security', 'view_admin_panel', 'Доступ к административной панели')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 10–14
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Создание разрешения для просмотра всех пользователей (отличается от users.view)
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_all', 'users', 'view_all', 'Просмотр всех пользователей системы')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 15–19
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Создание разрешения для просмотра пользователей департамента (для HR BP)
INSERT INTO permissions (name, resource, action, description)
VALUES ('users.view_department', 'users', 'view_department', 'Просмотр пользователей своего департамента')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 20–26
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. Назначение разрешения security.view_admin_panel ТОЛЬКО admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'security.view_admin_panel'
ON CONFLICT DO NOTHING;
```

#### Блок 5

- **Строки**: 27–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Назначение разрешения users.view_all ТОЛЬКО admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_all'
ON CONFLICT DO NOTHING;
```

#### Блок 6

- **Строки**: 34–40
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 6. Назначение разрешения users.view_department для hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id
FROM permissions p
WHERE p.name = 'users.view_department'
ON CONFLICT DO NOTHING;
```

#### Блок 7

- **Строки**: 41–45
- **Тип операции**: `DELETE`
- **Целевые таблицы**: role_permissions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 7. Удаление разрешения users.view у manager и hr_bp (оставляем только у admin)
DELETE FROM role_permissions
WHERE role IN ('manager', 'hr_bp')
  AND permission_id IN (SELECT id FROM permissions WHERE name = 'users.view');
```

---

### `supabase/migrations/20251114174703_d4e1708a-b996-4953-b0d7-dcbfe1558f66.sql`

#### Блок 1

- **Строки**: 15–26
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, position_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update position_categories"
ON public.position_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 2

- **Строки**: 52–63
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, positions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update positions"
ON public.positions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 3

- **Строки**: 89–100
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 4

- **Строки**: 126–137
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, grades
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update grades"
ON public.grades
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 5

- **Строки**: 163–174
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update skills"
ON public.skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 6

- **Строки**: 200–211
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update qualities"
ON public.qualities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 7

- **Строки**: 237–248
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, category_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update category_skills"
ON public.category_skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 8

- **Строки**: 274–285
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, certifications
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update certifications"
ON public.certifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 9

- **Строки**: 311–322
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, competency_levels
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update competency_levels"
ON public.competency_levels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 10

- **Строки**: 348–359
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, track_types
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update track_types"
ON public.track_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 11

- **Строки**: 385–396
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, career_tracks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update career_tracks"
ON public.career_tracks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 12

- **Строки**: 422–433
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, career_track_steps
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update career_track_steps"
ON public.career_track_steps
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 13

- **Строки**: 459–470
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, grade_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update grade_skills"
ON public.grade_skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 14

- **Строки**: 496–507
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, grade_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update grade_qualities"
ON public.grade_qualities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 15

- **Строки**: 533–544
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, development_tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update development_tasks"
ON public.development_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 16

- **Строки**: 570–581
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, hard_skill_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update hard_skill_answer_options"
ON public.hard_skill_answer_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 17

- **Строки**: 607–618
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, hard_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update hard_skill_questions"
ON public.hard_skill_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 18

- **Строки**: 644–655
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, soft_skill_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update soft_skill_answer_options"
ON public.soft_skill_answer_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 19

- **Строки**: 681–692
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, soft_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update soft_skill_questions"
ON public.soft_skill_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 20

- **Строки**: 718–729
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, trade_points
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update trade_points"
ON public.trade_points
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 21

- **Строки**: 755–766
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, manufacturers
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update manufacturers"
ON public.manufacturers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

---

### `supabase/migrations/20251114175121_a86159be-ff01-4c0e-8dc4-c0b09392e81b.sql`

#### Блок 1

- **Строки**: 1–22
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, users, от, таблицы
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем RLS политики для UPDATE таблицы users
-- Политики позволяют admin и hr_bp обновлять данные пользователей

-- Политика для UPDATE от админов и HR BP
CREATE POLICY "Admins and HR BP can update users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 2

- **Строки**: 23–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, their, своих
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Политика для UPDATE своих данных сотрудниками
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
```

---

### `supabase/migrations/20251114175842_4c907627-8446-4794-8785-c59096034f0c.sql`

#### Блок 1

- **Строки**: 34–52
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, companies
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 2

- **Строки**: 65–70
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Добавляем триггер для автоматического обновления updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 3

- **Строки**: 71–75
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: companies
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Вставляем запись "Ракета"
INSERT INTO public.companies (name, description)
VALUES ('Ракета', 'Основная компания')
ON CONFLICT DO NOTHING;
```

#### Блок 4

- **Строки**: 76–80
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: departments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Связываем все существующие подразделения с компанией "Ракета"
UPDATE public.departments
SET company_id = (SELECT id FROM public.companies WHERE name = 'Ракета' LIMIT 1)
WHERE company_id IS NULL;
```

---

### `supabase/migrations/20251114185956_4efa8bea-13ea-462d-b20b-9e2aa5e60609.sql`

#### Блок 1

- **Строки**: 24–26
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic, для
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Также добавим политику UPDATE для администраторов и HR BP
DROP POLICY IF EXISTS "Admin and HR BP can update diagnostic stages" ON diagnostic_stages;
```

#### Блок 2

- **Строки**: 27–46
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, diagnostic
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admin and HR BP can update diagnostic stages"
  ON diagnostic_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name IN ('diagnostics.manage', 'security.manage')
    )
  );
```

---

### `supabase/migrations/20251114190255_692e5281-0af2-4e9f-9863-47a321dfa23c.sql`

#### Блок 1

- **Строки**: 6–6
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admin and HR BP can update diagnostic stages" ON diagnostic_stages;
```

#### Блок 2

- **Строки**: 21–41
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, can, stages, с
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём политику UPDATE с правильными разрешениями
CREATE POLICY "Users with diagnostics.update can update stages"
  ON diagnostic_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.update'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.update'
    )
  );
```

---

### `supabase/migrations/20251114190555_8435c7db-3f41-43a7-9c94-6bb981bc3cdb.sql`

#### Блок 1

- **Строки**: 22–34
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, participants, с
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём политику UPDATE с правильным разрешением
CREATE POLICY "Users with manage_participants can update participants"
  ON diagnostic_stage_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_effective_permissions
      WHERE user_id = auth.uid()
        AND permission_name = 'diagnostics.manage_participants'
    )
  );
```

---

### `supabase/migrations/20251114200534_b9deded7-7074-4054-82e6-326311c259ab.sql`

#### Блок 1

- **Строки**: 13–15
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: comment
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update comment to reflect the change
COMMENT ON COLUMN grade_skills.target_level IS 'Target level for skill (0-10, where 0 represents entry/zero level)';
```

---

### `supabase/migrations/20251114204849_2c10345e-9f43-47b7-b96e-f13b35757665.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update RLS policies for soft_skill_results to allow HR BP and managers to view team results

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "soft_skill_results_select_auth_policy" ON soft_skill_results;
```

#### Блок 2

- **Строки**: 24–28
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update RLS policies for hard_skill_results to allow HR BP and managers to view team results

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "hard_skill_results_select_auth_policy" ON hard_skill_results;
```

---

### `supabase/migrations/20251114205057_8b53c1b8-efc1-4e99-964b-0f9b3f108b92.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update RLS policies for survey_360_assignments to allow managers and HR BP to view and manage team respondents

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON survey_360_assignments;
```

#### Блок 2

- **Строки**: 24–26
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: policy
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;
```

#### Блок 3

- **Строки**: 27–44
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, policy
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create new UPDATE policy with proper permissions for managers
CREATE POLICY "survey_360_assignments_update_auth_policy"
ON survey_360_assignments
FOR UPDATE
TO public
USING (
  -- Own assignments
  evaluated_user_id = auth.uid() 
  -- Admin and HR BP can manage all
  OR has_permission('diagnostics.manage'::text)
  -- Managers can manage their team's assignments (approve/reject respondents)
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  )
);
```

#### Блок 4

- **Строки**: 48–50
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
COMMENT ON POLICY "survey_360_assignments_update_auth_policy" ON survey_360_assignments IS 
'Users can update their own assignments, HR BP and admins can manage all, managers can approve/reject team respondents';
```

---

### `supabase/migrations/20251114205903_1be593b0-5ea2-48c0-b995-ca249d438367.sql`

#### Блок 1

- **Строки**: 25–27
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: policy
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;
```

#### Блок 2

- **Строки**: 28–45
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, policy
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create new UPDATE policy
CREATE POLICY "survey_360_assignments_update_auth_policy"
ON survey_360_assignments
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = survey_360_assignments.evaluated_user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);
```

---

### `supabase/migrations/20251114210921_0ae1c0d7-79dd-4033-a4fb-03d08fa69c82.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update hard_skill_results SELECT policy
DROP POLICY IF EXISTS "hard_skill_results_select_auth_policy" ON hard_skill_results;
```

#### Блок 2

- **Строки**: 21–23
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update soft_skill_results SELECT policy
DROP POLICY IF EXISTS "soft_skill_results_select_auth_policy" ON soft_skill_results;
```

---

### `supabase/migrations/20251115104144_da3ff1d5-b8e6-4fdd-9b43-db6307390036.sql`

#### Блок 1

- **Строки**: 30–56
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_trade_points_update_policy"
ON public.user_trade_points FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_trade_points.user_id
    AND users.manager_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_trade_points.user_id
    AND users.manager_id = auth.uid()
  )
);
```

#### Блок 2

- **Строки**: 97–125
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_skills_update_policy"
ON public.user_skills FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_skills.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_skills.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 3

- **Строки**: 167–195
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_qualities_update_policy"
ON public.user_qualities FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_qualities.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_qualities.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);
```

---

### `supabase/migrations/20251115110116_8c4e00a1-e91c-4d4d-aea4-7940299fc4bb.sql`

#### Блок 1

- **Строки**: 93–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "user_assessment_results_update_admin_hr"
ON public.user_assessment_results FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);
```

---

### `supabase/migrations/20251115113812_5763acc9-6272-477a-ae2e-ede507103990.sql`

#### Блок 1

- **Строки**: 58–78
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_stage_participants
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Функция для автоматического наследования участников от родительского этапа
CREATE OR REPLACE FUNCTION inherit_participants_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Если это подэтап (diagnostic), копируем участников от родителя
  IF NEW.parent_stage_id IS NOT NULL THEN
    INSERT INTO diagnostic_stage_participants (stage_id, user_id)
    SELECT NEW.id, user_id 
    FROM diagnostic_stage_participants 
    WHERE stage_id = NEW.parent_stage_id
    ON CONFLICT (stage_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 86–107
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: meeting_stage_participants
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Функция для синхронизации участников meeting_stages с родительским этапом
CREATE OR REPLACE FUNCTION sync_meeting_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Если у meeting_stage есть родительский diagnostic_stage, синхронизируем участников
  IF NEW.parent_diagnostic_stage_id IS NOT NULL THEN
    -- Копируем участников из diagnostic_stage_participants в meeting_stage_participants
    INSERT INTO meeting_stage_participants (stage_id, user_id)
    SELECT NEW.id, user_id 
    FROM diagnostic_stage_participants 
    WHERE stage_id = NEW.parent_diagnostic_stage_id
    ON CONFLICT (stage_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251115165558_4eaee76a-d378-4c08-8712-d61e4145fe0f.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: DROP
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Удаляем старую политику UPDATE
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;
```

#### Блок 2

- **Строки**: 3–28
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, с
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём новую политику UPDATE с правом для evaluated_user_id обновлять свои peer assignments
CREATE POLICY "survey_360_assignments_update_auth_policy" 
ON survey_360_assignments 
FOR UPDATE 
USING (
  -- Оценивающий может обновлять свои назначения
  evaluating_user_id = auth.uid() 
  OR 
  -- Оцениваемый может обновлять статус своих peer assignments (для отзыва списка)
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer')
  OR
  -- Руководитель оцениваемого может обновлять
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  ))
  OR
  -- Админы и HR BP могут обновлять
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);
```

---

### `supabase/migrations/20251115170044_b045c999-8c57-460c-b5d1-776a58a7edff.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: DROP
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Удаляем старые политики SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON survey_360_assignments;
```

#### Блок 2

- **Строки**: 42–94
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: CREATE, USING
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём новую политику UPDATE
CREATE POLICY "survey_360_assignments_update_policy" 
ON survey_360_assignments 
FOR UPDATE 
USING (
  -- Сотрудник может обновлять только свои peer assignments в статусе pending или rejected
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status IN ('pending', 'rejected')
  )
  OR
  -- Руководитель может обновлять статусы своих подчинённых
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = auth.uid()
    )
    AND assignment_type = 'peer'
  )
  OR
  -- Админы и HR могут всё
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
)
WITH CHECK (
  -- При обновлении проверяем те же условия
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status IN ('pending', 'rejected')
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = auth.uid()
    )
    AND assignment_type = 'peer'
  )
  OR
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);
```

---

### `supabase/migrations/20251115175031_cdfc111c-30ce-4dc1-b2fd-471f9dba963c.sql`

#### Блок 1

- **Строки**: 24–29
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "meeting_stages_update_auth_policy" 
ON meeting_stages 
FOR UPDATE 
TO authenticated
USING (has_permission('meetings.update'));
```

---

### `supabase/migrations/20251115175813_91a97e5d-6ab7-4b05-86aa-5b30bda8d420.sql`

#### Блок 1

- **Строки**: 42–47
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "parent_stages_update_auth_policy" 
ON parent_stages 
FOR UPDATE 
TO authenticated
USING (has_permission('diagnostics.update'));
```

#### Блок 2

- **Строки**: 64–69
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 8. Триггер для обновления updated_at
CREATE TRIGGER update_parent_stages_updated_at
BEFORE UPDATE ON public.parent_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20251115182259_0a78a87e-0c3d-4589-a4a9-a521ce3b6d2f.sql`

#### Блок 1

- **Строки**: 4–60
- **Тип операции**: `INSERT`
- **Целевые таблицы**: admin_activity_logs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем новую функцию логирования без ссылок на удалённые поля
CREATE OR REPLACE FUNCTION log_diagnostic_stage_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.email,
      'CREATE',
      'diagnostic_stage',
      p.period, -- берем из parent_stages
      jsonb_build_object(
        'stage_id', NEW.id,
        'parent_id', NEW.parent_id,
        'evaluation_period', NEW.evaluation_period
      )
    FROM users u
    LEFT JOIN parent_stages p ON p.id = NEW.parent_id
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT
      get_current_session_user(),
      u.email,
      'UPDATE',
      'diagnostic_stage',
      p.period, -- берем из parent_stages
      jsonb_build_object(
        'stage_id', NEW.id,
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    FROM users u
    LEFT JOIN parent_stages p ON p.id = NEW.parent_id
    WHERE u.id = get_current_session_user();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### Блок 2

- **Строки**: 61–66
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем триггеры заново
CREATE TRIGGER log_diagnostic_stage_changes_trigger
  AFTER INSERT OR UPDATE ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION log_diagnostic_stage_changes();
```

---

### `supabase/migrations/20251117163100_44152296-bbdf-4257-9b61-949452744507.sql`

#### Блок 1

- **Строки**: 6–6
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
```

#### Блок 2

- **Строки**: 21–39
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, roles
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update roles"
ON user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);
```

---

### `supabase/migrations/20251118073702_919df2c6-cee3-4822-a70f-0f9801466e84.sql`

#### Блок 1

- **Строки**: 33–43
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, category_soft_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update category_soft_skills"
ON public.category_soft_skills
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);
```

#### Блок 2

- **Строки**: 55–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create trigger for updated_at
CREATE TRIGGER update_category_soft_skills_updated_at
BEFORE UPDATE ON public.category_soft_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql`

#### Блок 1

- **Строки**: 29–38
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, answer_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update answer_categories"
  ON public.answer_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr_bp')
    )
  );
```

#### Блок 2

- **Строки**: 49–54
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Trigger для updated_at
CREATE TRIGGER update_answer_categories_updated_at
  BEFORE UPDATE ON public.answer_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

#### Блок 3

- **Строки**: 96–106
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: answer_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000002` | answer_category | unknown | yes |
| `00000000-0000-0000-0000-000000000001` | answer_category | unknown | yes |

```sql
-- ====================================================================
-- 5. Инициализация данных
-- ====================================================================

-- Создать две категории по умолчанию
INSERT INTO public.answer_categories (id, name, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Оценка Hard Skills', 'Категория ответов для оценки hard skills'),
  ('00000000-0000-0000-0000-000000000002', 'Оценка Soft Skills', 'Категория ответов для оценки soft skills')
ON CONFLICT (id) DO NOTHING;
```

#### Блок 4

- **Строки**: 107–115
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000001` | answer_category | answer_category_id | yes |

```sql
-- Обновить существующие варианты ответов hard_skill_answer_options
UPDATE public.hard_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000001',
  level_value = COALESCE(numeric_value, 0),
  label = COALESCE(title, ''),
  order_index = 1
WHERE answer_category_id IS NULL;
```

#### Блок 5

- **Строки**: 116–123
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000002` | answer_category | answer_category_id | yes |

```sql
-- Обновить существующие варианты ответов soft_skill_answer_options
UPDATE public.soft_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000002',
  level_value = COALESCE(numeric_value, 0),
  order_index = 1
WHERE answer_category_id IS NULL;
```

#### Блок 6

- **Строки**: 124–128
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000001` | answer_category | answer_category_id | yes |

```sql
-- Привязать существующие вопросы к категориям
UPDATE public.hard_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000001'
WHERE answer_category_id IS NULL;
```

#### Блок 7

- **Строки**: 129–132
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000002` | answer_category | answer_category_id | yes |

```sql
UPDATE public.soft_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000002'
WHERE answer_category_id IS NULL;
```

---

### `supabase/migrations/20251118102326_3848d879-6fa5-446b-8047-b7e3482fd9c5.sql`

#### Блок 1

- **Строки**: 170–180
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, sub_category_hard_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update sub_category_hard_skills"
  ON public.sub_category_hard_skills
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );
```

#### Блок 2

- **Строки**: 214–224
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, sub_category_soft_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update sub_category_soft_skills"
  ON public.sub_category_soft_skills
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );
```

---

### `supabase/migrations/20251119141351_7bb4eb6f-441d-4644-a427-d7c0e26ee903.sql`

#### Блок 1

- **Строки**: 1–88
- **Тип операции**: `OTHER`
- **Целевые таблицы**: N/A
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000000` | user | manager_id | yes |

```sql
-- Обновляем функцию расчета прогресса диагностического этапа
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_participants integer;
  completed_both integer;
  progress numeric;
  total_hard_questions integer;
  total_soft_questions integer;
BEGIN
  -- Получаем количество участников
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  -- Получаем общее количество вопросов
  SELECT COUNT(*) INTO total_hard_questions FROM hard_skill_questions;
  SELECT COUNT(*) INTO total_soft_questions FROM soft_skill_questions;
  
  -- Считаем участников, которые полностью прошли обе оценки
  SELECT COUNT(DISTINCT dsp.user_id) INTO completed_both
  FROM diagnostic_stage_participants dsp
  JOIN users u ON u.id = dsp.user_id
  WHERE dsp.stage_id = stage_id_param
    -- Hard skills: если есть вопросы, проверяем что ответили на все
    AND (
      total_hard_questions = 0 
      OR (
        SELECT COUNT(DISTINCT hsr.question_id)
        FROM hard_skill_results hsr
        WHERE hsr.evaluated_user_id = dsp.user_id
          AND hsr.evaluating_user_id = dsp.user_id
          AND hsr.diagnostic_stage_id = stage_id_param
          AND hsr.is_draft = false
      ) >= total_hard_questions
    )
    -- Soft skills: если есть вопросы, проверяем самооценку, руководителя и минимум 1 коллегу
    AND (
      total_soft_questions = 0
      OR (
        -- Самооценка: все вопросы
        (
          SELECT COUNT(DISTINCT ssr.question_id)
          FROM soft_skill_results ssr
          WHERE ssr.evaluated_user_id = dsp.user_id
            AND ssr.evaluating_user_id = dsp.user_id
            AND ssr.diagnostic_stage_id = stage_id_param
            AND ssr.is_draft = false
        ) >= total_soft_questions
        -- Оценка руководителя: все вопросы
        AND (
          u.manager_id IS NULL
          OR (
            SELECT COUNT(DISTINCT ssr.question_id)
            FROM soft_skill_results ssr
            WHERE ssr.evaluated_user_id = dsp.user_id
              AND ssr.evaluating_user_id = u.manager_id
              AND ssr.diagnostic_stage_id = stage_id_param
              AND ssr.is_draft = false
          ) >= total_soft_questions
        )
        -- Минимум 1 коллега оценил
        AND (
          SELECT COUNT(DISTINCT ssr.evaluating_user_id)
          FROM soft_skill_results ssr
          WHERE ssr.evaluated_user_id = dsp.user_id
            AND ssr.evaluating_user_id != dsp.user_id
            AND ssr.evaluating_user_id != COALESCE(u.manager_id, '00000000-0000-0000-0000-000000000000'::uuid)
            AND ssr.diagnostic_stage_id = stage_id_param
            AND ssr.is_draft = false
        ) >= 1
      )
    );
  
  -- Вычисляем процент
  progress := (completed_both::numeric / total_participants::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;
```

---

### `supabase/migrations/20251119141547_9f26d3bc-f474-47a2-96e8-515213617f3e.sql`

#### Блок 1

- **Строки**: 1–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггерную функцию для пересчета прогресса
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 31–72
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем триггер для обновления прогресса при изменении результатов
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_results_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id_val uuid;
  new_progress numeric;
  new_status text;
BEGIN
  -- Получаем stage_id из NEW или OLD
  IF TG_OP = 'DELETE' THEN
    stage_id_val := OLD.diagnostic_stage_id;
  ELSE
    stage_id_val := NEW.diagnostic_stage_id;
  END IF;
  
  -- Пересчитываем прогресс только если есть stage_id
  IF stage_id_val IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_id_val);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_id_val;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;
```

#### Блок 3

- **Строки**: 77–82
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: OR
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаем новые триггеры
CREATE TRIGGER update_stage_on_hard_skill_result
  AFTER INSERT OR UPDATE OR DELETE ON hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_on_results_change();
```

#### Блок 4

- **Строки**: 88–113
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Принудительно обновляем прогресс для всех активных этапов
DO $$
DECLARE
  stage_rec RECORD;
  new_progress numeric;
  new_status text;
BEGIN
  FOR stage_rec IN SELECT id FROM diagnostic_stages WHERE is_active = true LOOP
    new_progress := calculate_diagnostic_stage_progress(stage_rec.id);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_rec.id;
  END LOOP;
END $$;
```

---

### `supabase/migrations/20251121153234_b542c6b0-d3bf-466c-bcaa-c1bb7429beab.sql`

#### Блок 1

- **Строки**: 46–54
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: USING, own, their
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Users can update their own development plan tasks
CREATE POLICY "Users can update own development plan tasks"
ON public.development_plan_tasks
FOR UPDATE
USING (
  user_id = auth.uid() OR 
  has_permission('development.manage')
);
```

#### Блок 2

- **Строки**: 64–69
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create updated_at trigger
CREATE TRIGGER update_development_plan_tasks_updated_at
BEFORE UPDATE ON public.development_plan_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20251126095025_2991f499-6573-4192-abd2-9fc14cba4e5b.sql`

#### Блок 1

- **Строки**: 11–15
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, survey_360_assignments
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing records to have default value
UPDATE survey_360_assignments 
SET added_by_manager = false 
WHERE added_by_manager IS NULL;
```

---

### `supabase/migrations/20251126095446_444eccfb-3120-439a-9f35-0f75033f027b.sql`

#### Блок 1

- **Строки**: 1–53
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновление триггеров агрегации для корректной обработки peer-оценок
-- Peer-оценки должны включать ВСЕ оценки коллег (evaluating_user_id) с is_draft=false
-- НЕЗАВИСИМО от структуры подчинённости

-- Обновленная функция агрегации для hard skills
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND skill_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), hq.skill_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 54–103
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновленная функция агрегации для soft skills
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251126102914_43b7a963-8d76-4371-b13e-befc790c59bd.sql`

#### Блок 1

- **Строки**: 1–117
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Обновляем триггер для создания задачи peer_selection при добавлении участника
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Получаем ID самооценки из survey_360_assignments
  SELECT id INTO self_assignment_id
  FROM public.survey_360_assignments
  WHERE evaluated_user_id = NEW.user_id
    AND evaluating_user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND assignment_type = 'self';
  
  -- Создаём задачу peer_selection для участника
  IF self_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'peer_selection'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360. Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'peer_selection',
      'assessment'
    );
  END IF;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Получаем ID назначения руководителя из survey_360_assignments
    SELECT id INTO manager_assignment_id
    FROM public.survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND assignment_type = 'manager';
    
    -- Получаем ФИО участника
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF manager_assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND assignment_id = manager_assignment_id
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251126104734_8b43b49f-4fc2-4ae8-8185-72d62f0898a1.sql`

#### Блок 1

- **Строки**: 1–38
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём задачи peer_selection для всех существующих участников диагностики, у которых их нет
INSERT INTO public.tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  deadline,
  task_type,
  category
)
SELECT 
  dsp.user_id,
  dsp.stage_id,
  sa.id as assignment_id,
  'self' as assignment_type,
  'Выбрать оценивающих' as title,
  'Выберите коллег для проведения оценки 360. Срок: ' || ps.deadline_date::text as description,
  'pending' as status,
  ps.deadline_date,
  'peer_selection' as task_type,
  'assessment' as category
FROM public.diagnostic_stage_participants dsp
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
JOIN public.parent_stages ps ON ps.id = ds.parent_id
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id 
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
)
AND ds.is_active = true;
```

---

### `supabase/migrations/20251126111310_14eac296-3c4a-4150-815d-e519dd20e908.sql`

#### Блок 1

- **Строки**: 10–47
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Создаём недостающие peer_selection задачи для существующих участников
INSERT INTO public.tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  deadline,
  task_type,
  category
)
SELECT
  dsp.user_id,
  dsp.stage_id,
  sa.id,
  'self',
  'Выбрать оценивающих',
  'Выберите коллег для проведения оценки 360. Срок: ' || COALESCE(ps.deadline_date::text, 'не указан'),
  'pending',
  ps.deadline_date,
  'peer_selection',
  'assessment'
FROM public.diagnostic_stage_participants dsp
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
LEFT JOIN public.parent_stages ps ON ps.id = ds.parent_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
);
```

---

### `supabase/migrations/20251126113336_66afcdd3-5480-4f88-ae7b-bf1615b82c13.sql`

#### Блок 1

- **Строки**: 1–122
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем функцию создания задач для участников диагностики
-- Убираем зависимость от self assignment (устраняем race condition)

CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deadline_date_value DATE;
  manager_user_id UUID;
  participant_full_name TEXT;
  manager_assignment_id UUID;
BEGIN
  -- Получаем deadline из parent_stages через diagnostic_stages
  SELECT ps.deadline_date INTO deadline_date_value
  FROM public.diagnostic_stages ds
  LEFT JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- ===== ЗАДАЧА 1: peer_selection для участника =====
  -- Создаём задачу "Выбрать оценивающих" сразу, без ожидания self assignment
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'peer_selection'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      NULL,  -- Не привязываем к assignment, т.к. его ещё может не быть
      NULL,  -- assignment_type тоже NULL
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360' || 
        CASE WHEN deadline_date_value IS NOT NULL 
          THEN '. Срок: ' || deadline_date_value::text 
          ELSE '' 
        END,
      'pending',
      deadline_date_value,
      'peer_selection',
      'assessment'
    );
  END IF;
  
  -- ===== ЗАДАЧА 2: survey_360_evaluation для руководителя =====
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Получаем ФИО участника
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Ищем manager assignment (он создаётся триггером assign_surveys_to_diagnostic_participant)
    SELECT id INTO manager_assignment_id
    FROM public.survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND assignment_type = 'manager';
    
    -- Создаём задачу для руководителя только если assignment уже создан
    -- (триггер assign_surveys_to_diagnostic_participant создаёт assignments синхронно)
    IF manager_assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND assignment_id = manager_assignment_id
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || 
          CASE WHEN deadline_date_value IS NOT NULL 
            THEN '. Срок: ' || deadline_date_value::text 
            ELSE '' 
          END,
        'pending',
        deadline_date_value,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: hard_skill_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `a4a0bd3e-1d8c-4d91-b344-81b6b501aea2` | unknown | id | yes |

```sql
-- Удаляем вариант ответа с level_value = 4 для Hard Skills
-- Сначала удаляем все результаты, использующие этот вариант (если есть)
DELETE FROM hard_skill_results
WHERE answer_option_id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2';
```

#### Блок 2

- **Строки**: 5–9
- **Тип операции**: `DELETE`
- **Целевые таблицы**: hard_skill_answer_options
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `a4a0bd3e-1d8c-4d91-b344-81b6b501aea2` | unknown | id | yes |

```sql
-- Затем удаляем сам вариант ответа
DELETE FROM hard_skill_answer_options
WHERE id = 'a4a0bd3e-1d8c-4d91-b344-81b6b501aea2'
  AND level_value = 4;
```

#### Блок 3

- **Строки**: 10–15
- **Тип операции**: `OTHER`
- **Целевые таблицы**: N/A
- **Классификация**: `reference_data_change`
- **Рекомендация**: `REWRITE`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | yes |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes |
| suggested_business_key | name |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000001` | answer_category | answer_category_id | yes |

```sql
-- Проверяем результат
SELECT id, title, level_value, numeric_value 
FROM hard_skill_answer_options 
WHERE answer_category_id = '00000000-0000-0000-0000-000000000001'
ORDER BY level_value;
```

---

### `supabase/migrations/20251128085947_f50575ac-ed50-4eaf-ae01-f06bbf85198b.sql`

#### Блок 1

- **Строки**: 5–83
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Пересоздаем функцию без зависимости от существования assignments
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_deadline_date DATE;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем deadline_date из parent_stages через JOIN
  SELECT ps.deadline_date INTO parent_deadline_date
  FROM public.diagnostic_stages ds
  JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id, CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO manager_user_id, participant_full_name
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Создаём задачу peer_selection для участника БЕЗУСЛОВНО
  -- (не зависит от существования assignment - это исправляет race condition)
  INSERT INTO public.tasks (
    user_id,
    diagnostic_stage_id,
    title,
    description,
    status,
    deadline,
    task_type,
    category
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    'Выбрать оценивающих',
    'Выберите коллег для проведения оценки 360',
    'pending',
    parent_deadline_date,
    'peer_selection',
    'assessment'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Created peer_selection task for user % in stage %', NEW.user_id, NEW.stage_id;
  
  -- Если есть руководитель, создаём задачу peer_approval для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      manager_user_id,
      NEW.stage_id,
      'Утвердить оценивающих для ' || participant_full_name,
      'Рассмотрите и утвердите список оценивающих, выбранный сотрудником',
      'pending',
      parent_deadline_date,
      'peer_approval',
      'assessment'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created peer_approval task for manager % in stage %', manager_user_id, NEW.stage_id;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql`

#### Блок 1

- **Строки**: 60–63
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `75494d0f-37e3-452d-98cf-6e31b23561f7` | task | id | yes |

```sql
-- Удаляем некорректную задачу peer_approval без assignment_id
DELETE FROM public.tasks 
WHERE id = '75494d0f-37e3-452d-98cf-6e31b23561f7';
```

---

### `supabase/migrations/20251203171358_ad8bf733-934a-4f77-95ce-c2166427a342.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_answer_options
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update soft_skill_answer_options level_value constraint from 0-4 to 0-5
ALTER TABLE soft_skill_answer_options 
  DROP CONSTRAINT soft_skill_answer_options_level_value_check;
```

---

### `supabase/migrations/20251203224143_5449843a-2499-4bb3-98f6-0161dd10bd97.sql`

#### Блок 1

- **Строки**: 3–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем черновики soft_skill_results
UPDATE soft_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);
```

#### Блок 2

- **Строки**: 17–24
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Исправляем черновики hard_skill_results
UPDATE hard_skill_results 
SET is_draft = false, updated_at = now()
WHERE is_draft = true 
AND assignment_id IN (
  SELECT id FROM survey_360_assignments WHERE status = 'completed'
);
```

---

### `supabase/migrations/20251208081020_cb14a461-81aa-4cd7-81fd-2a6e44f067d5.sql`

#### Блок 1

- **Строки**: 1–4
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing peer_selection tasks with new title
UPDATE public.tasks 
SET title = 'Выбрать респондентов'
WHERE task_type = 'peer_selection' AND title = 'Выбрать оценивающих';
```

#### Блок 2

- **Строки**: 5–54
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update the database function to use new title
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deadline_date_value DATE;
BEGIN
  -- Get parent stage deadline
  SELECT ps.deadline_date INTO deadline_date_value
  FROM diagnostic_stages ds
  JOIN parent_stages ps ON ds.parent_id = ps.id
  WHERE ds.id = NEW.stage_id;

  -- Create peer_selection task if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE user_id = NEW.user_id 
      AND diagnostic_stage_id = NEW.stage_id 
      AND task_type = 'peer_selection'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      task_type,
      priority,
      category,
      deadline
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Выбрать респондентов',
      'Выберите коллег для проведения оценки 360',
      'pending',
      'peer_selection',
      'urgent',
      'assessment',
      deadline_date_value
    );
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20251208132404_47d3e270-e4f0-4c5d-b291-ce0aac87fb09.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing peer_selection tasks description
UPDATE public.tasks 
SET description = 'Выберите респондентов для прохождения формы "Обратная связь 360"'
WHERE task_type = 'peer_selection' 
AND description LIKE '%Выберите коллег для проведения оценки 360%';
```

#### Блок 2

- **Строки**: 6–12
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing self-assessment tasks title  
UPDATE public.tasks
SET title = 'Начать опрос "Обратная связь 360" по себе'
WHERE task_type = 'diagnostic_stage'
AND assignment_type = 'self'
AND title = 'Пройти самооценку';
```

#### Блок 3

- **Строки**: 13–97
- **Тип операции**: `INSERT`
- **Целевые таблицы**: survey_360_assignments, tasks, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update the trigger function for new tasks
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  stage_deadline_date DATE;
  self_assignment_id UUID;
BEGIN
  -- Get deadline from parent_stages
  SELECT ps.deadline_date INTO stage_deadline_date
  FROM diagnostic_stages ds
  JOIN parent_stages ps ON ds.parent_id = ps.id
  WHERE ds.id = NEW.stage_id;

  -- Create self assignment
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'pending'
  )
  RETURNING id INTO self_assignment_id;

  -- Create self-assessment task with new title
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    assignment_id,
    assignment_type,
    title,
    description,
    status,
    deadline,
    category,
    task_type
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    self_assignment_id,
    'self',
    'Начать опрос "Обратная связь 360" по себе',
    'Необходимо пройти опрос "Обратная связь 360" по себе. Срок: ' || COALESCE(stage_deadline_date::text, 'не указан'),
    'pending',
    stage_deadline_date,
    'diagnostic_stage',
    'diagnostic_stage'
  );

  -- Create peer_selection task with new description
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    title,
    description,
    status,
    deadline,
    task_type,
    priority,
    category
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    'Выбрать респондентов',
    'Выберите респондентов для прохождения формы "Обратная связь 360"',
    'pending',
    stage_deadline_date,
    'peer_selection',
    'urgent',
    'assessment'
  );

  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251208135653_160f7da7-f0fb-4f15-bdae-b0cb0a880bd3.sql`

#### Блок 1

- **Строки**: 1–23
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, parent_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create function to auto-deactivate parent stages based on deadline
CREATE OR REPLACE FUNCTION public.check_and_deactivate_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deactivate parent stages where deadline_date has passed
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true 
    AND deadline_date < CURRENT_DATE;
    
  -- Also deactivate diagnostic stages linked to expired parent stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND parent_id IN (
      SELECT id FROM parent_stages WHERE is_active = false
    );
END;
$$;
```

---

### `supabase/migrations/20251209115249_7659a085-5989-4f07-92cc-992e5e0d59fd.sql`

#### Блок 1

- **Строки**: 1–50
- **Тип операции**: `INSERT`
- **Целевые таблицы**: user_assessment_results
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix aggregate_soft_skill_results to run with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 51–93
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Also fix update_user_qualities_from_survey (already has SECURITY DEFINER but verify)
-- and update_diagnostic_stage_on_results_change
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_results_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_id_val uuid;
  new_progress numeric;
  new_status text;
BEGIN
  -- Получаем stage_id из NEW или OLD
  IF TG_OP = 'DELETE' THEN
    stage_id_val := OLD.diagnostic_stage_id;
  ELSE
    stage_id_val := NEW.diagnostic_stage_id;
  END IF;
  
  -- Пересчитываем прогресс только если есть stage_id
  IF stage_id_val IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_id_val);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_id_val;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;
```

---

### `supabase/migrations/20251209115723_4022d2c6-16d1-4d63-96c9-b5620e86cea8.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- First fix existing data that violates new constraint
UPDATE user_skills SET target_level = 4 WHERE target_level > 4;
```

---

### `supabase/migrations/20251209115844_ab58afed-5735-4d40-a87a-20c2e86ee4ff.sql`

#### Блок 1

- **Строки**: 8–47
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix update_user_qualities_from_survey to cap target_level at max scale
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      LEAST(ao.numeric_value + 1, 5), -- Cap at max soft skill level
      NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM soft_skill_results sr
        JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN soft_skill_questions sq ON sq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND sq.quality_id = user_qualities.quality_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 48–87
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Also fix update_user_skills_from_survey to cap at 4
CREATE OR REPLACE FUNCTION public.update_user_skills_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      hq.skill_id,
      ao.numeric_value,
      LEAST(ao.numeric_value + 1, 4), -- Cap at max hard skill level
      NEW.created_at
    FROM hard_skill_questions hq
    JOIN hard_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE hq.id = NEW.question_id 
      AND hq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM hard_skill_results sr
        JOIN hard_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN hard_skill_questions hq ON hq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND hq.skill_id = user_skills.skill_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20251209115905_d2f8f98e-ca82-4e8b-b333-b6d9169a1495.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all, hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update all hard_skill_results to is_draft=false
UPDATE hard_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;
```

#### Блок 2

- **Строки**: 6–10
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: all, soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update all soft_skill_results to is_draft=false  
UPDATE soft_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;
```

---

### `supabase/migrations/20251209121101_90891b91-8f3c-443b-9f2b-7ca66a553766.sql`

#### Блок 1

- **Строки**: 1–56
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix trigger to use grade-based target_level instead of numeric_value + 1
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grade_id UUID;
  v_target_level NUMERIC;
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    -- Получаем grade_id пользователя
    SELECT grade_id INTO v_grade_id
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Получаем target_level из grade_qualities
    SELECT gq.target_level INTO v_target_level
    FROM soft_skill_questions sq
    JOIN grade_qualities gq ON gq.quality_id = sq.quality_id AND gq.grade_id = v_grade_id
    WHERE sq.id = NEW.question_id
      AND sq.quality_id IS NOT NULL;
    
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      COALESCE(v_target_level, 5), -- Use grade target or default to max (5)
      NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM soft_skill_results sr
        JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN soft_skill_questions sq ON sq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND sq.quality_id = user_qualities.quality_id
          AND sr.is_draft = false
      ),
      target_level = COALESCE(v_target_level, user_qualities.target_level),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 57–69
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: existing, user_qualities
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update existing user_qualities to use correct target_level from grade_qualities
UPDATE user_qualities
SET target_level = subq.grade_target,
    updated_at = now()
FROM (
  SELECT uq.id as uq_id, gq.target_level as grade_target
  FROM user_qualities uq
  JOIN users u ON u.id = uq.user_id
  JOIN grade_qualities gq ON gq.grade_id = u.grade_id AND gq.quality_id = uq.quality_id
  WHERE gq.target_level IS NOT NULL
) subq
WHERE user_qualities.id = subq.uq_id;
```

---

### `supabase/migrations/20260116113855_d573189c-e90b-45ff-bafe-e5044e52c790.sql`

#### Блок 1

- **Строки**: 20–35
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: parent_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновление функции check_and_deactivate_expired_stages
-- Теперь деактивация происходит по end_date, а не по reminder_date
CREATE OR REPLACE FUNCTION public.check_and_deactivate_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Деактивируем этапы, у которых end_date прошел (жёсткое закрытие)
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true AND end_date < CURRENT_DATE;
END;
$$;
```

#### Блок 2

- **Строки**: 36–102
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. Функция для финализации данных при завершении этапа
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_stage RECORD;
BEGIN
  -- Получаем информацию о родительском этапе
  SELECT ps.* INTO parent_stage
  FROM parent_stages ps
  WHERE ps.id = stage_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found: %', stage_id;
  END IF;
  
  -- Проверяем, что этап завершён (end_date прошла)
  IF parent_stage.end_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Stage is not yet expired: end_date is %', parent_stage.end_date;
  END IF;
  
  -- Получаем id диагностического подэтапа
  DECLARE
    diag_stage_id UUID;
  BEGIN
    SELECT ds.id INTO diag_stage_id
    FROM diagnostic_stages ds
    WHERE ds.parent_id = stage_id
    LIMIT 1;
    
    IF diag_stage_id IS NOT NULL THEN
      -- 8.1. Финализация назначений (assignments)
      -- Сохраняем текущий статус в снимок и переводим незавершённые в expired
      UPDATE survey_360_assignments
      SET 
        status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
        stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
        status = CASE 
          WHEN status IN ('completed', 'rejected') THEN status
          ELSE 'expired'
        END,
        updated_at = now()
      WHERE diagnostic_stage_id = diag_stage_id
        AND status NOT IN ('completed', 'rejected', 'expired');
      
      -- 8.3. Финализация задач (tasks)
      -- Сохраняем текущий статус в снимок и переводим незавершённые в expired
      UPDATE tasks
      SET 
        status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
        stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
        status = CASE 
          WHEN status = 'completed' THEN status
          ELSE 'expired'
        END,
        updated_at = now()
      WHERE diagnostic_stage_id = diag_stage_id
        AND status != 'completed'
        AND status != 'expired';
    END IF;
  END;
END;
$$;
```

#### Блок 3

- **Строки**: 103–145
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Функция для переоткрытия этапа администратором (раздел 8.0)
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diag_stage_id UUID;
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;
  
  -- Получаем id диагностического подэтапа
  SELECT ds.id INTO diag_stage_id
  FROM diagnostic_stages ds
  WHERE ds.parent_id = stage_id
  LIMIT 1;
  
  IF diag_stage_id IS NOT NULL THEN
    -- Восстанавливаем статусы назначений из снимка
    UPDATE survey_360_assignments
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
    
    -- Восстанавливаем статусы задач из снимка
    UPDATE tasks
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
  END IF;
END;
$$;
```

#### Блок 4

- **Строки**: 169–195
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: parent_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 7. Функция для автоматической финализации при загрузке данных
CREATE OR REPLACE FUNCTION public.check_and_finalize_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_stage RECORD;
BEGIN
  -- Находим все этапы, которые истекли, но ещё активны
  FOR expired_stage IN
    SELECT id
    FROM parent_stages
    WHERE is_active = true AND end_date < CURRENT_DATE
  LOOP
    -- Финализируем каждый этап
    PERFORM public.finalize_expired_stage(expired_stage.id);
    
    -- Деактивируем этап
    UPDATE parent_stages
    SET is_active = false, updated_at = now()
    WHERE id = expired_stage.id;
  END LOOP;
END;
$$;
```

---

### `supabase/migrations/20260116173337_be308aef-f578-4083-8063-b7171f4ffd74.sql`

#### Блок 1

- **Строки**: 5–89
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: one_on_one_meetings, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. Обновляем функцию finalize_expired_stage для обработки one_on_one_meetings
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_stage RECORD;
  diag_stage_id UUID;
  meet_stage_id UUID;
BEGIN
  -- Получаем информацию о родительском этапе
  SELECT ps.* INTO parent_stage
  FROM parent_stages ps
  WHERE ps.id = stage_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found: %', stage_id;
  END IF;
  
  -- Проверяем, что этап завершён (end_date прошла)
  IF parent_stage.end_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Stage is not yet expired: end_date is %', parent_stage.end_date;
  END IF;
  
  -- Получаем id диагностического подэтапа
  SELECT ds.id INTO diag_stage_id
  FROM diagnostic_stages ds
  WHERE ds.parent_id = stage_id
  LIMIT 1;
  
  IF diag_stage_id IS NOT NULL THEN
    -- Финализация назначений (assignments)
    UPDATE survey_360_assignments
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status IN ('completed', 'rejected') THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status NOT IN ('completed', 'rejected', 'expired');
    
    -- Финализация задач (tasks)
    UPDATE tasks
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status = 'completed' THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status != 'completed'
      AND status != 'expired';
  END IF;
  
  -- Получаем id meeting подэтапа
  SELECT ms.id INTO meet_stage_id
  FROM meeting_stages ms
  WHERE ms.parent_id = stage_id
  LIMIT 1;
  
  IF meet_stage_id IS NOT NULL THEN
    -- Финализация one_on_one_meetings
    UPDATE one_on_one_meetings
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status = 'approved' THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE stage_id = meet_stage_id
      AND status != 'approved'
      AND status != 'expired';
  END IF;
END;
$$;
```

#### Блок 2

- **Строки**: 90–150
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновляем функцию reopen_expired_stage для восстановления one_on_one_meetings
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diag_stage_id UUID;
  meet_stage_id UUID;
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;
  
  -- Получаем id диагностического подэтапа
  SELECT ds.id INTO diag_stage_id
  FROM diagnostic_stages ds
  WHERE ds.parent_id = stage_id
  LIMIT 1;
  
  IF diag_stage_id IS NOT NULL THEN
    -- Восстанавливаем статусы назначений из снимка
    UPDATE survey_360_assignments
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
    
    -- Восстанавливаем статусы задач из снимка
    UPDATE tasks
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
  END IF;
  
  -- Получаем id meeting подэтапа
  SELECT ms.id INTO meet_stage_id
  FROM meeting_stages ms
  WHERE ms.parent_id = stage_id
  LIMIT 1;
  
  IF meet_stage_id IS NOT NULL THEN
    -- Восстанавливаем статусы one_on_one_meetings из снимка
    UPDATE one_on_one_meetings
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE stage_id = meet_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
  END IF;
END;
$$;
```

---

### `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql`

#### Блок 1

- **Строки**: 1–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: unique
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- FIX BUG 1 & BUG 2: Update unique constraint to include diagnostic_stage_id
-- This ensures assignments are properly isolated between stages
-- ============================================

-- Step 1: Drop old unique constraints that don't include diagnostic_stage_id
ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_evaluating_unique;
```

#### Блок 2

- **Строки**: 18–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36` | assignment | unknown | yes |
| `7c04b872-6de2-418d-b959-616894d398d7` | assignment | unknown | yes |

```sql
-- Step 3: Create missing self assignment for Yurasova in the current stage
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'self',
  'approved'
)
ON CONFLICT DO NOTHING;
```

#### Блок 3

- **Строки**: 34–52
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef` | assignment | unknown | yes |
| `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36` | assignment | unknown | yes |
| `7c04b872-6de2-418d-b959-616894d398d7` | assignment | unknown | yes |

```sql
-- Step 4: Create missing manager assignment for Yurasova in the current stage
-- Manager is 4cf40061-4c6f-4379-8082-5bb2ddd8a5ef
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  is_manager_participant,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'manager',
  true,
  'approved'
)
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql`

#### Блок 1

- **Строки**: 1–32
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks, the
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `fb6846f5-54df-4e1a-a4f6-435a9848f454` | assignment | assignment_id | yes |
| `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36` | task | unknown | yes |
| `7c04b872-6de2-418d-b959-616894d398d7` | task | unknown | yes |

```sql
-- ============================================
-- FIX BUG 3: Create missing tasks for self and manager assignments
-- Also update the trigger to properly create tasks
-- ============================================

-- Create self-assessment task for Yurasova if not exists
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'fb6846f5-54df-4e1a-a4f6-435a9848f454',
  'self',
  'Пройти самооценку',
  'Необходимо пройти комплексную оценку компетенций (самооценка)',
  'expired',  -- Stage has ended, so mark as expired
  'diagnostic_stage',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = 'fb6846f5-54df-4e1a-a4f6-435a9848f454'
);
```

#### Блок 2

- **Строки**: 33–59
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `0b17db1b-93c5-4dc4-919f-2b91a9de73da` | assignment | assignment_id | yes |
| `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef` | task | unknown | yes |
| `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36` | task | unknown | yes |

```sql
-- Create manager evaluation task for Yurasova if not exists
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  '0b17db1b-93c5-4dc4-919f-2b91a9de73da',
  'manager',
  'Оценка подчинённого: Юрасова',
  'Необходимо пройти оценку 360 для Юрасова',
  'expired',  -- Stage has ended, so mark as expired
  'survey_360_evaluation',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = '0b17db1b-93c5-4dc4-919f-2b91a9de73da'
);
```

#### Блок 3

- **Строки**: 60–65
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: self, survey_360_assignments
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `fb6846f5-54df-4e1a-a4f6-435a9848f454` | assignment | unknown | yes |
| `0b17db1b-93c5-4dc4-919f-2b91a9de73da` | assignment | unknown | yes |

```sql
-- Update self/manager assignments to expired since stage has ended
UPDATE survey_360_assignments
SET status = 'expired', status_at_stage_end = 'approved'
WHERE id IN ('fb6846f5-54df-4e1a-a4f6-435a9848f454', '0b17db1b-93c5-4dc4-919f-2b91a9de73da')
  AND status = 'approved';
```

#### Блок 4

- **Строки**: 66–260
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: survey_360_assignments, tasks, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================
-- Update the trigger function to properly create tasks for self/manager
-- The current function uses ON CONFLICT DO NOTHING which silently fails
-- We need to ensure tasks are created even when assignment already exists
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  stage_deadline DATE;
  stage_reminder DATE;
  existing_task_count INT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем руководителя и даты из parent_stages через parent_id
  SELECT u.manager_id, ps.end_date, ps.reminder_date
  INTO manager_user_id, stage_deadline, stage_reminder
  FROM users u
  CROSS JOIN diagnostic_stages ds
  LEFT JOIN parent_stages ps ON ps.id = ds.parent_id
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;

  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;

  -- Проверяем, есть ли уже задача на выбор респондентов для этого пользователя в этом этапе
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'peer_selection';

  -- Создаём SELF assignment для сотрудника (самооценка)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
  RETURNING id INTO self_assignment_id;

  -- Если assignment уже существовал, получаем его id
  IF self_assignment_id IS NULL THEN
    SELECT id INTO self_assignment_id
    FROM survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id;
  END IF;

  -- Создаём задачу на выбор респондентов (если ещё нет)
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360. Напоминание: ' || COALESCE(stage_reminder::text, 'не указано') || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'peer_selection',
      'assessment'
    );
  END IF;

  -- Создаём задачу на самооценку для сотрудника (если ещё нет)
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'diagnostic_stage';

  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка). Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'diagnostic_stage',
      'assessment'
    );
  END IF;

  -- Если есть руководитель, создаём manager assignment и задачу
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      is_manager_participant,
      status
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      true,
      'approved'
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
    RETURNING id INTO manager_assignment_id;

    -- Если assignment уже существовал, получаем его id
    IF manager_assignment_id IS NULL THEN
      SELECT id INTO manager_assignment_id
      FROM survey_360_assignments
      WHERE evaluated_user_id = NEW.user_id
        AND evaluating_user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id;
    END IF;

    -- Создаём задачу для руководителя (если ещё нет)
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;

    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
        'pending',
        stage_deadline,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20260128124303_d97e92c0-2dd6-45a4-ae43-e39764c02531.sql`

#### Блок 1

- **Строки**: 1–60
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, meeting_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ШАГ 1: Модифицировать функцию finalize_expired_stage для каскадной деактивации diagnostic_stages
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные meeting_stages
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = stage_id;

  -- Снапшотим статусы survey_360_assignments для этого этапа
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы tasks для этого этапа
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы one_on_one_meetings для этого этапа
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('approved', 'expired');
END;
$$;
```

#### Блок 2

- **Строки**: 61–113
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ШАГ 2: Модифицировать функцию reopen_expired_stage для каскадной активации diagnostic_stages
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно активируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = true, updated_at = now()
  WHERE parent_id = stage_id;

  -- Восстанавливаем статусы survey_360_assignments из снапшота
  UPDATE survey_360_assignments
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы tasks из снапшота
  UPDATE tasks
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы one_on_one_meetings из снапшота
  UPDATE one_on_one_meetings
  SET 
    status = COALESCE(status_at_stage_end, 'draft'),
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;
END;
$$;
```

#### Блок 3

- **Строки**: 114–122
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ШАГ 3: Одноразовый фикс для синхронизации существующих данных
-- Деактивируем diagnostic_stages, у которых parent_stage уже неактивен
UPDATE diagnostic_stages ds
SET is_active = false, updated_at = now()
FROM parent_stages ps
WHERE ds.parent_id = ps.id 
  AND ps.is_active = false 
  AND ds.is_active = true;
```

---

### `supabase/migrations/20260129083404_760b805f-a9e5-4d2a-b5c6-f5e49229e7ff.sql`

#### Блок 1

- **Строки**: 7–70
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, meeting_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. Обновляем функцию finalize_expired_stage с учётом rejected статуса
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = stage_id;

  -- 2. Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = stage_id;

  -- 3. Обновляем meeting_stages (без is_active, только timestamp)
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = stage_id;

  -- 4. Снапшотим и переводим незавершённые assignments в expired
  --    ВАЖНО: completed и rejected НЕ трогаем (финальные статусы)
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired', 'rejected');

  -- 5. Снапшотим и переводим незавершённые tasks в expired
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- 6. Снапшотим и переводим незавершённые meetings в expired
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('approved', 'expired');
  
  -- soft_skill_results и hard_skill_results НЕ изменяются (is_draft остаётся как есть)
END;
$function$;
```

---

### `supabase/migrations/20260205120635_7cc67402-b331-4830-95d4-6947fd0d5271.sql`

#### Блок 1

- **Строки**: 17–75
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ==============================================
-- 3. Обновляем триггер soft skills с UPSERT
-- ==============================================
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  -- UPSERT вместо DELETE + INSERT
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, 
    stage_id, 
    get_evaluation_period(NOW()), 
    NOW(), 
    sq.quality_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id
  ON CONFLICT (user_id, quality_id, diagnostic_stage_id, assessment_period) 
  WHERE quality_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    manager_assessment = EXCLUDED.manager_assessment,
    peers_average = EXCLUDED.peers_average,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 76–134
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, user_assessment_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ==============================================
-- 4. Обновляем триггер hard skills с UPSERT
-- ==============================================
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  -- UPSERT вместо DELETE + INSERT
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, 
    stage_id, 
    get_evaluation_period(NOW()), 
    NOW(), 
    hq.skill_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id
  ON CONFLICT (user_id, skill_id, diagnostic_stage_id, assessment_period) 
  WHERE skill_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    manager_assessment = EXCLUDED.manager_assessment,
    peers_average = EXCLUDED.peers_average,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20260206102432_ef8fc686-1c10-4215-ac3e-46a5c8591f6a.sql`

#### Блок 1

- **Строки**: 9–9
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: answer_categories
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Admins can update answer_categories" ON answer_categories TO authenticated;
```

#### Блок 2

- **Строки**: 24–24
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: category_soft_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Admins can update category_soft_skills" ON category_soft_skills TO authenticated;
```

#### Блок 3

- **Строки**: 39–39
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: own
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Users can update own development plan tasks" ON development_plan_tasks TO authenticated;
```

#### Блок 4

- **Строки**: 53–53
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: participants
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Users with manage_participants can update participants" ON diagnostic_stage_participants TO authenticated;
```

#### Блок 5

- **Строки**: 59–59
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: can, stages
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Users with diagnostics.update can update stages" ON diagnostic_stages TO authenticated;
```

#### Блок 6

- **Строки**: 135–135
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: sub_category_hard_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Admins can update sub_category_hard_skills" ON sub_category_hard_skills TO authenticated;
```

#### Блок 7

- **Строки**: 141–141
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: sub_category_soft_skills
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
ALTER POLICY "Admins can update sub_category_soft_skills" ON sub_category_soft_skills TO authenticated;
```

---

### `supabase/migrations/20260206105635_9c4d4e7a-4994-459e-b698-e1144f06282e.sql`

#### Блок 1

- **Строки**: 1–9
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- ФАЗА 1: Добавление недостающих permissions
-- =====================================================

-- 1. security.manage_users
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'security.manage_users', 'security', 'manage_users', 
        'Полное управление пользователями системы')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 2

- **Строки**: 10–15
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. development.manage
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.manage', 'development', 'manage', 
        'Полное управление планами развития')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 3

- **Строки**: 16–21
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 3. development.view_all
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'development.view_all', 'development', 'view_all', 
        'Просмотр всех планов развития')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 4

- **Строки**: 22–27
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 4. meetings.view_all
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.view_all', 'meetings', 'view_all', 
        'Просмотр всех встреч 1:1')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 5

- **Строки**: 28–33
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. meetings.manage
INSERT INTO permissions (id, name, resource, action, description)
VALUES (gen_random_uuid(), 'meetings.manage', 'meetings', 'manage', 
        'Полное управление встречами 1:1')
ON CONFLICT (name) DO NOTHING;
```

#### Блок 6

- **Строки**: 34–50
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- =====================================================
-- ФАЗА 2: Назначение разрешений ролям
-- =====================================================

-- Назначение новых permissions для admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', p.id FROM permissions p 
WHERE p.name IN (
  'security.manage_users',
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 7

- **Строки**: 51–64
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение permissions для hr_bp
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp', p.id FROM permissions p 
WHERE p.name IN (
  'development.manage',
  'development.view_all',
  'meetings.view_all',
  'meetings.manage',
  'diagnostics.manage',
  'users.view',
  'security.view_admin_panel'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 8

- **Строки**: 65–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение permissions для manager
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', p.id FROM permissions p 
WHERE p.name IN (
  'diagnostics.export_results',
  'development.view_all'
)
ON CONFLICT (role, permission_id) DO NOTHING;
```

#### Блок 9

- **Строки**: 74–81
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Назначение grades.view для всех ролей
INSERT INTO role_permissions (role, permission_id)
SELECT role_name::app_role, p.id 
FROM permissions p, 
     unnest(ARRAY['hr_bp', 'manager', 'employee']) as role_name
WHERE p.name = 'grades.view'
ON CONFLICT (role, permission_id) DO NOTHING;
```

---

### `supabase/migrations/20260216111857_1cd31468-8a9f-45ce-9186-84c6b07f97f5.sql`

#### Блок 1

- **Строки**: 17–19
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: index
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Update index
DROP INDEX IF EXISTS idx_johari_snapshots_stage_user;
```

---

### `supabase/migrations/20260219121219_936ea826-80b1-4c13-97f9-f77f10a64636.sql`

#### Блок 1

- **Строки**: 43–73
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: SET, from, meeting_status_current
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- No direct INSERT/UPDATE from clients; done via trigger

-- 4. Trigger: upsert meeting_status_current on status change
CREATE OR REPLACE FUNCTION public.upsert_meeting_status_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO meeting_status_current (meeting_id, status, status_updated_by, status_updated_at, reason, mode)
  VALUES (
    NEW.id,
    NEW.status,
    COALESCE(auth.uid(), NEW.created_by),
    now(),
    CASE WHEN NEW.status = 'returned' THEN NEW.return_reason ELSE NULL END,
    CASE WHEN NEW.stage_id IS NULL THEN 'stage_less' ELSE 'stage' END
  )
  ON CONFLICT (meeting_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    status_updated_by = EXCLUDED.status_updated_by,
    status_updated_at = EXCLUDED.status_updated_at,
    reason = EXCLUDED.reason,
    mode = EXCLUDED.mode;
  
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 79–111
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 5. Trigger: create task for stage-less meetings
CREATE OR REPLACE FUNCTION public.create_stageless_meeting_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.stage_id IS NULL THEN
    INSERT INTO tasks (
      user_id,
      title,
      description,
      status,
      task_type,
      category,
      deadline,
      priority
    ) VALUES (
      NEW.employee_id,
      'Встреча 1:1',
      'Заполните форму встречи 1:1 с руководителем',
      'pending',
      'meeting',
      'Встречи 1:1',
      NEW.meeting_date::date,
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 117–137
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 6. expire_stageless_meetings function (for pg_cron)
CREATE OR REPLACE FUNCTION public.expire_stageless_meetings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE one_on_one_meetings
  SET
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IS NULL
    AND meeting_date IS NOT NULL
    AND meeting_date < now()
    AND status IN ('draft', 'submitted', 'returned');
END;
$$;
```

#### Блок 4

- **Строки**: 138–199
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_stages, finalize_expired_stage, meeting_stages, one_on_one_meetings, parent_stages, survey_360_assignments, tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 7. Update finalize_expired_stage to exclude stage-less meetings
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(p_stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = p_stage_id;

  -- 2. Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = p_stage_id;

  -- 3. Обновляем meeting_stages
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = p_stage_id;

  -- 4. Снапшотим assignments
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('completed', 'expired', 'rejected');

  -- 5. Снапшотим tasks (только stage-based)
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- 6. Снапшотим meetings (только stage-based, WHERE stage_id IS NOT NULL)
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IS NOT NULL
  AND stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('approved', 'expired');
END;
$$;
```

#### Блок 5

- **Строки**: 200–202
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: RLS
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 8. Update RLS INSERT policy to allow manager creation
DROP POLICY IF EXISTS "one_on_one_meetings_insert_auth_policy" ON public.one_on_one_meetings;
```

---

### `supabase/migrations/20260219122044_32222d79-d25b-4379-b360-2e21b061521c.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `OTHER`
- **Целевые таблицы**: N/A
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `840e909a-f4d8-44be-957e-cb96c15495db` | unknown | unknown | no |

```sql
-- Принудительное завершение этапа "Тест 1:1"
SELECT finalize_expired_stage('840e909a-f4d8-44be-957e-cb96c15495db'::uuid);
```

---

### `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_status_current
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `addeb7ac-a109-429c-a3d0-57fd5a8700ea` | meeting | meeting_id | yes |

```sql
-- Clean up Yurasova's expired meeting and related data for clean testing flow
DELETE FROM meeting_status_current WHERE meeting_id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `addeb7ac-a109-429c-a3d0-57fd5a8700ea` | meeting | id | yes |

```sql
DELETE FROM one_on_one_meetings WHERE id = 'addeb7ac-a109-429c-a3d0-57fd5a8700ea';
```

---

### `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_status_current
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204` | meeting | meeting_id | yes |

```sql
DELETE FROM meeting_status_current WHERE meeting_id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
```

#### Блок 2

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204` | meeting | id | yes |

```sql
DELETE FROM one_on_one_meetings WHERE id = '9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204';
```

#### Блок 3

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `7c04b872-6de2-418d-b959-616894d398d7` | user | user_id | yes |

```sql
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';
```

---

### `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_decisions
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `02c574af-fe19-4c56-811b-1fb80ba719f9` | meeting | meeting_id | yes |

```sql
DELETE FROM meeting_decisions WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 2

- **Строки**: 2–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_private_notes
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `02c574af-fe19-4c56-811b-1fb80ba719f9` | meeting | meeting_id | yes |

```sql
DELETE FROM meeting_private_notes WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 3

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_status_current
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `02c574af-fe19-4c56-811b-1fb80ba719f9` | meeting | meeting_id | yes |

```sql
DELETE FROM meeting_status_current WHERE meeting_id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 4

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `02c574af-fe19-4c56-811b-1fb80ba719f9` | meeting | id | yes |

```sql
DELETE FROM one_on_one_meetings WHERE id = '02c574af-fe19-4c56-811b-1fb80ba719f9';
```

#### Блок 5

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `7c04b872-6de2-418d-b959-616894d398d7` | user | user_id | yes |

```sql
DELETE FROM tasks WHERE user_id = '7c04b872-6de2-418d-b959-616894d398d7' AND task_type = 'meeting';
```

---

### `supabase/migrations/20260220121928_6ce31c94-7c55-4eca-b724-fa316e83da14.sql`

#### Блок 1

- **Строки**: 39–46
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE (soft delete): uploader или meetings.manage
CREATE POLICY "meeting_artifacts_update" ON meeting_artifacts
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR has_permission(auth.uid(), 'meetings.manage')
  );
```

#### Блок 2

- **Строки**: 47–50
- **Тип операции**: `INSERT`
- **Целевые таблицы**: storage
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-artifacts', 'meeting-artifacts', false);
```

---

### `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_status_current
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `15f16559-c295-47a9-9877-c30ab956886d` | meeting | meeting_id | yes |

```sql
-- Delete meeting_status_current first (FK), then the meeting itself (CASCADE will handle it too)
DELETE FROM meeting_status_current WHERE meeting_id = '15f16559-c295-47a9-9877-c30ab956886d';
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `15f16559-c295-47a9-9877-c30ab956886d` | meeting | id | yes |

```sql
DELETE FROM one_on_one_meetings WHERE id = '15f16559-c295-47a9-9877-c30ab956886d';
```

---

### `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql`

#### Блок 1

- **Строки**: 1–1
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `de7327f3-0e0a-4a5c-b6a3-210374eca07c` | task | id | yes |

```sql
DELETE FROM tasks WHERE id = 'de7327f3-0e0a-4a5c-b6a3-210374eca07c';
```

---

### `supabase/migrations/20260226100739_2757541c-9eac-4d57-bde9-ec883f28b62f.sql`

#### Блок 1

- **Строки**: 1–6
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id
FROM permissions p
WHERE p.name = 'meetings.manage'
ON CONFLICT DO NOTHING;
```

---

### `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_artifacts
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `8d2b400c-bcc3-4fc0-888a-eafa326e407b` | unknown | unknown | no |
| `70b5ab84-e1d8-4339-a2e2-d20124509d5c` | unknown | unknown | no |

```sql
-- Delete meeting-related data for Tkachenko meetings
DELETE FROM meeting_artifacts WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 2

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_decisions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `8d2b400c-bcc3-4fc0-888a-eafa326e407b` | unknown | unknown | no |
| `70b5ab84-e1d8-4339-a2e2-d20124509d5c` | unknown | unknown | no |

```sql
DELETE FROM meeting_decisions WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 3

- **Строки**: 5–5
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_private_notes
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `8d2b400c-bcc3-4fc0-888a-eafa326e407b` | unknown | unknown | no |
| `70b5ab84-e1d8-4339-a2e2-d20124509d5c` | unknown | unknown | no |

```sql
DELETE FROM meeting_private_notes WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 4

- **Строки**: 6–6
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_status_current
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `8d2b400c-bcc3-4fc0-888a-eafa326e407b` | unknown | unknown | no |
| `70b5ab84-e1d8-4339-a2e2-d20124509d5c` | unknown | unknown | no |

```sql
DELETE FROM meeting_status_current WHERE meeting_id IN ('70b5ab84-e1d8-4339-a2e2-d20124509d5c', '8d2b400c-bcc3-4fc0-888a-eafa326e407b');
```

#### Блок 5

- **Строки**: 7–7
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `695aa5cc-c402-43a0-bdea-1ca505a34392` | user | employee_id | yes |

```sql
DELETE FROM one_on_one_meetings WHERE employee_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
```

#### Блок 6

- **Строки**: 8–8
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `695aa5cc-c402-43a0-bdea-1ca505a34392` | user | user_id | yes |

```sql
DELETE FROM tasks WHERE user_id = '695aa5cc-c402-43a0-bdea-1ca505a34392';
```

---

### `supabase/migrations/20260303112500_8b556042-53f6-45c4-83b8-fc792e6b4cdc.sql`

#### Блок 1

- **Строки**: 29–32
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, open
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "Admins can update open questions"
  ON open_questions FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'diagnostics.manage'));
```

#### Блок 2

- **Строки**: 76–90
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, own
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- RLS UPDATE: evaluator with assignment validation
CREATE POLICY "Evaluator can update own results"
  ON open_question_results FOR UPDATE TO authenticated
  USING (evaluating_user_id = auth.uid())
  WITH CHECK (
    evaluating_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM survey_360_assignments a
      WHERE a.id = assignment_id
        AND a.evaluating_user_id = auth.uid()
        AND a.evaluated_user_id = evaluated_user_id
        AND a.diagnostic_stage_id = diagnostic_stage_id
    )
  );
```

---

### `supabase/migrations/20260306084811_cf24a8a7-def4-44fb-978b-28c8a03670d3.sql`

#### Блок 1

- **Строки**: 1–16
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- DEV-ONLY DATA FIX: Merge 50 duplicate answer_categories pairs
-- Strategy: keep oldest (complete) record, reassign refs from fragment, delete fragment

-- Step 1: Reassign hard_skill_questions from fragment to keeper
WITH dups AS (
  SELECT name, question_type,
    (array_agg(id ORDER BY created_at))[1] as keep_id,
    (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
UPDATE hard_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 2

- **Строки**: 17–30
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_questions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Step 2: Reassign soft_skill_questions from fragment to keeper
WITH dups AS (
  SELECT name, question_type,
    (array_agg(id ORDER BY created_at))[1] as keep_id,
    (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
UPDATE soft_skill_questions q
SET answer_category_id = d.keep_id
FROM dups d
WHERE q.answer_category_id = d.delete_id;
```

#### Блок 3

- **Строки**: 31–40
- **Тип операции**: `DELETE`
- **Целевые таблицы**: hard_skill_answer_options
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Step 3: Delete fragment answer_options (hard)
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM hard_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 4

- **Строки**: 41–50
- **Тип операции**: `DELETE`
- **Целевые таблицы**: soft_skill_answer_options
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Step 4: Delete fragment answer_options (soft)
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM soft_skill_answer_options
WHERE answer_category_id IN (SELECT delete_id FROM dups);
```

#### Блок 5

- **Строки**: 51–60
- **Тип операции**: `DELETE`
- **Целевые таблицы**: answer_categories
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Step 5: Delete fragment answer_categories
WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2] as delete_id
  FROM answer_categories
  GROUP BY name, question_type
  HAVING COUNT(*) > 1
)
DELETE FROM answer_categories
WHERE id IN (SELECT delete_id FROM dups);
```

---

### `supabase/migrations/20260306123737_da07a622-834f-49ea-b044-b1836ef8a5e0.sql`

#### Блок 1

- **Строки**: 19–23
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- UPDATE: только с правами управления диагностикой
CREATE POLICY "employee_stage_snapshots_modify"
ON employee_stage_snapshots FOR UPDATE TO authenticated
USING (has_permission(auth.uid(), 'diagnostics.manage'));
```

---

### `supabase/migrations/20260311084426_9dd27ba7-f01d-43eb-a3cb-a21e80b5c64e.sql`

#### Блок 1

- **Строки**: 73–146
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: freeze
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Update freeze trigger to include johari_rules in frozen_config
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.freeze_template_config_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- IMMUTABILITY GUARD
  IF OLD.frozen_config IS NOT NULL
     AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
    RAISE EXCEPTION 'frozen_config is immutable once set';
  END IF;

  -- FREEZE on first activation with a template
  IF NEW.status = 'active'
     AND (OLD.status IS DISTINCT FROM 'active')
     AND NEW.config_template_id IS NOT NULL
     AND NEW.frozen_config IS NULL
  THEN
    SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
    END IF;
    IF tpl.status != 'approved' THEN
      RAISE EXCEPTION 'Template must be approved before stage activation';
    END IF;

    -- Collect hard labels sorted, filtered by range
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO hard_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'hard'
      AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

    -- Collect soft labels sorted, filtered by range
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
      ORDER BY l.level_value
    ), '[]'::jsonb)
    INTO soft_labels
    FROM template_scale_labels l
    WHERE l.template_id = tpl.id
      AND l.skill_type = 'soft'
      AND l.level_value BETWEEN tpl.soft_scale_min AND tpl.soft_scale_max;

    NEW.frozen_config := jsonb_build_object(
      'template_id', tpl.id,
      'template_name', tpl.name,
      'template_version', tpl.version,
      'hard_scale_min', tpl.hard_scale_min,
      'hard_scale_max', tpl.hard_scale_max,
      'soft_scale_min', tpl.soft_scale_min,
      'soft_scale_max', tpl.soft_scale_max,
      'hard_scale_reversed', tpl.hard_scale_reversed,
      'soft_scale_reversed', tpl.soft_scale_reversed,
      'hard_skills_enabled', tpl.hard_skills_enabled,
      'scale_labels', jsonb_build_object('hard', hard_labels, 'soft', soft_labels),
      'comment_rules', tpl.comment_rules,
      'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb),
      'johari_rules', tpl.johari_rules
    );
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20260312092210_125aa66b-1642-451f-afce-9d19f63dfdcf.sql`

#### Блок 1

- **Строки**: 1–5
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: storage
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create private backups bucket (replace public sprint-images usage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;
```

---

### `supabase/migrations/20260312133209_9ee1a940-3dd3-4efd-a155-2284f3ed8be3.sql`

#### Блок 1

- **Строки**: 9–89
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: CREATE, path
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2. New freeze trigger: BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION public.freeze_template_config_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- === INSERT path: snapshot approved template into frozen_config ===
  IF TG_OP = 'INSERT' THEN
    IF NEW.config_template_id IS NOT NULL THEN
      SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
      END IF;
      IF tpl.status != 'approved' THEN
        RAISE EXCEPTION 'Template must be approved before stage creation';
      END IF;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
        ORDER BY l.level_value
      ), '[]'::jsonb)
      INTO hard_labels
      FROM template_scale_labels l
      WHERE l.template_id = tpl.id
        AND l.skill_type = 'hard'
        AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
        ORDER BY l.level_value
      ), '[]'::jsonb)
      INTO soft_labels
      FROM template_scale_labels l
      WHERE l.template_id = tpl.id
        AND l.skill_type = 'soft'
        AND l.level_value BETWEEN tpl.soft_scale_min AND tpl.soft_scale_max;

      NEW.frozen_config := jsonb_build_object(
        'template_id', tpl.id,
        'template_name', tpl.name,
        'template_version', tpl.version,
        'hard_scale_min', tpl.hard_scale_min,
        'hard_scale_max', tpl.hard_scale_max,
        'soft_scale_min', tpl.soft_scale_min,
        'soft_scale_max', tpl.soft_scale_max,
        'hard_scale_reversed', tpl.hard_scale_reversed,
        'soft_scale_reversed', tpl.soft_scale_reversed,
        'hard_skills_enabled', tpl.hard_skills_enabled,
        'scale_labels', jsonb_build_object('hard', hard_labels, 'soft', soft_labels),
        'comment_rules', tpl.comment_rules,
        'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb),
        'johari_rules', tpl.johari_rules
      );
    END IF;
    -- If config_template_id IS NULL → legacy stage, frozen_config stays NULL
    RETURN NEW;
  END IF;

  -- === UPDATE path: immutability guards ===
  IF TG_OP = 'UPDATE' THEN
    -- Guard 1: frozen_config is immutable once set
    IF OLD.frozen_config IS NOT NULL
       AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
      RAISE EXCEPTION 'frozen_config is immutable once set';
    END IF;

    -- Guard 2: config_template_id is immutable once set
    IF OLD.config_template_id IS NOT NULL
       AND NEW.config_template_id IS DISTINCT FROM OLD.config_template_id THEN
      RAISE EXCEPTION 'config_template_id is immutable once set';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20260312140513_678e9ef6-7b95-44be-9874-ad31d05f7c86.sql`

#### Блок 1

- **Строки**: 1–99
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: IF, path
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Block 1: Tighten legacy/template contract on diagnostic_stages
-- Replace the freeze trigger to:
-- 1. On INSERT: reject caller-supplied frozen_config (must be NULL from caller)
-- 2. On UPDATE: block ANY change to config_template_id (not just when OLD is NOT NULL)
-- 3. Preserve existing immutability of frozen_config

CREATE OR REPLACE FUNCTION public.freeze_template_config_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl RECORD;
  hard_labels jsonb;
  soft_labels jsonb;
BEGIN
  -- === INSERT path ===
  IF TG_OP = 'INSERT' THEN
    -- Guard: caller must NOT supply frozen_config — it is always built server-side
    IF NEW.frozen_config IS NOT NULL THEN
      RAISE EXCEPTION 'frozen_config must not be supplied on INSERT; it is built automatically from the template';
    END IF;

    IF NEW.config_template_id IS NOT NULL THEN
      SELECT * INTO tpl FROM diagnostic_config_templates WHERE id = NEW.config_template_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', NEW.config_template_id;
      END IF;
      IF tpl.status != 'approved' THEN
        RAISE EXCEPTION 'Template must be approved before stage creation';
      END IF;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
        ORDER BY l.level_value
      ), '[]'::jsonb)
      INTO hard_labels
      FROM template_scale_labels l
      WHERE l.template_id = tpl.id
        AND l.skill_type = 'hard'
        AND l.level_value BETWEEN tpl.hard_scale_min AND tpl.hard_scale_max;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('level_value', l.level_value, 'label_text', l.label_text)
        ORDER BY l.level_value
      ), '[]'::jsonb)
      INTO soft_labels
      FROM template_scale_labels l
      WHERE l.template_id = tpl.id
        AND l.skill_type = 'soft'
        AND l.level_value BETWEEN tpl.soft_scale_min AND tpl.soft_scale_max;

      NEW.frozen_config := jsonb_build_object(
        'template_id', tpl.id,
        'template_name', tpl.name,
        'template_version', tpl.version,
        'hard_scale_min', tpl.hard_scale_min,
        'hard_scale_max', tpl.hard_scale_max,
        'soft_scale_min', tpl.soft_scale_min,
        'soft_scale_max', tpl.soft_scale_max,
        'hard_scale_reversed', tpl.hard_scale_reversed,
        'soft_scale_reversed', tpl.soft_scale_reversed,
        'hard_skills_enabled', tpl.hard_skills_enabled,
        'scale_labels', jsonb_build_object('hard', hard_labels, 'soft', soft_labels),
        'comment_rules', tpl.comment_rules,
        'open_questions', COALESCE(tpl.open_questions_config, '[]'::jsonb),
        'johari_rules', tpl.johari_rules
      );
    END IF;
    -- If config_template_id IS NULL → legacy stage, frozen_config stays NULL
    RETURN NEW;
  END IF;

  -- === UPDATE path ===
  IF TG_OP = 'UPDATE' THEN
    -- Guard 1: frozen_config is immutable once set
    IF OLD.frozen_config IS NOT NULL
       AND NEW.frozen_config IS DISTINCT FROM OLD.frozen_config THEN
      RAISE EXCEPTION 'frozen_config is immutable once set';
    END IF;

    -- Guard 2: config_template_id is immutable ALWAYS (legacy stays legacy, template stays template)
    IF NEW.config_template_id IS DISTINCT FROM OLD.config_template_id THEN
      RAISE EXCEPTION 'config_template_id is immutable after stage creation';
    END IF;

    -- Guard 3: legacy stage cannot acquire frozen_config via UPDATE
    IF OLD.frozen_config IS NULL AND NEW.frozen_config IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot set frozen_config on a legacy stage';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql`

#### Блок 1

- **Строки**: 1–7
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `1f0bfe3f-8e6a-4578-be45-fe1337314a4b` | task | id | yes |

```sql
-- Data fix: restore peer_selection task for Yurasova that was incorrectly completed
UPDATE tasks 
SET status = 'pending', updated_at = now()
WHERE id = '1f0bfe3f-8e6a-4578-be45-fe1337314a4b'
  AND task_type = 'peer_selection'
  AND status = 'completed';
```

---

### `supabase/migrations/20260316123534_1432d470-f937-49c9-9db0-a8f3d7739c04.sql`

#### Блок 1

- **Строки**: 321–343
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: diagnostic_snapshot_jobs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- ============================================================
-- Wave 2: Trigger + Orchestration Functions
-- ============================================================

-- 2.1 Enqueue trigger function
CREATE OR REPLACE FUNCTION public.enqueue_diagnostic_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.diagnostic_stage_id IS NOT NULL THEN
      INSERT INTO diagnostic_snapshot_jobs (stage_id, evaluated_user_id, reason)
      VALUES (NEW.diagnostic_stage_id, NEW.evaluated_user_id, 'assignment_completed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

#### Блок 2

- **Строки**: 349–581
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: answer_category_snapshots, diagnostic_result_snapshots, diagnostic_user_snapshots, grade_quality_snapshots, grade_skill_snapshots, hard_skill_answer_option_snapshots, hard_skill_category_snapshots, hard_skill_question_snapshots, hard_skill_snapshots, hard_skill_subcategory_snapshots, soft_skill_answer_option_snapshots, soft_skill_category_snapshots, soft_skill_question_snapshots, soft_skill_snapshots, soft_skill_subcategory_snapshots, survey_assignment_snapshots
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2.2 Orchestration function
CREATE OR REPLACE FUNCTION public.create_or_refresh_diagnostic_snapshot(
  p_stage_id uuid,
  p_evaluated_user_id uuid,
  p_reason text DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lock_key bigint;
  v_user RECORD;
  v_hash text;
  v_current_hash text;
  v_snapshot_id uuid;
  v_next_version integer;
  v_grade_id uuid;
BEGIN
  -- Advisory lock
  v_lock_key := hashtext(p_stage_id::text || p_evaluated_user_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get evaluated user info
  SELECT u.id, u.last_name, u.first_name, u.middle_name, u.grade_id,
         u.position_id, u.department_id,
         g.name AS grade_name,
         p.name AS position_name,
         d.name AS department_name,
         pc.name AS position_category_name
  INTO v_user
  FROM users u
  LEFT JOIN grades g ON g.id = u.grade_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN positions pos ON pos.id = u.position_id
  LEFT JOIN position_categories pc ON pc.id = pos.position_category_id
  WHERE u.id = p_evaluated_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_evaluated_user_id;
  END IF;

  v_grade_id := v_user.grade_id;

  -- Build hash from key data points
  SELECT md5(string_agg(sub.hash_part, '|' ORDER BY sub.ord))
  INTO v_hash
  FROM (
    -- User context
    SELECT 1 AS ord, concat_ws(',', v_user.last_name, v_user.first_name, v_user.grade_name, v_user.position_name, v_user.department_name) AS hash_part
    UNION ALL
    -- Grade skills
    SELECT 2, COALESCE(string_agg(concat_ws(',', gs.id::text, gs.skill_id::text, gs.target_level::text), ';' ORDER BY gs.skill_id), '')
    FROM grade_skills gs WHERE gs.grade_id = v_grade_id
    UNION ALL
    -- Grade qualities  
    SELECT 3, COALESCE(string_agg(concat_ws(',', gq.id::text, gq.quality_id::text, gq.target_level::text), ';' ORDER BY gq.quality_id), '')
    FROM grade_qualities gq WHERE gq.grade_id = v_grade_id
    UNION ALL
    -- Assignments
    SELECT 4, COALESCE(string_agg(concat_ws(',', sa.id::text, sa.assignment_type, sa.evaluating_user_id::text, sa.status), ';' ORDER BY sa.id), '')
    FROM survey_360_assignments sa
    WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id
    UNION ALL
    -- Hard skills (via grade_skills)
    SELECT 5, COALESCE(string_agg(concat_ws(',', hs.id::text, hs.name, hs.category_id::text, hs.sub_category_id::text), ';' ORDER BY hs.id), '')
    FROM hard_skills hs
    WHERE hs.id IN (SELECT gs2.skill_id FROM grade_skills gs2 WHERE gs2.grade_id = v_grade_id)
    UNION ALL
    -- Soft skills (via grade_qualities)
    SELECT 6, COALESCE(string_agg(concat_ws(',', ss.id::text, ss.name, ss.category_id::text, ss.sub_category_id::text), ';' ORDER BY ss.id), '')
    FROM soft_skills ss
    WHERE ss.id IN (SELECT gq2.quality_id FROM grade_qualities gq2 WHERE gq2.grade_id = v_grade_id)
    UNION ALL
    -- Hard answer options
    SELECT 7, COALESCE(string_agg(concat_ws(',', hao.id::text, hao.numeric_value::text, hao.title), ';' ORDER BY hao.id), '')
    FROM hard_skill_answer_options hao
    UNION ALL
    -- Soft answer options
    SELECT 8, COALESCE(string_agg(concat_ws(',', sao.id::text, sao.numeric_value::text, sao.title), ';' ORDER BY sao.id), '')
    FROM soft_skill_answer_options sao
  ) sub;

  -- Check current hash
  SELECT data_hash INTO v_current_hash
  FROM diagnostic_result_snapshots
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id AND is_current = true;

  IF v_current_hash = v_hash THEN
    RETURN; -- No changes
  END IF;

  -- Mark old as not current
  UPDATE diagnostic_result_snapshots
  SET is_current = false
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id AND is_current = true;

  -- Get next version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM diagnostic_result_snapshots
  WHERE stage_id = p_stage_id AND evaluated_user_id = p_evaluated_user_id;

  -- Create header
  INSERT INTO diagnostic_result_snapshots (stage_id, evaluated_user_id, version, is_current, data_hash, reason)
  VALUES (p_stage_id, p_evaluated_user_id, v_next_version, true, v_hash, p_reason)
  RETURNING id INTO v_snapshot_id;

  -- 1. diagnostic_user_snapshots: evaluated user + all evaluators
  INSERT INTO diagnostic_user_snapshots (diagnostic_id, entity_id, last_name, first_name, middle_name, grade_id, grade_name, position_name, department_name, position_category_name)
  SELECT v_snapshot_id, u.id, u.last_name, u.first_name, u.middle_name, u.grade_id,
         g.name, p.name, d.name, pc.name
  FROM users u
  LEFT JOIN grades g ON g.id = u.grade_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN position_categories pc ON pc.id = p.position_category_id
  WHERE u.id = p_evaluated_user_id
     OR u.id IN (SELECT sa.evaluating_user_id FROM survey_360_assignments sa WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 2. survey_assignment_snapshots
  INSERT INTO survey_assignment_snapshots (diagnostic_id, entity_id, evaluating_user_id, assignment_type, evaluator_last_name, evaluator_first_name, evaluator_position_category_name)
  SELECT v_snapshot_id, sa.id, sa.evaluating_user_id, sa.assignment_type,
         eu.last_name, eu.first_name, pc.name
  FROM survey_360_assignments sa
  LEFT JOIN users eu ON eu.id = sa.evaluating_user_id
  LEFT JOIN positions pos ON pos.id = eu.position_id
  LEFT JOIN position_categories pc ON pc.id = pos.position_category_id
  WHERE sa.diagnostic_stage_id = p_stage_id AND sa.evaluated_user_id = p_evaluated_user_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 3. answer_category_snapshots (all used categories)
  INSERT INTO answer_category_snapshots (diagnostic_id, entity_id, name, question_type, comment_required)
  SELECT DISTINCT v_snapshot_id, ac.id, ac.name, ac.question_type, ac.comment_required
  FROM answer_categories ac
  WHERE ac.id IN (
    SELECT DISTINCT hsq.answer_category_id FROM hard_skill_questions hsq WHERE hsq.answer_category_id IS NOT NULL
    UNION
    SELECT DISTINCT ssq.answer_category_id FROM soft_skill_questions ssq WHERE ssq.answer_category_id IS NOT NULL
  )
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 4. grade_skill_snapshots
  INSERT INTO grade_skill_snapshots (diagnostic_id, entity_id, skill_id, grade_id, target_level)
  SELECT v_snapshot_id, gs.id, gs.skill_id, gs.grade_id, gs.target_level
  FROM grade_skills gs WHERE gs.grade_id = v_grade_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 5. grade_quality_snapshots
  INSERT INTO grade_quality_snapshots (diagnostic_id, entity_id, quality_id, grade_id, target_level)
  SELECT v_snapshot_id, gq.id, gq.quality_id, gq.grade_id, gq.target_level
  FROM grade_qualities gq WHERE gq.grade_id = v_grade_id
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 6. hard_skill_category_snapshots
  INSERT INTO hard_skill_category_snapshots (diagnostic_id, entity_id, name, description)
  SELECT DISTINCT v_snapshot_id, chs.id, chs.name, chs.description
  FROM category_hard_skills chs
  WHERE chs.id IN (SELECT hs.category_id FROM hard_skills hs WHERE hs.id IN (SELECT gs3.skill_id FROM grade_skills gs3 WHERE gs3.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 7. hard_skill_subcategory_snapshots
  INSERT INTO hard_skill_subcategory_snapshots (diagnostic_id, entity_id, name, category_id, category_name)
  SELECT DISTINCT v_snapshot_id, schs.id, schs.name, schs.category_hard_skill_id, chs2.name
  FROM sub_category_hard_skills schs
  LEFT JOIN category_hard_skills chs2 ON chs2.id = schs.category_hard_skill_id
  WHERE schs.id IN (SELECT hs2.sub_category_id FROM hard_skills hs2 WHERE hs2.id IN (SELECT gs4.skill_id FROM grade_skills gs4 WHERE gs4.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 8. hard_skill_snapshots
  INSERT INTO hard_skill_snapshots (diagnostic_id, entity_id, name, description, category_id, category_name, sub_category_id, subcategory_name)
  SELECT v_snapshot_id, hs.id, hs.name, hs.description, hs.category_id, chs3.name, hs.sub_category_id, schs2.name
  FROM hard_skills hs
  LEFT JOIN category_hard_skills chs3 ON chs3.id = hs.category_id
  LEFT JOIN sub_category_hard_skills schs2 ON schs2.id = hs.sub_category_id
  WHERE hs.id IN (SELECT gs5.skill_id FROM grade_skills gs5 WHERE gs5.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 9. hard_skill_question_snapshots
  INSERT INTO hard_skill_question_snapshots (diagnostic_id, entity_id, question_text, skill_id, answer_category_id, order_index, comment_required_override, visibility_restriction_enabled, visibility_restriction_type)
  SELECT v_snapshot_id, hsq.id, hsq.question_text, hsq.skill_id, hsq.answer_category_id, hsq.order_index, hsq.comment_required_override, hsq.visibility_restriction_enabled, hsq.visibility_restriction_type
  FROM hard_skill_questions hsq
  WHERE hsq.skill_id IN (SELECT gs6.skill_id FROM grade_skills gs6 WHERE gs6.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 10. hard_skill_answer_option_snapshots (all options for relevant categories)
  INSERT INTO hard_skill_answer_option_snapshots (diagnostic_id, entity_id, answer_category_id, numeric_value, level_value, title, description, order_index)
  SELECT v_snapshot_id, hao.id, hao.answer_category_id, hao.numeric_value, hao.level_value, hao.title, hao.description, hao.order_index
  FROM hard_skill_answer_options hao
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 11. soft_skill_category_snapshots
  INSERT INTO soft_skill_category_snapshots (diagnostic_id, entity_id, name, description)
  SELECT DISTINCT v_snapshot_id, css.id, css.name, css.description
  FROM category_soft_skills css
  WHERE css.id IN (SELECT ss2.category_id FROM soft_skills ss2 WHERE ss2.id IN (SELECT gq3.quality_id FROM grade_qualities gq3 WHERE gq3.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 12. soft_skill_subcategory_snapshots
  INSERT INTO soft_skill_subcategory_snapshots (diagnostic_id, entity_id, name, category_id, category_name)
  SELECT DISTINCT v_snapshot_id, scss.id, scss.name, scss.category_soft_skill_id, css2.name
  FROM sub_category_soft_skills scss
  LEFT JOIN category_soft_skills css2 ON css2.id = scss.category_soft_skill_id
  WHERE scss.id IN (SELECT ss3.sub_category_id FROM soft_skills ss3 WHERE ss3.id IN (SELECT gq4.quality_id FROM grade_qualities gq4 WHERE gq4.grade_id = v_grade_id))
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 13. soft_skill_snapshots
  INSERT INTO soft_skill_snapshots (diagnostic_id, entity_id, name, description, category_id, category_name, sub_category_id, subcategory_name)
  SELECT v_snapshot_id, ss.id, ss.name, ss.description, ss.category_id, css3.name, ss.sub_category_id, scss2.name
  FROM soft_skills ss
  LEFT JOIN category_soft_skills css3 ON css3.id = ss.category_id
  LEFT JOIN sub_category_soft_skills scss2 ON scss2.id = ss.sub_category_id
  WHERE ss.id IN (SELECT gq5.quality_id FROM grade_qualities gq5 WHERE gq5.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 14. soft_skill_question_snapshots
  INSERT INTO soft_skill_question_snapshots (diagnostic_id, entity_id, question_text, quality_id, answer_category_id, category, order_index, behavioral_indicators, comment_required_override, visibility_restriction_enabled, visibility_restriction_type)
  SELECT v_snapshot_id, ssq.id, ssq.question_text, ssq.quality_id, ssq.answer_category_id, ssq.category, ssq.order_index, ssq.behavioral_indicators, ssq.comment_required_override, ssq.visibility_restriction_enabled, ssq.visibility_restriction_type
  FROM soft_skill_questions ssq
  WHERE ssq.quality_id IN (SELECT gq6.quality_id FROM grade_qualities gq6 WHERE gq6.grade_id = v_grade_id)
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

  -- 15. soft_skill_answer_option_snapshots (all options)
  INSERT INTO soft_skill_answer_option_snapshots (diagnostic_id, entity_id, answer_category_id, numeric_value, level_value, title, description, order_index)
  SELECT v_snapshot_id, sao.id, sao.answer_category_id, sao.numeric_value, sao.level_value, sao.title, sao.description, sao.order_index
  FROM soft_skill_answer_options sao
  ON CONFLICT (diagnostic_id, entity_id) DO NOTHING;

END;
$$;
```

#### Блок 3

- **Строки**: 582–607
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: diagnostic_snapshot_jobs
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 2.3 Process job function
CREATE OR REPLACE FUNCTION public.process_diagnostic_snapshot_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM diagnostic_snapshot_jobs WHERE id = p_job_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE diagnostic_snapshot_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = p_job_id;

  BEGIN
    PERFORM create_or_refresh_diagnostic_snapshot(v_job.stage_id, v_job.evaluated_user_id, v_job.reason);
    UPDATE diagnostic_snapshot_jobs SET status = 'done', processed_at = now() WHERE id = p_job_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE diagnostic_snapshot_jobs SET status = 'error', last_error = SQLERRM WHERE id = p_job_id;
  END;
END;
$$;
```

---

### `supabase/migrations/20260316133648_b124982e-9a31-493d-87c1-30546edaa1f0.sql`

#### Блок 1

- **Строки**: 1–7
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: soft_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Backfill null raw_numeric_value from answer_option_id for soft_skill_results
UPDATE soft_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM soft_skill_answer_options WHERE id = soft_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;
```

#### Блок 2

- **Строки**: 8–15
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: hard_skill_results
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Backfill null raw_numeric_value from answer_option_id for hard_skill_results
UPDATE hard_skill_results 
SET raw_numeric_value = (
  SELECT numeric_value FROM hard_skill_answer_options WHERE id = hard_skill_results.answer_option_id
)
WHERE raw_numeric_value IS NULL 
  AND answer_option_id IS NOT NULL;
```

---

### `supabase/migrations/20260318115441_b93cde62-baed-4d56-b283-6c070945db39.sql`

#### Блок 1

- **Строки**: 46–52
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: OF
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Attach trigger
CREATE TRIGGER trg_prevent_manager_cycle
  BEFORE INSERT OR UPDATE OF manager_id
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_manager_cycle();
```

---

### `supabase/migrations/20260318115506_7fc8678b-c694-4477-a5cd-fe321c48ba35.sql`

#### Блок 1

- **Строки**: 1–6
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: policies
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Step 3: RLS SELECT policy updates — add subtree visibility
-- No UPDATE policies are changed — direct-only stays for writes

-- 1. users SELECT: add subtree visibility
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
```

---

### `supabase/migrations/20260318115533_3fc1ddbf-24aa-4169-9da3-efee85371b89.sql`

#### Блок 1

- **Строки**: 1–33
- **Тип операции**: `OTHER`
- **Целевые таблицы**: N/A
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000000` | user | unknown | yes |

```sql
-- Step 4: Exclude evaluated user's immediate manager from peer selection
CREATE OR REPLACE FUNCTION public.get_users_for_peer_selection(_current_user_id uuid)
RETURNS TABLE (
  id uuid,
  last_name text,
  first_name text,
  middle_name text,
  department_id uuid,
  position_id uuid,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.last_name,
    u.first_name,
    u.middle_name,
    u.department_id,
    u.position_id,
    u.email
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.status = true
    AND u.id != _current_user_id
    AND u.id != COALESCE((SELECT manager_id FROM users WHERE id = _current_user_id), '00000000-0000-0000-0000-000000000000'::uuid)
    AND ur.role IN ('employee', 'manager')
  ORDER BY u.last_name, u.first_name;
$$;
```

---

### `supabase/migrations/20260318135151_670a1483-74e6-4c35-bc30-60d3e3d5d6e1.sql`

#### Блок 1

- **Строки**: 41–46
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO, for
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- RLS: UPDATE for meeting's manager only
CREATE POLICY "mmf_update" ON public.meeting_manager_fields FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.one_on_one_meetings m WHERE m.id = meeting_id AND m.manager_id = auth.uid())
  );
```

#### Блок 2

- **Строки**: 60–93
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: timestamp
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `00000000-0000-0000-0000-000000000000` | meeting | unknown | yes |

```sql
-- 5. Combined compute_meeting_status + duplicate check trigger function
CREATE OR REPLACE FUNCTION public.compute_meeting_status_and_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Step 1: Recompute status
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != '' THEN
    NEW.status := 'recorded';
  ELSIF NEW.meeting_date IS NOT NULL AND NEW.meeting_date <= now() THEN
    NEW.status := 'awaiting_summary';
  ELSE
    NEW.status := 'scheduled';
  END IF;

  -- Step 2: Validate no duplicate future scheduled meeting for this pair
  IF NEW.status = 'scheduled' THEN
    IF EXISTS (
      SELECT 1 FROM public.one_on_one_meetings
      WHERE employee_id = NEW.employee_id
        AND manager_id = NEW.manager_id
        AND status = 'scheduled'
        AND meeting_date > now()
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'У этой пары уже есть запланированная встреча в будущем';
    END IF;
  END IF;

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 98–125
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: protect_meeting_employee_fields
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 6. Update protect_meeting_employee_fields to include new employee fields
CREATE OR REPLACE FUNCTION public.protect_meeting_employee_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_employee boolean;
BEGIN
  is_employee := (current_user_id = NEW.employee_id);
  IF is_employee THEN
    RETURN NEW;
  END IF;

  -- For non-employees: revert employee-only fields to old values
  NEW.energy_gained := OLD.energy_gained;
  NEW.energy_lost := OLD.energy_lost;
  NEW.previous_decisions_debrief := OLD.previous_decisions_debrief;
  NEW.stoppers := OLD.stoppers;
  NEW.ideas_and_suggestions := OLD.ideas_and_suggestions;
  NEW.emp_mood := OLD.emp_mood;
  NEW.emp_successes := OLD.emp_successes;
  NEW.emp_problems := OLD.emp_problems;
  NEW.emp_news := OLD.emp_news;
  NEW.emp_questions := OLD.emp_questions;

  RETURN NEW;
END;
$$;
```

#### Блок 4

- **Строки**: 126–145
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 7. Create meeting_scheduled task on INSERT
CREATE OR REPLACE FUNCTION public.create_meeting_scheduled_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Create task for both employee and manager
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  VALUES
    (NEW.employee_id, NEW.id::text,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1'),
    (NEW.manager_id, NEW.id::text,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1');

  RETURN NEW;
END;
$$;
```

#### Блок 5

- **Строки**: 150–184
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 8. Create meeting_review_summary task on summary save
CREATE OR REPLACE FUNCTION public.create_meeting_review_summary_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    -- Determine target: the OTHER party
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    -- Deduplication
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE assignment_id = NEW.id::text
        AND task_type = 'meeting_review_summary'
        AND user_id = target_user_id
        AND status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (target_user_id, NEW.id::text,
              'Ознакомьтесь с итогом встречи 1:1',
              'Ваш коллега зафиксировал итоги встречи',
              'pending', 'meeting_review_summary', 'Встречи 1:1');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

#### Блок 6

- **Строки**: 189–191
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: check_task_type
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 9. Update check_task_type constraint to add new types
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;
```

#### Блок 7

- **Строки**: 199–212
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: one_on_one_meetings, trigger
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 10. Process meeting status for cron (time-based transitions)
CREATE OR REPLACE FUNCTION public.process_meeting_status()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Touch meetings that should transition from scheduled to awaiting_summary
  -- The BEFORE UPDATE trigger will recompute the status
  UPDATE public.one_on_one_meetings
  SET updated_at = now()
  WHERE status = 'scheduled'
    AND meeting_date IS NOT NULL
    AND meeting_date <= now();
END;
$$;
```

#### Блок 8

- **Строки**: 213–312
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 11. Process meeting tasks for cron
-- Creates meeting_fill_summary tasks when meetings transition to awaiting_summary
-- Creates meeting_plan_new tasks for pairs without a scheduled meeting
CREATE OR REPLACE FUNCTION public.process_meeting_tasks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Create meeting_fill_summary tasks for awaiting_summary meetings without one
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.employee_id, m.id::text,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id::text
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = m.employee_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Also for manager
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.manager_id, m.id::text,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id::text
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = m.manager_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Close meeting_scheduled tasks when meeting is no longer scheduled
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_scheduled'
    AND status IN ('pending', 'in_progress')
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id::text = tasks.assignment_id
        AND m.status = 'scheduled'
    );

  -- Close meeting_fill_summary tasks when meeting becomes recorded
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_fill_summary'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id::text = tasks.assignment_id
        AND m.status = 'recorded'
    );

  -- Create meeting_plan_new tasks for active employee-manager pairs without a future scheduled meeting
  -- Only for pairs where the last recorded meeting is older than 35 days
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT u.id, u.id::text,
         'Запланируйте встречу 1:1',
         'Прошло более 35 дней с последней встречи',
         'pending', 'meeting_plan_new', 'Встречи 1:1'
  FROM public.users u
  WHERE u.status = true
    AND u.manager_id IS NOT NULL
    -- No active scheduled meeting
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id
        AND m.manager_id = u.manager_id
        AND m.status IN ('scheduled', 'awaiting_summary')
    )
    -- Last recorded meeting older than 35 days (or no recorded meeting at all)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.one_on_one_meetings m
        WHERE m.employee_id = u.id AND m.manager_id = u.manager_id AND m.status = 'recorded'
      )
      OR (
        SELECT MAX(COALESCE(m.meeting_date, m.updated_at))
        FROM public.one_on_one_meetings m
        WHERE m.employee_id = u.id AND m.manager_id = u.manager_id AND m.status = 'recorded'
      ) < now() - interval '35 days'
    )
    -- No existing active task
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id::text
        AND t.task_type = 'meeting_plan_new'
        AND t.user_id = u.id
        AND t.status IN ('pending', 'in_progress')
    );
END;
$$;
```

#### Блок 9

- **Строки**: 313–317
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: ON
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- 12. updated_at trigger for meeting_manager_fields
CREATE TRIGGER update_meeting_manager_fields_updated_at
  BEFORE UPDATE ON public.meeting_manager_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

### `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql`

#### Блок 1

- **Строки**: 1–2
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_decisions
- **Классификация**: `dev_only_seed_or_cleanup`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92` | unknown | unknown | no |
| `f2c27675-6a98-4918-bd9c-ad3d1af1d84b` | unknown | unknown | no |

```sql
-- Delete related data for Yurasova's meetings, then the meetings themselves
DELETE FROM meeting_decisions WHERE meeting_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

#### Блок 2

- **Строки**: 3–3
- **Тип операции**: `DELETE`
- **Целевые таблицы**: tasks
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92` | task | unknown | yes |
| `f2c27675-6a98-4918-bd9c-ad3d1af1d84b` | task | unknown | yes |

```sql
DELETE FROM tasks WHERE assignment_id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

#### Блок 3

- **Строки**: 4–4
- **Тип операции**: `DELETE`
- **Целевые таблицы**: one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | yes |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92` | meeting | unknown | yes |
| `f2c27675-6a98-4918-bd9c-ad3d1af1d84b` | meeting | unknown | yes |

```sql
DELETE FROM one_on_one_meetings WHERE id IN ('f2c27675-6a98-4918-bd9c-ad3d1af1d84b', '2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92');
```

---

### `supabase/migrations/20260318145721_012d33de-07a6-4bf9-ba98-0c46a38329c8.sql`

#### Блок 1

- **Строки**: 1–89
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix process_meeting_tasks: 
-- 1. meeting_plan_new → assign to MANAGER, not employee
-- 2. Only for employees who already have at least 1 meeting (cycle started)
-- 3. Exclude external employees (position_category contains 'внешн')
-- 4. Remove ::text casts - assignment_id is uuid
CREATE OR REPLACE FUNCTION process_meeting_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create meeting_fill_summary tasks for awaiting_summary meetings (for manager only)
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.manager_id, m.id,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = m.manager_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Close meeting_scheduled tasks when meeting is no longer scheduled
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_scheduled'
    AND status IN ('pending', 'in_progress')
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = tasks.assignment_id
        AND m.status = 'scheduled'
    );

  -- Close meeting_fill_summary tasks when meeting becomes recorded
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_fill_summary'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = tasks.assignment_id
        AND m.status = 'recorded'
    );

  -- meeting_plan_new: assigned to MANAGER, only for internal employees with cycle started
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT u.manager_id, u.id,
         'Запланируйте встречу 1:1',
         'Прошло более 35 дней с последней встречи с ' || COALESCE(u.last_name || ' ' || u.first_name, 'сотрудником'),
         'pending', 'meeting_plan_new', 'Встречи 1:1'
  FROM public.users u
  JOIN public.positions p ON u.position_id = p.id
  JOIN public.position_categories pc ON p.position_category_id = pc.id
  WHERE u.status = true
    AND u.manager_id IS NOT NULL
    AND pc.name NOT ILIKE '%внешн%'
    -- Cycle must be started (at least 1 meeting exists)
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m WHERE m.employee_id = u.id
    )
    -- No active scheduled or awaiting_summary meeting
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id
        AND m.status IN ('scheduled', 'awaiting_summary')
    )
    -- Last recorded meeting older than 35 days
    AND (
      SELECT MAX(COALESCE(m.meeting_date, m.updated_at))
      FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id AND m.status = 'recorded'
    ) < now() - interval '35 days'
    -- No existing active task
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id
        AND t.task_type = 'meeting_plan_new'
        AND t.user_id = u.manager_id
        AND t.status IN ('pending', 'in_progress')
    );
END;
$$;
```

#### Блок 2

- **Строки**: 90–111
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Also fix create_meeting_scheduled_task trigger to remove unnecessary ::text casts
CREATE OR REPLACE FUNCTION create_meeting_scheduled_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  VALUES
    (NEW.employee_id, NEW.id,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1'),
    (NEW.manager_id, NEW.id,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1');
  RETURN NEW;
END;
$$;
```

#### Блок 3

- **Строки**: 112–148
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Fix create_meeting_review_summary_task to remove ::text casts
CREATE OR REPLACE FUNCTION create_meeting_review_summary_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE assignment_id = NEW.id
        AND task_type = 'meeting_review_summary'
        AND user_id = target_user_id
        AND status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (target_user_id, NEW.id,
              'Ознакомьтесь с итогом встречи 1:1',
              'Ваш коллега зафиксировал итоги встречи',
              'pending', 'meeting_review_summary', 'Встречи 1:1');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### `supabase/migrations/20260319142425_b7d0673b-e2c8-49ca-80d6-1de503e8dd6f.sql`

#### Блок 1

- **Строки**: 1–98
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Idempotent task synchronization on meeting status change
CREATE OR REPLACE FUNCTION public.sync_meeting_tasks_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ===== TRANSITION TO scheduled =====
  IF NEW.status = 'scheduled' THEN
    -- Close active meeting_fill_summary tasks for this meeting
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_fill_summary'
      AND status IN ('pending', 'in_progress');

    -- Ensure meeting_scheduled tasks exist for both participants (no duplicates)
    INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
    SELECT uid, NEW.id,
           'Запланирована встреча 1:1',
           'У вас запланирована встреча 1:1',
           'pending', 'meeting_scheduled', 'Встречи 1:1'
    FROM unnest(ARRAY[NEW.employee_id, NEW.manager_id]) AS uid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = NEW.id
        AND t.task_type = 'meeting_scheduled'
        AND t.user_id = uid
        AND t.status IN ('pending', 'in_progress')
    );

    -- Close meeting_plan_new for this employee's manager (a meeting is now active)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.employee_id
      AND task_type = 'meeting_plan_new'
      AND status IN ('pending', 'in_progress');
  END IF;

  -- ===== TRANSITION TO awaiting_summary =====
  IF NEW.status = 'awaiting_summary' THEN
    -- Close active meeting_scheduled tasks for this meeting
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_scheduled'
      AND status IN ('pending', 'in_progress');

    -- Create meeting_fill_summary for manager (no duplicate)
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = NEW.id
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = NEW.manager_id
        AND t.status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (NEW.manager_id, NEW.id,
              'Заполните итоги встречи 1:1',
              'Встреча состоялась, необходимо заполнить итоги',
              'pending', 'meeting_fill_summary', 'Встречи 1:1');
    END IF;

    -- Close meeting_plan_new (meeting is active)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.employee_id
      AND task_type = 'meeting_plan_new'
      AND status IN ('pending', 'in_progress');
  END IF;

  -- ===== TRANSITION TO recorded =====
  IF NEW.status = 'recorded' THEN
    -- Close active meeting_fill_summary tasks
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_fill_summary'
      AND status IN ('pending', 'in_progress');

    -- Close active meeting_scheduled tasks (safety net)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_scheduled'
      AND status IN ('pending', 'in_progress');
  END IF;

  RETURN NEW;
END;
$function$;
```

#### Блок 2

- **Строки**: 99–101
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: trigger
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Create the AFTER UPDATE trigger
DROP TRIGGER IF EXISTS trg_sync_meeting_tasks_on_status ON public.one_on_one_meetings;
```

---

### `supabase/migrations/20260319143850_cefd1fd1-8ca0-4740-90a6-a1805cdad6d0.sql`

#### Блок 1

- **Строки**: 5–51
- **Тип операции**: `INSERT`
- **Целевые таблицы**: tasks, the
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
-- Add summary_acknowledged_version to tasks to track which version was acknowledged
-- We'll use a convention: tasks store the version they were created for

-- Update the trigger to increment version and use it for dedup
CREATE OR REPLACE FUNCTION public.create_meeting_review_summary_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
BEGIN
  -- Only act when summary actually changed to a non-empty value
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    -- Increment summary version
    NEW.summary_version := COALESCE(OLD.summary_version, 0) + 1;

    -- Determine target: the OTHER participant
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    -- Close any existing active review task for this meeting+target
    -- (it refers to an older version)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_review_summary'
      AND user_id = target_user_id
      AND status IN ('pending', 'in_progress');

    -- Create fresh task for the new version
    INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
    VALUES (target_user_id, NEW.id,
            'Ознакомьтесь с итогом встречи 1:1',
            'Итоги встречи обновлены, пожалуйста, ознакомьтесь с ними',
            'pending', 'meeting_review_summary', 'Встречи 1:1');
  END IF;
  RETURN NEW;
END;
$function$;
```

---

### `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql`

#### Блок 1

- **Строки**: 1–26
- **Тип операции**: `DELETE`
- **Целевые таблицы**: meeting_artifacts, meeting_decisions, meeting_manager_fields, meeting_private_notes, meeting_reschedules, one_on_one_meetings
- **Классификация**: `definitely_can_fail_on_prod`
- **Рекомендация**: `CUT`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | yes |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

**Hardcoded UUIDs:**

| UUID | Entity Type | Column | FK Sensitive |
|---|---|---|---|
| `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef` | user | manager_id | yes |
| `7c04b872-6de2-418d-b959-616894d398d7` | user | employee_id | yes |

```sql
-- DEV-ONLY cleanup: delete all 1:1 meeting data for Юрасова and her manager
-- Scope: employee_id = Юрасова OR manager_id = Тест Руководитель

DO $$
DECLARE
  _meeting_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _meeting_ids
  FROM one_on_one_meetings
  WHERE employee_id = '7c04b872-6de2-418d-b959-616894d398d7'
     OR manager_id = '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef';

  IF _meeting_ids IS NULL THEN
    RAISE NOTICE 'No meetings found, nothing to delete';
    RETURN;
  END IF;

  DELETE FROM meeting_reschedules   WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_decisions      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_artifacts      WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_private_notes  WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM meeting_manager_fields WHERE meeting_id = ANY(_meeting_ids);
  DELETE FROM one_on_one_meetings    WHERE id = ANY(_meeting_ids);

  RAISE NOTICE 'Deleted % meetings and related data', array_length(_meeting_ids, 1);
END $$;
```

---

### `supabase/migrations/20260323161019_2a55398b-91c0-41f1-99dc-3ac969630131.sql`

#### Блок 1

- **Строки**: 36–40
- **Тип операции**: `UPDATE`
- **Целевые таблицы**: TO
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
CREATE POLICY "system_admin_update_snapshot_runs"
  ON public.diagnostic_snapshot_runs FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'system.admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'system.admin'));
```

---

### `supabase/migrations/20260323162734_3e36246c-96a5-47d3-bce6-8531b302d20e.sql`

#### Блок 1

- **Строки**: 1–3
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO permissions (name, description, resource, action)
VALUES ('system.admin', 'Full system administrator access including diagnostic snapshots', 'system', 'admin')
ON CONFLICT DO NOTHING;
```

#### Блок 2

- **Строки**: 4–7
- **Тип операции**: `UPSERT`
- **Целевые таблицы**: role_permissions
- **Классификация**: `reference_data_change`
- **Рекомендация**: `KEEP`

| Flag | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

```sql
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name = 'system.admin'
ON CONFLICT DO NOTHING;
```

---

## Итоговые списки

### SQL с hardcoded user_id

| # | File | Lines | Tables | UUIDs |
|---|---|---|---|---|
| 1 | `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` | 12–34 | users | `550e8400-e29b-41d4-a716-446655440000`, `550e8400-e29b-41d4-a716-446655440003`, `550e8400-e29b-41d4-a716-446655440001` |
| 2 | `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` | 1–22 | users | `550e8400-e29b-41d4-a716-446655440000` |
| 3 | `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` | 1–22 | users | `550e8400-e29b-41d4-a716-446655440000` |
| 4 | `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` | 1–10 | users | `12345678-1234-5678-9012-123456789007`, `12345678-1234-5678-9012-123456789002`, `12345678-1234-5678-9012-123456789006`, `12345678-1234-5678-9012-123456789005`, `12345678-1234-5678-9012-123456789001`, `12345678-1234-5678-9012-123456789003`, `12345678-1234-5678-9012-123456789004` |
| 5 | `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql` | 78–98 | SET, existing, user_qualities | `550e8400-e29b-41d4-a716-446655440000` |
| 6 | `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql` | 144–169 | user_assessment_results | `550e8400-e29b-41d4-a716-446655440000` |
| 7 | `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql` | 144–169 | user_assessment_results | `550e8400-e29b-41d4-a716-446655440000` |
| 8 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 26–29 | users | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 9 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 41–58 | SET, users | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 10 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 41–58 | SET, users | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 11 | `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` | 44–48 | users | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 12 | `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql` | 1–4 | auth_user_id, users | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 13 | `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql` | 1–32 | accordingly, user_roles, users | `e033ec4d-0155-44c9-8aaf-b4a79adbc572` |
| 14 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 37–40 | users | `e033ec4d-0155-44c9-8aaf-b4a79adbc572` |
| 15 | `supabase/migrations/20251119141351_7bb4eb6f-441d-4644-a427-d7c0e26ee903.sql` | 1–88 |  | `00000000-0000-0000-0000-000000000000` |
| 16 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 3–3 | tasks | `7c04b872-6de2-418d-b959-616894d398d7` |
| 17 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 5–5 | tasks | `7c04b872-6de2-418d-b959-616894d398d7` |
| 18 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 7–7 | one_on_one_meetings | `695aa5cc-c402-43a0-bdea-1ca505a34392` |
| 19 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 8–8 | tasks | `695aa5cc-c402-43a0-bdea-1ca505a34392` |
| 20 | `supabase/migrations/20260318115533_3fc1ddbf-24aa-4169-9da3-efee85371b89.sql` | 1–33 |  | `00000000-0000-0000-0000-000000000000` |
| 21 | `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql` | 1–26 | meeting_artifacts, meeting_decisions, meeting_manager_fields, meeting_private_notes, meeting_reschedules, one_on_one_meetings | `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef`, `7c04b872-6de2-418d-b959-616894d398d7` |

### SQL с hardcoded skill_id / quality_id / answer_category_id

| # | File | Lines | Tables | Entity Types | UUIDs |
|---|---|---|---|---|---|
| 1 | `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql` | 1–4 | user_roles | role | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 2 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 8–11 | user_roles | role | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 3 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 59–66 | user_roles | role | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 4 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 59–66 | user_roles | role | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 5 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 96–106 | answer_categories | answer_category | `00000000-0000-0000-0000-000000000002`, `00000000-0000-0000-0000-000000000001` |
| 6 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 107–115 | hard_skill_answer_options | answer_category | `00000000-0000-0000-0000-000000000001` |
| 7 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 116–123 | soft_skill_answer_options | answer_category | `00000000-0000-0000-0000-000000000002` |
| 8 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 124–128 | hard_skill_questions | answer_category | `00000000-0000-0000-0000-000000000001` |
| 9 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 129–132 | soft_skill_questions | answer_category | `00000000-0000-0000-0000-000000000002` |
| 10 | `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` | 10–15 |  | answer_category | `00000000-0000-0000-0000-000000000001` |

### SQL с hardcoded assignment_id / diagnostic_stage_id / task_id / meeting_id

| # | File | Lines | Tables | Entity Types | UUIDs |
|---|---|---|---|---|---|
| 1 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 12–14 | tasks | task | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 2 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 15–17 | one_on_one_meetings | meeting | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 3 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 20–20 | survey_360_assignments | assignment | `9138f9ee-ca94-4563-9016-05e5d2b496df` |
| 4 | `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql` | 60–63 | tasks | task | `75494d0f-37e3-452d-98cf-6e31b23561f7` |
| 5 | `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` | 18–33 | survey_360_assignments | assignment | `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36`, `7c04b872-6de2-418d-b959-616894d398d7` |
| 6 | `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` | 34–52 | survey_360_assignments | assignment | `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef`, `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36`, `7c04b872-6de2-418d-b959-616894d398d7` |
| 7 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 1–32 | tasks, the | assignment, task | `fb6846f5-54df-4e1a-a4f6-435a9848f454`, `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36`, `7c04b872-6de2-418d-b959-616894d398d7` |
| 8 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 33–59 | tasks | assignment, task | `0b17db1b-93c5-4dc4-919f-2b91a9de73da`, `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef`, `2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36` |
| 9 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 60–65 | self, survey_360_assignments | assignment | `fb6846f5-54df-4e1a-a4f6-435a9848f454`, `0b17db1b-93c5-4dc4-919f-2b91a9de73da` |
| 10 | `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` | 1–3 | meeting_status_current | meeting | `addeb7ac-a109-429c-a3d0-57fd5a8700ea` |
| 11 | `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` | 4–4 | one_on_one_meetings | meeting | `addeb7ac-a109-429c-a3d0-57fd5a8700ea` |
| 12 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 1–1 | meeting_status_current | meeting | `9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204` |
| 13 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 2–2 | one_on_one_meetings | meeting | `9b815cc6-b0f7-4a74-a5ae-5c6d10e4d204` |
| 14 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 1–1 | meeting_decisions | meeting | `02c574af-fe19-4c56-811b-1fb80ba719f9` |
| 15 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 2–2 | meeting_private_notes | meeting | `02c574af-fe19-4c56-811b-1fb80ba719f9` |
| 16 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 3–3 | meeting_status_current | meeting | `02c574af-fe19-4c56-811b-1fb80ba719f9` |
| 17 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 4–4 | one_on_one_meetings | meeting | `02c574af-fe19-4c56-811b-1fb80ba719f9` |
| 18 | `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` | 1–3 | meeting_status_current | meeting | `15f16559-c295-47a9-9877-c30ab956886d` |
| 19 | `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` | 4–4 | one_on_one_meetings | meeting | `15f16559-c295-47a9-9877-c30ab956886d` |
| 20 | `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql` | 1–1 | tasks | task | `de7327f3-0e0a-4a5c-b6a3-210374eca07c` |
| 21 | `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql` | 1–7 | tasks | task | `1f0bfe3f-8e6a-4578-be45-fe1337314a4b` |
| 22 | `supabase/migrations/20260318135151_670a1483-74e6-4c35-bc30-60d3e3d5d6e1.sql` | 60–93 | timestamp | meeting | `00000000-0000-0000-0000-000000000000` |
| 23 | `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` | 3–3 | tasks | task | `2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92`, `f2c27675-6a98-4918-bd9c-ad3d1af1d84b` |
| 24 | `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` | 4–4 | one_on_one_meetings | meeting | `2132e9fa-5abe-43bc-a8d6-a62dcb1f9d92`, `f2c27675-6a98-4918-bd9c-ad3d1af1d84b` |

### Миграции dev-only (seed / cleanup)

| # | File | Lines | Op | Tables |
|---|---|---|---|---|
| 1 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 1–4 | DELETE | user_skills |
| 2 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 5–5 | DELETE | user_qualities |
| 3 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 6–6 | DELETE | user_achievements |
| 4 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 7–7 | DELETE | user_profiles |
| 5 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 8–8 | DELETE | users |
| 6 | `supabase/migrations/20250909133543_1b834009-bc8e-47a8-8caf-812012cca77d.sql` | 1–82 | INSERT | user_assessment_results |
| 7 | `supabase/migrations/20250909133844_8c704828-d6e9-413f-bb87-286f338ee103.sql` | 1–80 | INSERT | user_assessment_results |
| 8 | `supabase/migrations/20250910090707_734e6f60-f42a-4af5-aba4-41a173592375.sql` | 1–2 | DELETE | survey_360_assignments |
| 9 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 1–7 | DELETE | audit_log |
| 10 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 18–18 | DELETE | meeting_stage_participants |
| 11 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 19–19 | DELETE | survey_360_results |
| 12 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 21–21 | DELETE | survey_360_selections |
| 13 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 22–22 | DELETE | skill_survey_results |
| 14 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 23–23 | DELETE | skill_survey_assignments |
| 15 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 24–24 | DELETE | development_plans |
| 16 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 25–25 | DELETE | survey_assignments |
| 17 | `supabase/migrations/20251031114159_a6ac3e1e-9044-478d-b279-b451f2e30e03.sql` | 1–24 | DELETE | public |
| 18 | `supabase/migrations/20251031114813_1bd4f7db-6a87-4101-82bf-582c5414ada3.sql` | 3–31 | DELETE | public |
| 19 | `supabase/migrations/20251031114813_1bd4f7db-6a87-4101-82bf-582c5414ada3.sql` | 32–104 | DELETE | career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_results, survey_360_results, tasks |
| 20 | `supabase/migrations/20251031125259_623bdf00-ef4d-449f-9eb2-34712337803e.sql` | 1–86 | DELETE | career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_assignments, skill_survey_results, survey_360_assignments, survey_360_results, tasks, user_assessment_results |
| 21 | `supabase/migrations/20251031141822_0ea7fbee-5b66-478f-a6ff-ab8793ab1de1.sql` | 71–146 | INSERT | user_assessment_results |
| 22 | `supabase/migrations/20251031141822_0ea7fbee-5b66-478f-a6ff-ab8793ab1de1.sql` | 147–222 | INSERT | user_assessment_results |
| 23 | `supabase/migrations/20251031142614_88246b03-60df-4326-90c0-2fb8b92450dc.sql` | 1–95 | INSERT | user_assessment_results |
| 24 | `supabase/migrations/20251031173924_55cc7cef-0d4d-48cf-922a-93d93d9d86fb.sql` | 1–83 | UPSERT | SET, user_assessment_results |
| 25 | `supabase/migrations/20251031173924_55cc7cef-0d4d-48cf-922a-93d93d9d86fb.sql` | 84–167 | UPSERT | SET, user_assessment_results |
| 26 | `supabase/migrations/20251031173941_07839630-4318-49b2-a1bf-83e7872777ed.sql` | 1–83 | UPSERT | SET, user_assessment_results |
| 27 | `supabase/migrations/20251031173941_07839630-4318-49b2-a1bf-83e7872777ed.sql` | 84–167 | UPSERT | SET, user_assessment_results |
| 28 | `supabase/migrations/20251031174607_ddff9245-f99c-4415-ac90-5206c73547f4.sql` | 1–77 | UPSERT | user_assessment_results |
| 29 | `supabase/migrations/20251031174622_53a47031-abdd-4bfd-ad08-f7c0d89b47a4.sql` | 1–77 | UPSERT | user_assessment_results |
| 30 | `supabase/migrations/20251031185524_1fbc207b-675f-42d5-90ea-f4a25371dbc7.sql` | 104–143 | DELETE | tasks |
| 31 | `supabase/migrations/20251031192352_d0fd1e52-aa22-4f45-933b-dfc1151b22a6.sql` | 1–9 | DELETE | tasks |
| 32 | `supabase/migrations/20251031195715_eb63bf82-d04d-4441-92e4-ef3b9493a1be.sql` | 224–263 | DELETE | tasks |
| 33 | `supabase/migrations/20251031205116_b7458d96-6a2e-4a79-9129-1f08dc227c21.sql` | 17–98 | DELETE | career_tracks, diagnostic_stage_participants, diagnostic_stages, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, skill_survey_results, survey_360_assignments, survey_360_results, tasks, user_assessment_results |
| 34 | `supabase/migrations/20251031205734_4ba83934-9f75-4982-a1be-8effd5379f28.sql` | 57–132 | INSERT | user_assessment_results |
| 35 | `supabase/migrations/20251031205734_4ba83934-9f75-4982-a1be-8effd5379f28.sql` | 133–208 | INSERT | user_assessment_results |
| 36 | `supabase/migrations/20251101113911_216049f0-599c-444d-b49f-fa6acc080730.sql` | 1–76 | UPDATE | admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results |
| 37 | `supabase/migrations/20251101121747_ffb85ce4-12e4-43ca-93c0-9b1d842f3c8c.sql` | 42–113 | INSERT | user_assessment_results |
| 38 | `supabase/migrations/20251101121747_ffb85ce4-12e4-43ca-93c0-9b1d842f3c8c.sql` | 114–181 | INSERT | user_assessment_results |
| 39 | `supabase/migrations/20251113140622_efad24ee-7111-4928-ba39-e108c574ef27.sql` | 100–146 | INSERT | user_assessment_results |
| 40 | `supabase/migrations/20251113140622_efad24ee-7111-4928-ba39-e108c574ef27.sql` | 147–193 | INSERT | user_assessment_results |
| 41 | `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql` | 55–70 | DELETE | role_permissions |
| 42 | `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql` | 71–79 | DELETE | permissions |
| 43 | `supabase/migrations/20251113164047_ab9c060f-51bf-48a6-b660-cf2bb8d7872d.sql` | 123–129 | DELETE | role_permissions |
| 44 | `supabase/migrations/20251113184003_b4988151-d84c-4aeb-a8ac-fd0d1aa1a08c.sql` | 39–62 | UPSERT | user_effective_permissions |
| 45 | `supabase/migrations/20251113200617_220bf8f4-0b5d-4bb6-867b-435d475cae97.sql` | 1–88 | UPDATE | admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results |
| 46 | `supabase/migrations/20251113200617_220bf8f4-0b5d-4bb6-867b-435d475cae97.sql` | 92–123 | UPDATE | admin_delete_all_from_table, public |
| 47 | `supabase/migrations/20251113200810_188f341b-54f9-42f0-a689-1fe5eef3b22c.sql` | 1–88 | UPDATE | admin_cleanup_all_data, diagnostic_stage_participants, diagnostic_stages, hard_skill_results, meeting_decisions, meeting_stage_participants, meeting_stages, one_on_one_meetings, soft_skill_results, survey_360_assignments, tasks, user_assessment_results |
| 48 | `supabase/migrations/20251113200810_188f341b-54f9-42f0-a689-1fe5eef3b22c.sql` | 92–123 | UPDATE | admin_delete_all_from_table, public |
| 49 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 1–8 | DELETE | audit_log |
| 50 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 9–12 | DELETE | admin_activity_logs |
| 51 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 13–16 | DELETE | access_denied_logs |
| 52 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 17–20 | DELETE | diagnostic_stage_participants |
| 53 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 21–23 | DELETE | meeting_stage_participants |
| 54 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 24–30 | DELETE | diagnostic_stages |
| 55 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 31–36 | DELETE | meeting_stages |
| 56 | `supabase/migrations/20251114142051_b9003e05-9681-4e77-90ee-cc741be7214a.sql` | 41–45 | DELETE | role_permissions |
| 57 | `supabase/migrations/20251126095446_444eccfb-3120-439a-9f35-0f75033f027b.sql` | 1–53 | INSERT | user_assessment_results |
| 58 | `supabase/migrations/20251126095446_444eccfb-3120-439a-9f35-0f75033f027b.sql` | 54–103 | INSERT | user_assessment_results |
| 59 | `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` | 1–4 | DELETE | hard_skill_results |
| 60 | `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` | 5–9 | DELETE | hard_skill_answer_options |
| 61 | `supabase/migrations/20251209115249_7659a085-5989-4f07-92cc-992e5e0d59fd.sql` | 1–50 | INSERT | user_assessment_results |
| 62 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 1–3 | DELETE | meeting_artifacts |
| 63 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 4–4 | DELETE | meeting_decisions |
| 64 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 5–5 | DELETE | meeting_private_notes |
| 65 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 6–6 | DELETE | meeting_status_current |
| 66 | `supabase/migrations/20260306084811_cf24a8a7-def4-44fb-978b-28c8a03670d3.sql` | 31–40 | DELETE | hard_skill_answer_options |
| 67 | `supabase/migrations/20260306084811_cf24a8a7-def4-44fb-978b-28c8a03670d3.sql` | 41–50 | DELETE | soft_skill_answer_options |
| 68 | `supabase/migrations/20260306084811_cf24a8a7-def4-44fb-978b-28c8a03670d3.sql` | 51–60 | DELETE | answer_categories |
| 69 | `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` | 1–2 | DELETE | meeting_decisions |

### Миграции, которые можно переписать на business key

| # | File | Lines | Suggested Key | Tables |
|---|---|---|---|---|
| 1 | `supabase/migrations/20250908094317_47b2a57c-5c12-49fc-9a1c-fbad3d31d8c9.sql` | 33–54 | email | users |
| 2 | `supabase/migrations/20250908094555_187acfd3-66ae-4cdb-b5e6-e7869b343b85.sql` | 42–62 | email | users |
| 3 | `supabase/migrations/20250908102826_e292310d-f6aa-4080-99be-6bc70e31cffa.sql` | 17–39 | email | users |
| 4 | `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` | 12–34 | email | users |
| 5 | `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` | 1–22 | email | users |
| 6 | `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` | 1–22 | email | users |
| 7 | `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` | 1–10 | email | users |
| 8 | `supabase/migrations/20251017141226_8ba6d53d-11fd-4268-8b94-9281f92d684a.sql` | 1–4 | name | user_roles |
| 9 | `supabase/migrations/20251017142212_3d6729c4-8774-424e-baae-0d091a7eeed5.sql` | 1–22 | email | user_roles |
| 10 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 8–11 | name | user_roles |
| 11 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 3–40 | email | SET, admin, auth |
| 12 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 41–58 | email | SET, users |
| 13 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 59–66 | name | user_roles |
| 14 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 3–40 | email | SET, admin, auth |
| 15 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 41–58 | email | SET, users |
| 16 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 59–66 | name | user_roles |
| 17 | `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` | 32–43 | email | SET, auth_users |
| 18 | `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` | 44–48 | email | users |
| 19 | `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql` | 1–4 | email | auth_user_id, users |
| 20 | `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql` | 1–32 | email | accordingly, user_roles, users |
| 21 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 96–106 | name | answer_categories |
| 22 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 107–115 | name | hard_skill_answer_options |
| 23 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 116–123 | name | soft_skill_answer_options |
| 24 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 124–128 | name | hard_skill_questions |
| 25 | `supabase/migrations/20251118095144_0f7b5773-f852-4cd6-8113-94927afbc902.sql` | 129–132 | name | soft_skill_questions |
| 26 | `supabase/migrations/20251126204354_d28765aa-e481-45a8-9224-d991d4a661c1.sql` | 10–15 | name |  |

### SQL, которые ТОЧНО сломаются на проде

| # | File | Lines | Op | Tables | Reason |
|---|---|---|---|---|---|
| 1 | `supabase/migrations/20250908103839_74d3a058-716a-4150-b7e2-6d819249db72.sql` | 12–34 | INSERT | users | hardcoded user_id |
| 2 | `supabase/migrations/20250908103904_08b3247d-4c79-4452-8aca-de19b8bf841e.sql` | 1–22 | INSERT | users | hardcoded user_id |
| 3 | `supabase/migrations/20250908103932_203cab16-8834-4116-8786-d3f84e8682bc.sql` | 1–22 | INSERT | users | hardcoded user_id |
| 4 | `supabase/migrations/20250908140052_581fff14-d7fc-44d3-9d94-a146cc62d87a.sql` | 1–10 | UPSERT | users | hardcoded user_id |
| 5 | `supabase/migrations/20250909114147_2aa5386e-ee4d-40c9-bd4e-0852c7dce81e.sql` | 78–98 | UPSERT | SET, existing, user_qualities | hardcoded user_id |
| 6 | `supabase/migrations/20250909120342_03ce503e-c4a5-4216-aa71-490896acee54.sql` | 144–169 | UPSERT | user_assessment_results | hardcoded user_id |
| 7 | `supabase/migrations/20250909120459_31e9722d-900d-420a-8ab1-0e6b53505a42.sql` | 144–169 | UPSERT | user_assessment_results | hardcoded user_id |
| 8 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 12–14 | DELETE | tasks | hardcoded stage/assignment/task id |
| 9 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 15–17 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 10 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 20–20 | DELETE | survey_360_assignments | hardcoded stage/assignment/task id |
| 11 | `supabase/migrations/20251024175811_d3c6b7e5-5644-455e-ae92-8340e6882f2a.sql` | 26–29 | DELETE | users | hardcoded user_id |
| 12 | `supabase/migrations/20251024181746_d986f804-4bfe-46ae-a898-638ffeea1872.sql` | 41–58 | UPSERT | SET, users | hardcoded user_id |
| 13 | `supabase/migrations/20251024181804_aa6c9e67-6a84-4fa6-bf12-5618aed613b5.sql` | 41–58 | UPSERT | SET, users | hardcoded user_id |
| 14 | `supabase/migrations/20251024184756_91f8faba-64d5-4178-bc2c-043bc5249281.sql` | 44–48 | UPDATE | users | hardcoded user_id |
| 15 | `supabase/migrations/20251024185136_96cf896f-d4a6-4ac1-a1ae-36283b5a291f.sql` | 1–4 | UPDATE | auth_user_id, users | hardcoded user_id |
| 16 | `supabase/migrations/20251113220703_a70b6d2a-fa0a-4829-a9a9-79f7f1ae5f69.sql` | 1–32 | UPSERT | accordingly, user_roles, users | hardcoded user_id |
| 17 | `supabase/migrations/20251114104705_d8f18e39-5b62-4e9a-8bfc-ae3f04f7c0f0.sql` | 37–40 | DELETE | users | hardcoded user_id |
| 18 | `supabase/migrations/20251119141351_7bb4eb6f-441d-4644-a427-d7c0e26ee903.sql` | 1–88 | OTHER |  | hardcoded user_id |
| 19 | `supabase/migrations/20251128100405_e46771ad-135c-44a2-9aae-fb2d6a711149.sql` | 60–63 | DELETE | tasks | hardcoded stage/assignment/task id |
| 20 | `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` | 18–33 | UPSERT | survey_360_assignments | hardcoded stage/assignment/task id |
| 21 | `supabase/migrations/20260126105912_e318ef92-814e-4e28-9861-6c1b4c137d4f.sql` | 34–52 | UPSERT | survey_360_assignments | hardcoded stage/assignment/task id |
| 22 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 1–32 | INSERT | tasks, the | hardcoded stage/assignment/task id |
| 23 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 33–59 | INSERT | tasks | hardcoded stage/assignment/task id |
| 24 | `supabase/migrations/20260126110425_9ecc7966-abc4-48fe-826b-a5f2913d978f.sql` | 60–65 | UPDATE | self, survey_360_assignments | hardcoded stage/assignment/task id |
| 25 | `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` | 1–3 | DELETE | meeting_status_current | hardcoded stage/assignment/task id |
| 26 | `supabase/migrations/20260219122711_90815d58-c9a4-4941-9c73-909cb5266a1d.sql` | 4–4 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 27 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 1–1 | DELETE | meeting_status_current | hardcoded stage/assignment/task id |
| 28 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 2–2 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 29 | `supabase/migrations/20260219124227_8f4e9645-6ee5-4796-9593-990fc27b075a.sql` | 3–3 | DELETE | tasks | hardcoded user_id |
| 30 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 1–1 | DELETE | meeting_decisions | hardcoded stage/assignment/task id |
| 31 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 2–2 | DELETE | meeting_private_notes | hardcoded stage/assignment/task id |
| 32 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 3–3 | DELETE | meeting_status_current | hardcoded stage/assignment/task id |
| 33 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 4–4 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 34 | `supabase/migrations/20260219125439_6fb181c3-97c2-4d78-a0b6-e5ccbca953f6.sql` | 5–5 | DELETE | tasks | hardcoded user_id |
| 35 | `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` | 1–3 | DELETE | meeting_status_current | hardcoded stage/assignment/task id |
| 36 | `supabase/migrations/20260220122932_ec445a24-53e2-4fae-a356-30e85a8fbc9b.sql` | 4–4 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 37 | `supabase/migrations/20260220123245_5029d6f7-1965-40a6-a350-ca36c305adf9.sql` | 1–1 | DELETE | tasks | hardcoded stage/assignment/task id |
| 38 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 7–7 | DELETE | one_on_one_meetings | hardcoded user_id |
| 39 | `supabase/migrations/20260226101624_2921e813-5b7b-49d9-898a-3d6f8d0d6cfe.sql` | 8–8 | DELETE | tasks | hardcoded user_id |
| 40 | `supabase/migrations/20260313122702_b9ae213a-c332-4cf4-a093-4bb494a161d3.sql` | 1–7 | UPDATE | tasks | hardcoded stage/assignment/task id |
| 41 | `supabase/migrations/20260318115533_3fc1ddbf-24aa-4169-9da3-efee85371b89.sql` | 1–33 | OTHER |  | hardcoded user_id |
| 42 | `supabase/migrations/20260318135151_670a1483-74e6-4c35-bc30-60d3e3d5d6e1.sql` | 60–93 | UPDATE | timestamp | hardcoded stage/assignment/task id |
| 43 | `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` | 3–3 | DELETE | tasks | hardcoded stage/assignment/task id |
| 44 | `supabase/migrations/20260318143419_a6d1e635-f01f-4bca-a71f-3d6ccbffbdc7.sql` | 4–4 | DELETE | one_on_one_meetings | hardcoded stage/assignment/task id |
| 45 | `supabase/migrations/20260323125414_abed1c52-24b4-4701-8d8b-820aff34e37a.sql` | 1–26 | DELETE | meeting_artifacts, meeting_decisions, meeting_manager_fields, meeting_private_notes, meeting_reschedules, one_on_one_meetings | hardcoded user_id |
