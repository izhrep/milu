-- =====================================================
-- КОМПЛЕКСНАЯ МИГРАЦИЯ: Исправление всех политик с auth.uid()
-- для работы с кастомной авторизацией через public.auth_users
-- Часть 2: Оставшиеся таблицы
-- =====================================================

-- ======= ТАБЛИЦА: achievements (если еще не исправлена) =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage achievements" ON achievements;
  DROP POLICY IF EXISTS "Everyone can view achievements" ON achievements;
  DROP POLICY IF EXISTS "Allow all read access to achievements" ON achievements;
  DROP POLICY IF EXISTS "Allow all write access to achievements" ON achievements;

  CREATE POLICY "Allow all read access to achievements"
  ON achievements FOR SELECT
  USING (true);

  CREATE POLICY "Allow all write access to achievements"
  ON achievements FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: survey_360_selections =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all selections" ON survey_360_selections;
  DROP POLICY IF EXISTS "Allow all operations for testing survey selections" ON survey_360_selections;
  DROP POLICY IF EXISTS "Users can manage their own selections" ON survey_360_selections;
  DROP POLICY IF EXISTS "Allow all access to survey_360_selections" ON survey_360_selections;

  CREATE POLICY "Allow all access to survey_360_selections"
  ON survey_360_selections FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: one_on_one_meetings =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can update all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Admins can view all meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can create their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can update their draft or returned meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Employees can view their own meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can update subordinate meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Managers can view their subordinates' meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all read access to one_on_one_meetings" ON one_on_one_meetings;
  DROP POLICY IF EXISTS "Allow all write access to one_on_one_meetings" ON one_on_one_meetings;

  CREATE POLICY "Allow all read access to one_on_one_meetings"
  ON one_on_one_meetings FOR SELECT
  USING (true);

  CREATE POLICY "Allow all write access to one_on_one_meetings"
  ON one_on_one_meetings FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_trade_points =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_trade_points" ON user_trade_points;
  DROP POLICY IF EXISTS "Allow all operations for testing user_trade_points" ON user_trade_points;
  DROP POLICY IF EXISTS "Users can view their own trade point assignments" ON user_trade_points;
  DROP POLICY IF EXISTS "Allow all access to user_trade_points" ON user_trade_points;

  CREATE POLICY "Allow all access to user_trade_points"
  ON user_trade_points FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_qualities =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can update their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Users can view their own qualities" ON user_qualities;
  DROP POLICY IF EXISTS "Allow all access to user_qualities" ON user_qualities;

  CREATE POLICY "Allow all access to user_qualities"
  ON user_qualities FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: tasks =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all tasks" ON tasks;
  DROP POLICY IF EXISTS "System can create and update tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;

  CREATE POLICY "Allow all access to tasks"
  ON tasks FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_achievements =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_achievements" ON user_achievements;
  DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
  DROP POLICY IF EXISTS "Allow all access to user_achievements" ON user_achievements;

  CREATE POLICY "Allow all access to user_achievements"
  ON user_achievements FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: survey_360_assignments =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "System can update assignment status" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can create assignments as evaluated user" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can manage survey assignments" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Users can view assignments involving them" ON survey_360_assignments;
  DROP POLICY IF EXISTS "Allow all access to survey_360_assignments" ON survey_360_assignments;

  CREATE POLICY "Allow all access to survey_360_assignments"
  ON survey_360_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_career_progress =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow user_career_progress operations for admin panel" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can create their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can update their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Users can view their own career progress" ON user_career_progress;
  DROP POLICY IF EXISTS "Allow all access to user_career_progress" ON user_career_progress;

  CREATE POLICY "Allow all access to user_career_progress"
  ON user_career_progress FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: sprint_assignments =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins manage sprint_assignments" ON sprint_assignments;
  DROP POLICY IF EXISTS "Allow all access to sprint_assignments" ON sprint_assignments;

  CREATE POLICY "Allow all access to sprint_assignments"
  ON sprint_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: meeting_stage_participants =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage meeting stage participants" ON meeting_stage_participants;
  DROP POLICY IF EXISTS "Users can view their own participation" ON meeting_stage_participants;
  DROP POLICY IF EXISTS "Allow all access to meeting_stage_participants" ON meeting_stage_participants;

  CREATE POLICY "Allow all access to meeting_stage_participants"
  ON meeting_stage_participants FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_skills =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can update their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can view their own skills" ON user_skills;
  DROP POLICY IF EXISTS "Allow all access to user_skills" ON user_skills;

  CREATE POLICY "Allow all access to user_skills"
  ON user_skills FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: audit_log =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_log;
  DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_log;
  DROP POLICY IF EXISTS "Allow all read access to audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Allow all insert access to audit_log" ON audit_log;

  CREATE POLICY "Allow all read access to audit_log"
  ON audit_log FOR SELECT
  USING (true);

  CREATE POLICY "Allow all insert access to audit_log"
  ON audit_log FOR INSERT
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: user_assessment_results =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all assessment results" ON user_assessment_results;
  DROP POLICY IF EXISTS "Users can view their own assessment results" ON user_assessment_results;
  DROP POLICY IF EXISTS "Allow all access to user_assessment_results" ON user_assessment_results;

  CREATE POLICY "Allow all access to user_assessment_results"
  ON user_assessment_results FOR ALL
  USING (true)
  WITH CHECK (true);
END $$;

-- ======= ТАБЛИЦА: admin_activity_logs =======
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can insert activity logs" ON admin_activity_logs;
  DROP POLICY IF EXISTS "Admins can view activity logs" ON admin_activity_logs;
  DROP POLICY IF EXISTS "Allow all read access to admin_activity_logs" ON admin_activity_logs;
  DROP POLICY IF EXISTS "Allow all insert access to admin_activity_logs" ON admin_activity_logs;

  CREATE POLICY "Allow all read access to admin_activity_logs"
  ON admin_activity_logs FOR SELECT
  USING (true);

  CREATE POLICY "Allow all insert access to admin_activity_logs"
  ON admin_activity_logs FOR INSERT
  WITH CHECK (true);
END $$;