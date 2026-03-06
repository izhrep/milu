-- ============================================================================
-- ENABLE RLS ON ALL REMAINING TABLES - FINAL VERSION
-- ============================================================================
-- This migration only enables RLS, policies already exist from previous migrations
-- ============================================================================

-- Enable RLS on all tables that don't have it yet
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- All tables now have RLS enabled
-- Policies were created in previous migrations