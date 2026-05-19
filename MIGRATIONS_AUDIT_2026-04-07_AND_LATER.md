# Audit of Risky Data-Changing / Data-Dependent SQL in Local Migrations

## Filesystem source

- **directory actually read:** `supabase/migrations/`
- **timestamp filter:** `>= 20260407000000`
- **total source `.sql` files after filter:** 11
- **naming source:** exact filesystem names (read via `ls -1 supabase/migrations/`)

### Full list of analyzed `.sql` files

| # | exact file name | migration number (from filename) | full relative path |
|---|---|---|---|
| 1 | `20260407064706_9f92f230-569a-4696-8503-857697dfe98f.sql` | `20260407064706` | `supabase/migrations/20260407064706_9f92f230-569a-4696-8503-857697dfe98f.sql` |
| 2 | `20260408114106_91c2cd43-0066-42c7-8233-bccea5c5ec57.sql` | `20260408114106` | `supabase/migrations/20260408114106_91c2cd43-0066-42c7-8233-bccea5c5ec57.sql` |
| 3 | `20260409062807_6dc17c65-af44-432b-9a6f-7a195b6648e0.sql` | `20260409062807` | `supabase/migrations/20260409062807_6dc17c65-af44-432b-9a6f-7a195b6648e0.sql` |
| 4 | `20260409064030_ce75d76b-5514-49d4-9cc0-2d1f88069817.sql` | `20260409064030` | `supabase/migrations/20260409064030_ce75d76b-5514-49d4-9cc0-2d1f88069817.sql` |
| 5 | `20260409064932_73c774cb-2bb8-4aff-9d3f-9295ab161816.sql` | `20260409064932` | `supabase/migrations/20260409064932_73c774cb-2bb8-4aff-9d3f-9295ab161816.sql` |
| 6 | `20260409115020_15918c59-10fd-4d19-8471-67343fc040b5.sql` | `20260409115020` | `supabase/migrations/20260409115020_15918c59-10fd-4d19-8471-67343fc040b5.sql` |
| 7 | `20260409133838_6897e2da-ed33-4cef-8487-2177be1f8da3.sql` | `20260409133838` | `supabase/migrations/20260409133838_6897e2da-ed33-4cef-8487-2177be1f8da3.sql` |
| 8 | `20260413105954_01127a06-f0d6-448c-b1f5-36d0d23c3fe4.sql` | `20260413105954` | `supabase/migrations/20260413105954_01127a06-f0d6-448c-b1f5-36d0d23c3fe4.sql` |
| 9 | `20260416124835_03ed6ba5-c3bc-4a2b-9a34-95767c66810a.sql` | `20260416124835` | `supabase/migrations/20260416124835_03ed6ba5-c3bc-4a2b-9a34-95767c66810a.sql` |
| 10 | `20260416125852_e3f33bbd-75b7-43fb-94c3-83eff72c647e.sql` | `20260416125852` | `supabase/migrations/20260416125852_e3f33bbd-75b7-43fb-94c3-83eff72c647e.sql` |
| 11 | `20260417094746_7f3b42b1-7a93-45c2-9fd0-b811cf3c8c18.sql` | `20260417094746` | `supabase/migrations/20260417094746_7f3b42b1-7a93-45c2-9fd0-b811cf3c8c18.sql` |

---

## Risky data-changing / data-dependent blocks

Total findings: **2**

Files excluded as schema-only / function-DDL-only (no risky DML, no hardcoded data-dependent values):
`20260407064706`, `20260408114106`, `20260409062807`, `20260409064030`, `20260409115020`, `20260409133838`, `20260413105954`, `20260416124835`, `20260416125852`.

---

### Finding 1

- **migration:** `20260409064932`
- **file:** `20260409064932_73c774cb-2bb8-4aff-9d3f-9295ab161816.sql`
- **path:** `supabase/migrations/20260409064932_73c774cb-2bb8-4aff-9d3f-9295ab161816.sql`
- **lines:** 2–4
- **purpose:** Backfill: grant `meetings.edit_summary_date` permission to `admin` role in `role_permissions`. Depends on a row already existing in `permissions` with `name = 'meetings.edit_summary_date'` and on the `app_role` enum value `'admin'` being defined.
- **operation_type:** INSERT (with `ON CONFLICT DO NOTHING`)
- **target_tables:** `public.role_permissions` (depends on read from `public.permissions`)
- **exact_sql:**

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions WHERE name = 'meetings.edit_summary_date'
ON CONFLICT DO NOTHING;
```

- **uses_hardcoded_user_ids:** no
- **uses_hardcoded_reference_ids:** no (uses business key `name = 'meetings.edit_summary_date'` for lookup — good practice)
- **uses_hardcoded_assignment_or_stage_ids:** no
- **environment_specific_user_or_email:** no
- **can_be_rewritten_with_business_key:** yes (already uses business key `permissions.name`)
- **suggested_business_key:** `name` (for `permissions`); `role` enum value (for `role_permissions`)

**Risk profile:**
- Idempotent thanks to `ON CONFLICT DO NOTHING`.
- **Silent no-op risk:** if row `permissions.name = 'meetings.edit_summary_date'` does not exist on the target environment at the moment of running this migration, the `SELECT` returns 0 rows and the `INSERT` inserts nothing — without error. The grant will then be silently missing on prod.
- Depends on the existence of `app_role` enum value `'admin'` (introduced earlier in project history). If the enum value is missing on a fresh env, the `::app_role` cast fails with a hard error.
- Depends on the existence of a unique constraint covering `(role, permission_id)` for `ON CONFLICT DO NOTHING` to do the right thing (otherwise it relies on a generic conflict target).

**Hardcoded reference values present in this block:**

| value | referenced entity type | referenced column | likely FK sensitive |
|---|---|---|---|
| `'admin'` (cast as `app_role`) | role (enum value) | `role_permissions.role` | yes (enum dependency) |
| `'meetings.edit_summary_date'` | permission name | `permissions.name` (lookup) → `role_permissions.permission_id` | yes (resolves to FK) |

**classification:** `may_fail_on_prod` (silent no-op if `permissions.name = 'meetings.edit_summary_date'` is missing; hard fail if enum value `'admin'` is missing)

**recommended_action:** `KEEP` — wrap in a guard / verify pre-state before running on prod. Optionally rewrite as:

```sql
DO $$
DECLARE
  _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.permissions WHERE name = 'meetings.edit_summary_date';
  IF _pid IS NULL THEN
    RAISE EXCEPTION 'Permission "meetings.edit_summary_date" not found — migration prerequisite missing';
  END IF;
  INSERT INTO public.role_permissions (role, permission_id)
  VALUES ('admin'::app_role, _pid)
  ON CONFLICT DO NOTHING;
END $$;
```

so a missing prerequisite fails loudly rather than silently.

---

### Finding 2

- **migration:** `20260417094746`
- **file:** `20260417094746_7f3b42b1-7a93-45c2-9fd0-b811cf3c8c18.sql`
- **path:** `supabase/migrations/20260417094746_7f3b42b1-7a93-45c2-9fd0-b811cf3c8c18.sql`
- **lines:** 25–30 (env-specific hardcoded values inside the trigger function body — fired by every INSERT/UPDATE/DELETE on `one_on_one_meetings`)
- **purpose:** `CREATE OR REPLACE FUNCTION public.notify_meeting_change()` — trigger function for queueing Bitrix R8 notifications. While the SQL statement itself is DDL, the function body **embeds a project-specific Supabase URL and an anon JWT as a fallback**. Every time the trigger fires on prod, those literals are used to enqueue HTTP POST requests against a hardcoded environment.
- **operation_type:** mixed (DDL `CREATE OR REPLACE FUNCTION` containing env-specific literals invoked from runtime DML triggers; the function itself performs `PERFORM net.http_post(...)`, i.e. data-dependent side effects on every DML)
- **target_tables:** `public.users` (read of `hr_bp_id`); side-effect: `net.http_request_queue` via `net.http_post` to an external URL
- **exact_sql (env-specific block only):**

```sql
  _function_url := 'https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder';
  _anon_key := current_setting('app.settings.anon_key', true);

  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8';
  END IF;
```

- **uses_hardcoded_user_ids:** no
- **uses_hardcoded_reference_ids:** no
- **uses_hardcoded_assignment_or_stage_ids:** no
- **environment_specific_user_or_email:** **yes** — Supabase project URL (`zgbimzuhrsgvfrhlboxy.supabase.co`) and a hardcoded anon JWT (`iss=supabase`, `ref=zgbimzuhrsgvfrhlboxy`, `iat=1750789504`, `exp=2066365504`). Both are tied to a single Supabase project ref and will be wrong on any other environment (or rotated key).
- **can_be_rewritten_with_business_key:** yes — read both values from Vault / GUC / `app.settings.*` exclusively, no inline fallback.
- **suggested_business_key:** none for IDs; for runtime config use Vault secrets (project URL + anon key) loaded via `current_setting('app.settings.supabase_url', true)` / `current_setting('app.settings.anon_key', true)` only.

**Hardcoded environment-specific values present in this block:**

| value | referenced entity type | referenced column | likely FK sensitive |
|---|---|---|---|
| `https://zgbimzuhrsgvfrhlboxy.supabase.co/functions/v1/enqueue-reminder` | URL (Supabase project endpoint) | none (used in `net.http_post`) | no (FK), but env-binding |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnYmltenVocnNndmZyaGxib3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODk1MDQsImV4cCI6MjA2NjM2NTUwNH0.ZbSIQIKdI92VKnQ1XBgX-OjECHCcEeMVLN3uUguFyf8` | token (anon JWT, project ref `zgbimzuhrsgvfrhlboxy`, exp 2035-06-21) | none (passed as `Authorization: Bearer …`) | no (FK), but env-binding & secret-leak |

**classification:** `won't_fail_but_env_specific` (the migration applies cleanly anywhere; but on a non-`zgbimzuhrsgvfrhlboxy` environment the trigger will silently POST to the wrong project and authenticate with the wrong token — every meeting INSERT/UPDATE/DELETE will leak the token to the wrong endpoint and notifications won't fire correctly).

**recommended_action:** `MANUAL` — keep the trigger-function DDL itself, but replace the inline literals with mandatory Vault / GUC lookups (no hardcoded fallback). Per project memory `mem://constraints/supabase-vault-manual-setup`, both `app.settings.supabase_url` and `app.settings.anon_key` must be configured via `ALTER DATABASE … SET …` / Vault before this trigger fires; the inline fallback should be removed so a missing config produces a `RAISE WARNING` instead of leaking the dev anon key.

> Note per audit rules: this finding does **not** mark the whole migration as `CUT`. The function/trigger DDL is not the problem in itself — only the env-specific literal block (lines 25, 29) is risky.

---

## Summary table

| # | migration | recommended_action | classification |
|---|---|---|---|
| 1 | `20260409064932` | KEEP (with optional guard wrapper) | may_fail_on_prod |
| 2 | `20260417094746` | MANUAL (strip inline anon-key/URL fallback, source from Vault only) | won't_fail_but_env_specific |

All other 9 files in the analyzed range contain no risky data-changing or data-dependent SQL.
