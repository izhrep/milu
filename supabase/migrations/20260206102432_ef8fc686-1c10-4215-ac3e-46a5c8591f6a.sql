-- ============================================
-- PHASE 1: Migrate RLS policies from public to authenticated
-- Based on actual policy names from database
-- ============================================

-- answer_categories (4 policies)
ALTER POLICY "Anyone can view answer_categories" ON answer_categories TO authenticated;
ALTER POLICY "Admins can insert answer_categories" ON answer_categories TO authenticated;
ALTER POLICY "Admins can update answer_categories" ON answer_categories TO authenticated;
ALTER POLICY "Admins can delete answer_categories" ON answer_categories TO authenticated;

-- career_track_steps (1 policy)
ALTER POLICY "career_track_steps_select_policy" ON career_track_steps TO authenticated;

-- career_tracks (1 policy)
ALTER POLICY "career_tracks_select_policy" ON career_tracks TO authenticated;

-- category_hard_skills (1 policy)
ALTER POLICY "category_skills_select_policy" ON category_hard_skills TO authenticated;

-- category_soft_skills (4 policies)
ALTER POLICY "Anyone can view category_soft_skills" ON category_soft_skills TO authenticated;
ALTER POLICY "Admins can insert category_soft_skills" ON category_soft_skills TO authenticated;
ALTER POLICY "Admins can update category_soft_skills" ON category_soft_skills TO authenticated;
ALTER POLICY "Admins can delete category_soft_skills" ON category_soft_skills TO authenticated;

-- certifications (1 policy)
ALTER POLICY "certifications_select_policy" ON certifications TO authenticated;

-- competency_levels (1 policy)
ALTER POLICY "competency_levels_select_policy" ON competency_levels TO authenticated;

-- departments (1 policy)
ALTER POLICY "departments_select_policy" ON departments TO authenticated;

-- development_plan_tasks (4 policies)
ALTER POLICY "Users can view own development plan tasks" ON development_plan_tasks TO authenticated;
ALTER POLICY "Users can create own development plan tasks" ON development_plan_tasks TO authenticated;
ALTER POLICY "Users can update own development plan tasks" ON development_plan_tasks TO authenticated;
ALTER POLICY "Users can delete own development plan tasks" ON development_plan_tasks TO authenticated;

-- development_plans (3 policies)
ALTER POLICY "development_plans_select_auth_policy" ON development_plans TO authenticated;
ALTER POLICY "development_plans_insert_auth_policy" ON development_plans TO authenticated;
ALTER POLICY "development_plans_update_auth_policy" ON development_plans TO authenticated;

-- development_tasks (1 policy)
ALTER POLICY "development_tasks_select_policy" ON development_tasks TO authenticated;

-- diagnostic_stage_participants (4 policies)
ALTER POLICY "Users can view diagnostic participants" ON diagnostic_stage_participants TO authenticated;
ALTER POLICY "Users with manage_participants can add participants" ON diagnostic_stage_participants TO authenticated;
ALTER POLICY "Users with manage_participants can update participants" ON diagnostic_stage_participants TO authenticated;
ALTER POLICY "Users with manage_participants can delete participants" ON diagnostic_stage_participants TO authenticated;

-- diagnostic_stages (7 policies)
ALTER POLICY "Users with diagnostics.view can view stages" ON diagnostic_stages TO authenticated;
ALTER POLICY "Users with diagnostics.create can create stages" ON diagnostic_stages TO authenticated;
ALTER POLICY "Users with diagnostics.update can update stages" ON diagnostic_stages TO authenticated;
ALTER POLICY "Users with diagnostics.delete can delete stages" ON diagnostic_stages TO authenticated;
ALTER POLICY "diagnostic_stages_select_auth_policy" ON diagnostic_stages TO authenticated;
ALTER POLICY "diagnostic_stages_insert_auth_policy" ON diagnostic_stages TO authenticated;
ALTER POLICY "diagnostic_stages_update_auth_policy" ON diagnostic_stages TO authenticated;

-- grade_qualities (1 policy)
ALTER POLICY "grade_qualities_select_policy" ON grade_qualities TO authenticated;

-- grade_skills (1 policy)
ALTER POLICY "grade_skills_select_policy" ON grade_skills TO authenticated;

-- grades (1 policy)
ALTER POLICY "grades_select_policy" ON grades TO authenticated;

-- hard_skill_answer_options (1 policy)
ALTER POLICY "hard_skill_answer_options_select_policy" ON hard_skill_answer_options TO authenticated;

-- hard_skill_questions (1 policy)
ALTER POLICY "hard_skill_questions_select_policy" ON hard_skill_questions TO authenticated;

-- hard_skill_results (3 policies)
ALTER POLICY "hard_skill_results_select_auth_policy" ON hard_skill_results TO authenticated;
ALTER POLICY "hard_skill_results_insert_auth_policy" ON hard_skill_results TO authenticated;
ALTER POLICY "hard_skill_results_update_auth_policy" ON hard_skill_results TO authenticated;

-- hard_skills (1 policy)
ALTER POLICY "skills_select_policy" ON hard_skills TO authenticated;

-- manufacturers (1 policy)
ALTER POLICY "manufacturers_select_policy" ON manufacturers TO authenticated;

-- meeting_decisions (3 policies)
ALTER POLICY "meeting_decisions_select_auth_policy" ON meeting_decisions TO authenticated;
ALTER POLICY "meeting_decisions_insert_auth_policy" ON meeting_decisions TO authenticated;
ALTER POLICY "meeting_decisions_update_auth_policy" ON meeting_decisions TO authenticated;

-- one_on_one_meetings (2 policies)
ALTER POLICY "one_on_one_meetings_select_auth_policy" ON one_on_one_meetings TO authenticated;
ALTER POLICY "one_on_one_meetings_update_auth_policy" ON one_on_one_meetings TO authenticated;

-- permission_group_permissions (1 policy)
ALTER POLICY "Anyone can view permission group mappings" ON permission_group_permissions TO authenticated;

-- permission_groups (1 policy)
ALTER POLICY "Anyone can view permission groups" ON permission_groups TO authenticated;

-- permissions (1 policy)
ALTER POLICY "Allow all read access to permissions" ON permissions TO authenticated;

-- position_categories (1 policy)
ALTER POLICY "position_categories_select_policy" ON position_categories TO authenticated;

-- positions (1 policy)
ALTER POLICY "positions_select_policy" ON positions TO authenticated;

-- role_permissions (1 policy)
ALTER POLICY "Everyone can view role_permissions" ON role_permissions TO authenticated;

-- soft_skill_answer_options (1 policy)
ALTER POLICY "soft_skill_answer_options_select_policy" ON soft_skill_answer_options TO authenticated;

-- soft_skill_questions (1 policy)
ALTER POLICY "soft_skill_questions_select_policy" ON soft_skill_questions TO authenticated;

-- soft_skill_results (3 policies)
ALTER POLICY "soft_skill_results_select_auth_policy" ON soft_skill_results TO authenticated;
ALTER POLICY "soft_skill_results_insert_auth_policy" ON soft_skill_results TO authenticated;
ALTER POLICY "soft_skill_results_update_auth_policy" ON soft_skill_results TO authenticated;

-- soft_skills (1 policy)
ALTER POLICY "qualities_select_policy" ON soft_skills TO authenticated;

-- sub_category_hard_skills (4 policies)
ALTER POLICY "Anyone can view sub_category_hard_skills" ON sub_category_hard_skills TO authenticated;
ALTER POLICY "Admins can insert sub_category_hard_skills" ON sub_category_hard_skills TO authenticated;
ALTER POLICY "Admins can update sub_category_hard_skills" ON sub_category_hard_skills TO authenticated;
ALTER POLICY "Admins can delete sub_category_hard_skills" ON sub_category_hard_skills TO authenticated;

-- sub_category_soft_skills (4 policies)
ALTER POLICY "Anyone can view sub_category_soft_skills" ON sub_category_soft_skills TO authenticated;
ALTER POLICY "Admins can insert sub_category_soft_skills" ON sub_category_soft_skills TO authenticated;
ALTER POLICY "Admins can update sub_category_soft_skills" ON sub_category_soft_skills TO authenticated;
ALTER POLICY "Admins can delete sub_category_soft_skills" ON sub_category_soft_skills TO authenticated;

-- survey_360_assignments (4 policies)
ALTER POLICY "survey_360_assignments_select_policy" ON survey_360_assignments TO authenticated;
ALTER POLICY "survey_360_assignments_insert_policy" ON survey_360_assignments TO authenticated;
ALTER POLICY "survey_360_assignments_update_policy" ON survey_360_assignments TO authenticated;
ALTER POLICY "survey_360_assignments_delete_policy" ON survey_360_assignments TO authenticated;

-- tasks (2 policies)
ALTER POLICY "tasks_insert_auth_policy" ON tasks TO authenticated;
ALTER POLICY "tasks_delete_auth_policy" ON tasks TO authenticated;

-- track_types (1 policy)
ALTER POLICY "track_types_select_policy" ON track_types TO authenticated;

-- trade_points (1 policy)
ALTER POLICY "trade_points_select_policy" ON trade_points TO authenticated;

-- user_assessment_results (1 policy)
ALTER POLICY "user_assessment_results_select_auth_policy" ON user_assessment_results TO authenticated;

-- users (2 policies)
ALTER POLICY "users_can_view_evaluated_peers" ON users TO authenticated;
ALTER POLICY "users_can_view_for_peer_selection" ON users TO authenticated;