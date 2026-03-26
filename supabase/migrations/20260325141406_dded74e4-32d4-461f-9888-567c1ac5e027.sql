
-- Drop and recreate foreign key constraints with CASCADE/SET NULL for user deletion

-- diagnostic_user_snapshots → CASCADE (snapshot data, safe to delete with user)
ALTER TABLE public.diagnostic_user_snapshots
  DROP CONSTRAINT IF EXISTS diagnostic_user_snapshots_entity_id_fkey,
  ADD CONSTRAINT diagnostic_user_snapshots_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- diagnostic_result_snapshots → CASCADE
ALTER TABLE public.diagnostic_result_snapshots
  DROP CONSTRAINT IF EXISTS diagnostic_result_snapshots_evaluated_user_id_fkey,
  ADD CONSTRAINT diagnostic_result_snapshots_evaluated_user_id_fkey
    FOREIGN KEY (evaluated_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- diagnostic_snapshot_jobs → CASCADE
ALTER TABLE public.diagnostic_snapshot_jobs
  DROP CONSTRAINT IF EXISTS diagnostic_snapshot_jobs_evaluated_user_id_fkey,
  ADD CONSTRAINT diagnostic_snapshot_jobs_evaluated_user_id_fkey
    FOREIGN KEY (evaluated_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- audit_log → SET NULL (keep logs, remove user reference)
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_admin_id_fkey,
  ADD CONSTRAINT audit_log_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_user_id_fkey,
  ADD CONSTRAINT audit_log_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- access_denied_logs → SET NULL
ALTER TABLE public.access_denied_logs
  DROP CONSTRAINT IF EXISTS access_denied_logs_user_id_fkey,
  ADD CONSTRAINT access_denied_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- development_plans → SET NULL
ALTER TABLE public.development_plans
  DROP CONSTRAINT IF EXISTS development_plans_user_id_fkey,
  ADD CONSTRAINT development_plans_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.development_plans
  DROP CONSTRAINT IF EXISTS development_plans_created_by_fkey,
  ADD CONSTRAINT development_plans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- development_plan_tasks → CASCADE
ALTER TABLE public.development_plan_tasks
  DROP CONSTRAINT IF EXISTS development_plan_tasks_user_id_fkey,
  ADD CONSTRAINT development_plan_tasks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- diagnostic_config_templates → SET NULL (keep templates)
ALTER TABLE public.diagnostic_config_templates
  DROP CONSTRAINT IF EXISTS diagnostic_config_templates_created_by_fkey,
  ADD CONSTRAINT diagnostic_config_templates_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Make audit_log.admin_id nullable for SET NULL to work
ALTER TABLE public.audit_log ALTER COLUMN admin_id DROP NOT NULL;

-- Make diagnostic_config_templates.created_by nullable for SET NULL to work
ALTER TABLE public.diagnostic_config_templates ALTER COLUMN created_by DROP NOT NULL;
