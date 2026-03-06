-- Add INSERT, UPDATE, DELETE policies for admin users on reference tables

-- Position Categories
CREATE POLICY "Admins can insert position_categories"
ON public.position_categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update position_categories"
ON public.position_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete position_categories"
ON public.position_categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Positions
CREATE POLICY "Admins can insert positions"
ON public.positions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update positions"
ON public.positions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete positions"
ON public.positions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Departments
CREATE POLICY "Admins can insert departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete departments"
ON public.departments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Grades
CREATE POLICY "Admins can insert grades"
ON public.grades
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update grades"
ON public.grades
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete grades"
ON public.grades
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Skills
CREATE POLICY "Admins can insert skills"
ON public.skills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update skills"
ON public.skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete skills"
ON public.skills
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Qualities
CREATE POLICY "Admins can insert qualities"
ON public.qualities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update qualities"
ON public.qualities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete qualities"
ON public.qualities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Category Skills
CREATE POLICY "Admins can insert category_skills"
ON public.category_skills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update category_skills"
ON public.category_skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete category_skills"
ON public.category_skills
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Certifications
CREATE POLICY "Admins can insert certifications"
ON public.certifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update certifications"
ON public.certifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete certifications"
ON public.certifications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Competency Levels
CREATE POLICY "Admins can insert competency_levels"
ON public.competency_levels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update competency_levels"
ON public.competency_levels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete competency_levels"
ON public.competency_levels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Track Types
CREATE POLICY "Admins can insert track_types"
ON public.track_types
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update track_types"
ON public.track_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete track_types"
ON public.track_types
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Career Tracks
CREATE POLICY "Admins can insert career_tracks"
ON public.career_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update career_tracks"
ON public.career_tracks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete career_tracks"
ON public.career_tracks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Career Track Steps
CREATE POLICY "Admins can insert career_track_steps"
ON public.career_track_steps
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update career_track_steps"
ON public.career_track_steps
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete career_track_steps"
ON public.career_track_steps
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Grade Skills
CREATE POLICY "Admins can insert grade_skills"
ON public.grade_skills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update grade_skills"
ON public.grade_skills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete grade_skills"
ON public.grade_skills
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Grade Qualities
CREATE POLICY "Admins can insert grade_qualities"
ON public.grade_qualities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update grade_qualities"
ON public.grade_qualities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete grade_qualities"
ON public.grade_qualities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Development Tasks
CREATE POLICY "Admins can insert development_tasks"
ON public.development_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update development_tasks"
ON public.development_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete development_tasks"
ON public.development_tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Hard Skill Answer Options
CREATE POLICY "Admins can insert hard_skill_answer_options"
ON public.hard_skill_answer_options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update hard_skill_answer_options"
ON public.hard_skill_answer_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete hard_skill_answer_options"
ON public.hard_skill_answer_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Hard Skill Questions
CREATE POLICY "Admins can insert hard_skill_questions"
ON public.hard_skill_questions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update hard_skill_questions"
ON public.hard_skill_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete hard_skill_questions"
ON public.hard_skill_questions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Soft Skill Answer Options
CREATE POLICY "Admins can insert soft_skill_answer_options"
ON public.soft_skill_answer_options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update soft_skill_answer_options"
ON public.soft_skill_answer_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete soft_skill_answer_options"
ON public.soft_skill_answer_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Soft Skill Questions
CREATE POLICY "Admins can insert soft_skill_questions"
ON public.soft_skill_questions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update soft_skill_questions"
ON public.soft_skill_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete soft_skill_questions"
ON public.soft_skill_questions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Trade Points
CREATE POLICY "Admins can insert trade_points"
ON public.trade_points
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update trade_points"
ON public.trade_points
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete trade_points"
ON public.trade_points
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Manufacturers
CREATE POLICY "Admins can insert manufacturers"
ON public.manufacturers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update manufacturers"
ON public.manufacturers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete manufacturers"
ON public.manufacturers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);