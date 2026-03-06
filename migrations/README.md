# Production Migrations

Эта папка содержит **DDL-only миграции**, уже применённые к production базе данных.

## ⚠️ ВАЖНО

**Все 5 миграций УЖЕ ПРИМЕНЕНЫ в production!**

Файлы предназначены только для:
- Справки и документации
- Повторного использования на новых окружениях
- Аудита изменений схемы БД

## Принципы

1. **Только DDL** — никаких INSERT/UPDATE/DELETE с конкретными данными
2. **Идемпотентность** — `IF NOT EXISTS`, `OR REPLACE`, `ON CONFLICT DO NOTHING`
3. **Без hardcoded UUID** — все данные управляются через UI/API

## Текущие миграции (в порядке применения)

| Версия | Файл | Описание |
|--------|------|----------|
| 1 | `20260126105911_assignment_unique_constraint.sql` | Unique constraint с diagnostic_stage_id |
| 2 | `20260126110423_participant_trigger.sql` | Триггер создания assignments и tasks |
| 3 | `20260128124302_finalize_cascade.sql` | Каскадная финализация этапов |
| 4 | `20260129083403_pg_cron.sql` | Расширение pg_cron + rejected статус |
| 5 | `20260129144700_finalize_param_rename.sql` | Переименование параметра p_stage_id |

## Как применить на новом окружении

### Вариант 1: Supabase CLI

```bash
# Скопировать в supabase/migrations/ и применить
cp migrations/*.sql supabase/migrations/
supabase db push
```

### Вариант 2: SQL Editor

1. Открыть https://supabase.com/dashboard/project/zgbimzuhrsgvfrhlboxy/sql/new
2. Скопировать содержимое каждого файла **по порядку**
3. Выполнить

## Регистрация миграций

После применения зарегистрируйте миграции в таблице истории:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
  ('20260126105911', 'assignment_unique_constraint', '{}'),
  ('20260126110423', 'participant_trigger', '{}'),
  ('20260128124302', 'finalize_cascade', '{}'),
  ('20260129083403', 'pg_cron', '{}'),
  ('20260129144700', 'finalize_param_rename', '{}')
ON CONFLICT (version) DO NOTHING;
```

## История изменений

- **2026-02-03**: Файлы очищены от DML с hardcoded UUID, синхронизированы с production БД
- **2026-02-02**: Удалены применённые миграции (20260116113854, 20260116164200, 20260116173336, 20260122034859)
