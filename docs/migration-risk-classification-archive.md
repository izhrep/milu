# Migration Risk Classification — Remote Archive (≥ 20260325)

> **Generated:** 2026-03-31
>
> **Source:** `supabase_migrations.schema_migrations` (remote Supabase project `zgbimzuhrsgvfrhlboxy`)
>
> **Note:** Directory `supabase/migrations_archive/` does not exist in the local codebase.
> Migrations were sourced from the remote Supabase migration history as requested by the user.
>
> **Total source migrations (≥ 20260325):** 12
>
> **Naming source:** `version` column from `supabase_migrations.schema_migrations`
>
> **Timestamp filter:** `>= 20260325000000`
>
> **Scope:** Only DML / data-dependent / env-specific SQL blocks. Pure schema-only DDL is excluded.

---

## Migrations excluded (schema-only DDL, no data-dependent SQL)

| Version | Summary |
|---|---|
| `20260325075816` | ALTER TABLE users + CREATE TABLE meeting_notifications + trigger functions (pure DDL) |
| `20260325141404` | DROP/ADD CONSTRAINT cascade changes on FK (pure DDL) |
| `20260326095051` | CREATE OR REPLACE FUNCTION notify_bitrix_user_connected (pure DDL, vault-based — no hardcoded keys) |
| `20260327112103` | CREATE OR REPLACE FUNCTION create_meeting_review_summary_task (pure DDL) |
| `20260327112820` | CREATE OR REPLACE FUNCTION create_meeting_scheduled_task + process_meeting_tasks (pure DDL) |
| `20260330110202` | ALTER TABLE users ADD COLUMN timezone (pure DDL) |
| `20260330111925` | CREATE POLICY on meeting_notifications (pure DDL) |
| `20260330112320` | ALTER TABLE users ADD COLUMN timezone_manual (pure DDL) |

---

## SQL Block 1

- **Migration:** `20260325080135`
- **Target tables:** `cron.schedule` (pg_cron job)
- **Lines:** 1–10 (entire migration)
- **Operation type:** INSERT (cron job registration)
- **Purpose:** Schedule pg_cron job `process-bitrix-reminders` every 5 minutes calling Edge Function

### Exact SQL

```sql
SELECT cron.schedule(
  'process-bitrix-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/process-reminders',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Classification

| Check | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

### Hardcoded values found

| Value | Type | Column/Context | FK sensitive |
|---|---|---|---|
| `https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/process-reminders` | env-specific URL | HTTP endpoint in cron body | no |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon JWT) | env-specific credential | Authorization header in cron body | no |

### Risk

- **Classification:** `won't_fail_but_env_specific`
- **Recommended action:** `REWRITE`
- **Reason:** Hardcoded Supabase project URL and anon key. On a different environment (staging, new project), the cron job would call the wrong endpoint or fail auth. Should use `vault.decrypted_secrets` or `current_setting()` instead of literal values.

---

## SQL Block 2

- **Migration:** `20260326085738`
- **Target tables:** N/A (inside `CREATE OR REPLACE FUNCTION public.notify_meeting_change()`)
- **Lines:** within function body
- **Operation type:** Function DDL containing hardcoded env-specific values
- **Purpose:** Trigger function that calls Edge Function via `net.http_post` with hardcoded fallback anon key

### Exact SQL (env-specific fragment inside function body)

```sql
_function_url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder';

-- Fallback anon key if not set via app.settings
IF _anon_key IS NULL OR _anon_key = '' THEN
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8';
END IF;
```

### Classification

| Check | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

### Hardcoded values found

| Value | Type | Column/Context | FK sensitive |
|---|---|---|---|
| `https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder` | env-specific URL | `_function_url` variable | no |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon JWT) | env-specific credential | `_anon_key` fallback | no |

### Risk

- **Classification:** `won't_fail_but_env_specific`
- **Recommended action:** `REWRITE`
- **Reason:** Function body contains hardcoded Supabase URL and anon key as fallback. Should exclusively use `vault.decrypted_secrets` (as done in `20260326095051`). Note: this is inside a `CREATE OR REPLACE FUNCTION`, so the function DDL itself must be kept — only the hardcoded literals inside need rewriting.

---

## SQL Block 3

- **Migration:** `20260326100714`
- **Target tables:** N/A (inside `CREATE OR REPLACE FUNCTION public.notify_bitrix_user_connected()`)
- **Lines:** within function body
- **Operation type:** Function DDL containing hardcoded env-specific values
- **Purpose:** Re-creation of `notify_bitrix_user_connected` with hardcoded URL + key (replacing vault-based version from `20260326095051`)

### Exact SQL (env-specific fragment inside function body)

```sql
PERFORM net.http_post(
  url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8'
  ),
  body := jsonb_build_object(
    'action', 'bitrix_user_connected',
    'user_id', NEW.id::text
  )
);
```

### Classification

| Check | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

### Hardcoded values found

| Value | Type | Column/Context | FK sensitive |
|---|---|---|---|
| `https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder` | env-specific URL | `url` parameter | no |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon JWT) | env-specific credential | `Authorization` header | no |

### Risk

- **Classification:** `won't_fail_but_env_specific`
- **Recommended action:** `REWRITE`
- **Reason:** This migration **reverted** the vault-based approach from `20260326095051` back to hardcoded literals. Should be rewritten to use `vault.decrypted_secrets`. Note: function DDL must be kept, only hardcoded values inside need replacement.

---

## SQL Block 4

- **Migration:** `20260327093009`
- **Target tables:** `permissions`, `role_permissions`
- **Lines:** 1–8 (DML portion)
- **Operation type:** INSERT (reference data)
- **Purpose:** Add `meetings.edit_summary_date` permission and assign it to `hr_bp` role

### Exact SQL (DML portion only)

```sql
-- 1. Add permission
INSERT INTO permissions (name, description, resource, action)
VALUES ('meetings.edit_summary_date', 'Редактирование итогов и даты/времени любой встречи 1:1', 'meetings', 'edit_summary_date')
ON CONFLICT (name) DO NOTHING;

-- 2. Assign to hr_bp role
INSERT INTO role_permissions (role, permission_id)
SELECT 'hr_bp'::app_role, p.id FROM permissions p
WHERE p.name = 'meetings.edit_summary_date'
ON CONFLICT DO NOTHING;
```

### Classification

| Check | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | yes (uses `name` business key) |
| suggested_business_key | name |

### Hardcoded values found

| Value | Type | Column/Context | FK sensitive |
|---|---|---|---|
| `'meetings.edit_summary_date'` | permission name (business key) | `permissions.name` | no |
| `'hr_bp'` | role enum value | `role_permissions.role` | no |

### Risk

- **Classification:** `reference_data_change`
- **Recommended action:** `KEEP`
- **Reason:** Uses business keys (`permissions.name`, enum `app_role`), has `ON CONFLICT DO NOTHING` — idempotent and safe across environments. No hardcoded UUIDs.

---

## SQL Block 5 (same migration `20260327093009`)

- **Target tables:** N/A (inside `CREATE OR REPLACE FUNCTION public.notify_meeting_change()`)
- **Lines:** within function body
- **Operation type:** Function DDL containing hardcoded env-specific values
- **Purpose:** Updated `notify_meeting_change` function with hardcoded URL + anon key fallback

### Exact SQL (env-specific fragment inside function body)

```sql
_function_url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder';
_anon_key := current_setting('app.settings.anon_key', true);

IF _anon_key IS NULL OR _anon_key = '' THEN
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8';
END IF;
```

### Classification

| Check | Value |
|---|---|
| uses_hardcoded_user_ids | no |
| uses_hardcoded_reference_ids | no |
| uses_hardcoded_assignment_or_stage_ids | no |
| environment_specific_user_or_email | no |
| can_be_rewritten_with_business_key | no |
| suggested_business_key | none |

### Hardcoded values found

| Value | Type | Column/Context | FK sensitive |
|---|---|---|---|
| `https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder` | env-specific URL | `_function_url` variable | no |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon JWT) | env-specific credential | `_anon_key` fallback | no |

### Risk

- **Classification:** `won't_fail_but_env_specific`
- **Recommended action:** `REWRITE`
- **Reason:** Same pattern as SQL Block 2. Hardcoded Supabase URL and anon key should use vault or `current_setting()` exclusively.

---

## Summary Lists

### All SQL with hardcoded user_id

**None** — no migrations in this range contain hardcoded `user_id` UUIDs.

(Note: migration `20260323125412` — just before the filter cutoff — contains hardcoded user UUIDs `7c04b872-6de2-418d-b959-616894d398d7` and `4cf40061-4c6f-4379-8082-5bb2ddd8a5ef` for dev-only meeting cleanup. It is **outside** the `>= 20260325` filter.)

### All SQL with hardcoded skill_id / quality_id / answer_category_id

**None** in this range.

### All SQL with hardcoded assignment_id / diagnostic_stage_id / task_id / meeting_id

**None** in this range.

### Dev-only migrations

**None** in the `>= 20260325` range. (Nearest dev-only: `20260323125412` — excluded by filter.)

### Migrations that can be safely rewritten with business key

| Version | Status |
|---|---|
| `20260327093009` (DML portion) | Already uses business keys (`permissions.name`, enum `app_role`). **No rewrite needed.** |

### Migrations requiring env-specific value cleanup

| Version | Issue | Recommended action |
|---|---|---|
| `20260325080135` | Hardcoded Supabase URL + anon JWT in cron body | `REWRITE` — use vault secrets |
| `20260326085738` | Hardcoded URL + anon JWT fallback in trigger function | `REWRITE` — use vault secrets |
| `20260326100714` | Hardcoded URL + anon JWT in trigger function (reverted vault approach) | `REWRITE` — use vault secrets |
| `20260327093009` | Hardcoded URL + anon JWT fallback in trigger function (updated version) | `REWRITE` — use vault secrets |

### Pattern summary

The **only recurring risk pattern** in this range is **hardcoded Supabase project URL and anon key** inside:
1. `cron.schedule()` body
2. `SECURITY DEFINER` trigger functions (`notify_meeting_change`, `notify_bitrix_user_connected`)

All four affected SQL blocks use the same anon JWT and project-specific URL `zgbimzuhrsgvfrhlboxy.supabase.co`. Migration `20260326095051` (vault-based approach) was the correct pattern but was subsequently overwritten by `20260326100714` which reverted to hardcoded values.

**Recommended fix:** Consolidate all trigger functions to use `vault.decrypted_secrets` for both URL and anon key, matching the pattern established in `20260326095051`.
