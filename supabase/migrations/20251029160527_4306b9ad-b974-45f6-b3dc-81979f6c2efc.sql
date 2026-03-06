
-- Drop unused tables in correct order (respecting foreign key dependencies)

-- 1. Drop sprint_sales_results (depends on sprint_assignments)
DROP TABLE IF EXISTS public.sprint_sales_results CASCADE;

-- 2. Drop sprint_assignments (depends on sprints, trade_points)
DROP TABLE IF EXISTS public.sprint_assignments CASCADE;

-- 3. Drop sprints (depends on sprint_types, products, manufacturers)
DROP TABLE IF EXISTS public.sprints CASCADE;

-- 4. Drop sprint_types
DROP TABLE IF EXISTS public.sprint_types CASCADE;

-- 5. Drop product_matrix (depends on products, trade_points)
DROP TABLE IF EXISTS public.product_matrix CASCADE;

-- 6. Drop products (depends on manufacturers)
DROP TABLE IF EXISTS public.products CASCADE;

-- 7. Drop kpi_targets
DROP TABLE IF EXISTS public.kpi_targets CASCADE;

-- 8. Drop achievements
DROP TABLE IF EXISTS public.achievements CASCADE;

-- 9. Drop survey_360_selections
DROP TABLE IF EXISTS public.survey_360_selections CASCADE;

-- 10. Drop assignment_details view
DROP VIEW IF EXISTS public.assignment_details CASCADE;
