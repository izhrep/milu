-- ============================================================================
-- RLS SETUP FOR CAREER TRACKS AND QUALITIES TABLES
-- ============================================================================
-- Enable RLS and create proper role-based policies
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE RLS
-- ============================================================================

ALTER TABLE career_track_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: DROP EXISTING POLICIES
-- ============================================================================

-- career_track_steps
DROP POLICY IF EXISTS "Admins can manage career_track_steps" ON career_track_steps;
DROP POLICY IF EXISTS "Everyone can view career_track_steps" ON career_track_steps;

-- career_tracks
DROP POLICY IF EXISTS "Admins can manage career_tracks" ON career_tracks;
DROP POLICY IF EXISTS "Everyone can view career_tracks" ON career_tracks;

-- grade_qualities
DROP POLICY IF EXISTS "Admins can manage grade_qualities" ON grade_qualities;
DROP POLICY IF EXISTS "Everyone can view grade_qualities" ON grade_qualities;

-- qualities
DROP POLICY IF EXISTS "Admins can manage qualities" ON qualities;
DROP POLICY IF EXISTS "Everyone can view qualities" ON qualities;

-- ============================================================================
-- PART 3: CREATE POLICIES FOR career_tracks
-- ============================================================================

-- Admins/HR have full access
CREATE POLICY "Admins can manage career_tracks"
ON career_tracks
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Everyone can view career tracks (public reference data)
CREATE POLICY "Everyone can view career_tracks"
ON career_tracks
FOR SELECT
USING (true);

-- ============================================================================
-- PART 4: CREATE POLICIES FOR career_track_steps
-- ============================================================================

-- Admins/HR have full access
CREATE POLICY "Admins can manage career_track_steps"
ON career_track_steps
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Everyone can view career track steps (public reference data)
CREATE POLICY "Everyone can view career_track_steps"
ON career_track_steps
FOR SELECT
USING (true);

-- ============================================================================
-- PART 5: CREATE POLICIES FOR qualities
-- ============================================================================

-- Admins/HR have full access
CREATE POLICY "Admins can manage qualities"
ON qualities
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Everyone can view qualities (public reference data)
CREATE POLICY "Everyone can view qualities"
ON qualities
FOR SELECT
USING (true);

-- ============================================================================
-- PART 6: CREATE POLICIES FOR grade_qualities
-- ============================================================================

-- Admins/HR have full access
CREATE POLICY "Admins can manage grade_qualities"
ON grade_qualities
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Everyone can view grade qualities (public reference data)
CREATE POLICY "Everyone can view grade_qualities"
ON grade_qualities
FOR SELECT
USING (true);

-- ============================================================================
-- PART 7: UPDATE RELATED FUNCTIONS WITH SECURITY DEFINER
-- ============================================================================

-- No specific functions to update for these tables
-- All existing diagnostic functions are already SECURITY DEFINER

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- ✅ RLS enabled on all career and quality tables
-- ✅ Admins have full access (SELECT, INSERT, UPDATE, DELETE)
-- ✅ All users can view reference data (public read)
-- ✅ No manager-specific access needed (reference data is public)
-- ✅ All policies use is_current_user_admin() based on admin_sessions
-- ============================================================================