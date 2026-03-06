-- ============================================================================
-- ENABLE RLS ON ALL TABLES WITH POLICIES
-- ============================================================================
-- Fix "Policy Exists RLS Disabled" errors by enabling RLS
-- ============================================================================

-- Enable RLS on admin_activity_logs
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_achievements  
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_career_progress
ALTER TABLE user_career_progress ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_career_ratings
ALTER TABLE user_career_ratings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_kpi_results
ALTER TABLE user_kpi_results ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_trade_points
ALTER TABLE user_trade_points ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ RLS enabled on all tables that have policies
-- ✅ This fixes "Policy Exists RLS Disabled" errors
-- ✅ Existing policies will now be enforced
-- ============================================================================