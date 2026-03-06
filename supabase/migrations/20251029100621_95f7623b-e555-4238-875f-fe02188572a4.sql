-- Enable RLS and create policies for existing tables

-- Reference tables - everyone can view
CREATE POLICY "Everyone can view achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Everyone can view certifications" ON public.certifications FOR SELECT USING (true);
CREATE POLICY "Everyone can view competency_levels" ON public.competency_levels FOR SELECT USING (true);
CREATE POLICY "Everyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Everyone can view development_tasks" ON public.development_tasks FOR SELECT USING (true);
CREATE POLICY "Everyone can view grades" ON public.grades FOR SELECT USING (true);
CREATE POLICY "Everyone can view grade_qualities" ON public.grade_qualities FOR SELECT USING (true);
CREATE POLICY "Everyone can view manufacturers" ON public.manufacturers FOR SELECT USING (true);
CREATE POLICY "Everyone can view positions" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Everyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Everyone can view product_matrix" ON public.product_matrix FOR SELECT USING (true);
CREATE POLICY "Everyone can view qualities" ON public.qualities FOR SELECT USING (true);
CREATE POLICY "Everyone can view sprint_types" ON public.sprint_types FOR SELECT USING (true);
CREATE POLICY "Everyone can view track_types" ON public.track_types FOR SELECT USING (true);
CREATE POLICY "Everyone can view trade_points" ON public.trade_points FOR SELECT USING (true);
CREATE POLICY "Everyone can view career_tracks" ON public.career_tracks FOR SELECT USING (true);
CREATE POLICY "Everyone can view career_track_steps" ON public.career_track_steps FOR SELECT USING (true);
CREATE POLICY "Everyone can view kpi_targets" ON public.kpi_targets FOR SELECT USING (true);
CREATE POLICY "Everyone can view role_permissions" ON public.role_permissions FOR SELECT USING (true);

-- Diagnostic stages - everyone can view
CREATE POLICY "Everyone can view diagnostic_stages" ON public.diagnostic_stages FOR SELECT USING (true);
CREATE POLICY "Everyone can view diagnostic_stage_participants" ON public.diagnostic_stage_participants FOR SELECT USING (true);

-- Meeting stages - everyone can view
CREATE POLICY "Everyone can view meeting_stages" ON public.meeting_stages FOR SELECT USING (true);
CREATE POLICY "Everyone can view meeting_stage_participants" ON public.meeting_stage_participants FOR SELECT USING (true);

-- One-on-one meetings
CREATE POLICY "Users can view their meetings"
ON public.one_on_one_meetings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = one_on_one_meetings.employee_id
      OR admin_sessions.user_id = one_on_one_meetings.manager_id
  )
);

CREATE POLICY "Users can manage their meetings"
ON public.one_on_one_meetings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = one_on_one_meetings.employee_id
      OR admin_sessions.user_id = one_on_one_meetings.manager_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = one_on_one_meetings.employee_id
      OR admin_sessions.user_id = one_on_one_meetings.manager_id
  )
);

-- Meeting decisions
CREATE POLICY "Users can view meeting decisions" ON public.meeting_decisions FOR SELECT USING (true);
CREATE POLICY "Users can manage meeting decisions" ON public.meeting_decisions FOR ALL USING (true) WITH CHECK (true);

-- Development plans
CREATE POLICY "Everyone can view development_plans" ON public.development_plans FOR SELECT USING (true);

-- Tasks
CREATE POLICY "Users can view their tasks"
ON public.tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = tasks.user_id
  )
);

CREATE POLICY "Users can manage their tasks"
ON public.tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = tasks.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = tasks.user_id
  )
);

-- Sprints
CREATE POLICY "Everyone can view sprints" ON public.sprints FOR SELECT USING (true);
CREATE POLICY "Everyone can view sprint_assignments" ON public.sprint_assignments FOR SELECT USING (true);
CREATE POLICY "Everyone can view sprint_sales_results" ON public.sprint_sales_results FOR SELECT USING (true);

-- User data
CREATE POLICY "Users can view their achievements"
ON public.user_achievements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE admin_sessions.user_id = user_achievements.user_id
  )
);

CREATE POLICY "Users can view assessment results" ON public.user_assessment_results FOR SELECT USING (true);
CREATE POLICY "Users can insert assessment results" ON public.user_assessment_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view career progress" ON public.user_career_progress FOR SELECT USING (true);
CREATE POLICY "Users can manage career progress" ON public.user_career_progress FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Everyone can view career ratings" ON public.user_career_ratings FOR SELECT USING (true);

CREATE POLICY "Users can view KPI results" ON public.user_kpi_results FOR SELECT USING (true);

CREATE POLICY "Users can view qualities" ON public.user_qualities FOR SELECT USING (true);
CREATE POLICY "Users can insert qualities" ON public.user_qualities FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update qualities" ON public.user_qualities FOR UPDATE USING (true);

CREATE POLICY "Everyone can view user_roles" ON public.user_roles FOR SELECT USING (true);

CREATE POLICY "Users can view trade points" ON public.user_trade_points FOR SELECT USING (true);