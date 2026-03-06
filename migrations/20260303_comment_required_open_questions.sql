-- US-BIZ-008: group-level comment_required
ALTER TABLE answer_categories ADD COLUMN comment_required boolean NOT NULL DEFAULT false;

-- US-BIZ-009: per-question override (NULL = inherit from category)
ALTER TABLE hard_skill_questions ADD COLUMN comment_required_override boolean DEFAULT NULL;
ALTER TABLE soft_skill_questions ADD COLUMN comment_required_override boolean DEFAULT NULL;

-- US-BIZ-010/011: open questions (type-agnostic)
CREATE TABLE open_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE open_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view open questions"
  ON open_questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert open questions"
  ON open_questions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'diagnostics.manage'));

CREATE POLICY "Admins can update open questions"
  ON open_questions FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'diagnostics.manage'));

CREATE POLICY "Admins can delete open questions"
  ON open_questions FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'diagnostics.manage'));

-- US-BIZ-010/011: open question results (hardened)
CREATE TABLE open_question_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_question_id uuid NOT NULL REFERENCES open_questions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES survey_360_assignments(id) ON DELETE CASCADE,
  diagnostic_stage_id uuid NOT NULL REFERENCES diagnostic_stages(id) ON DELETE CASCADE,
  evaluating_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evaluated_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  is_draft boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_assignment_open_question UNIQUE (assignment_id, open_question_id)
);
ALTER TABLE open_question_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluator can insert own results"
  ON open_question_results FOR INSERT TO authenticated
  WITH CHECK (
    evaluating_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM survey_360_assignments a
      WHERE a.id = assignment_id
        AND a.evaluating_user_id = auth.uid()
        AND a.evaluated_user_id = evaluated_user_id
        AND a.diagnostic_stage_id = diagnostic_stage_id
    )
  );

CREATE POLICY "Participants and admins can view results"
  ON open_question_results FOR SELECT TO authenticated
  USING (
    evaluating_user_id = auth.uid()
    OR evaluated_user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'diagnostics.manage')
  );

CREATE POLICY "Evaluator can update own results"
  ON open_question_results FOR UPDATE TO authenticated
  USING (evaluating_user_id = auth.uid())
  WITH CHECK (
    evaluating_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM survey_360_assignments a
      WHERE a.id = assignment_id
        AND a.evaluating_user_id = auth.uid()
        AND a.evaluated_user_id = evaluated_user_id
        AND a.diagnostic_stage_id = diagnostic_stage_id
    )
  );
