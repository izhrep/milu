-- ============================================
-- Security Fix: Add search_path to functions missing it
-- This prevents SQL injection via schema shadowing
-- ============================================

-- Fix get_stage_status_by_dates
ALTER FUNCTION public.get_stage_status_by_dates(date, date)
SET search_path = public;

-- Fix is_stage_expired (date version)
ALTER FUNCTION public.is_stage_expired(date)
SET search_path = public;

-- Fix prevent_delete_used_hard_subcategory
ALTER FUNCTION public.prevent_delete_used_hard_subcategory()
SET search_path = public;

-- Fix prevent_delete_used_soft_subcategory
ALTER FUNCTION public.prevent_delete_used_soft_subcategory()
SET search_path = public;

-- Fix update_updated_at_column
ALTER FUNCTION public.update_updated_at_column()
SET search_path = public;

-- Fix validate_hard_skill_subcategory
ALTER FUNCTION public.validate_hard_skill_subcategory()
SET search_path = public;

-- Fix validate_soft_skill_subcategory
ALTER FUNCTION public.validate_soft_skill_subcategory()
SET search_path = public;