-- Step 1: Add new enum values
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'hr_bp';