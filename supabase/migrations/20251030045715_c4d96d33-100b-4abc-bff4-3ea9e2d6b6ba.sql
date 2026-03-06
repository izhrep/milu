-- ============================================================================
-- ENABLE RLS ON FINAL REMAINING TABLES - NO POLICY CREATION
-- ============================================================================

ALTER TABLE meeting_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_stage_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_on_one_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- All tables now have RLS enabled