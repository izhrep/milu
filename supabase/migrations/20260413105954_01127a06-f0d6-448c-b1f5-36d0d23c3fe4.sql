-- =============================================
-- meeting_summary_comments: тред обсуждения итогов
-- =============================================

CREATE TABLE public.meeting_summary_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX idx_meeting_summary_comments_meeting ON public.meeting_summary_comments(meeting_id);

ALTER TABLE public.meeting_summary_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: participant OR manager subtree OR meetings.view_all
CREATE POLICY "meeting_summary_comments_select" ON public.meeting_summary_comments
  FOR SELECT TO authenticated
  USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_id
        AND is_users_manager(m.employee_id)
    )
    OR has_permission('meetings.view_all')
  );

-- INSERT: participant only, author_id must be self
CREATE POLICY "meeting_summary_comments_insert" ON public.meeting_summary_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_meeting_participant(meeting_id, auth.uid())
  );

-- UPDATE: author only, not deleted
CREATE POLICY "meeting_summary_comments_update" ON public.meeting_summary_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    author_id = auth.uid()
  );

-- =============================================
-- meeting_summary_views: факт ознакомления
-- =============================================

CREATE TABLE public.meeting_summary_views (
  meeting_id uuid NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);

ALTER TABLE public.meeting_summary_views ENABLE ROW LEVEL SECURITY;

-- SELECT: participant OR manager subtree OR meetings.view_all
CREATE POLICY "meeting_summary_views_select" ON public.meeting_summary_views
  FOR SELECT TO authenticated
  USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_id
        AND is_users_manager(m.employee_id)
    )
    OR has_permission('meetings.view_all')
  );

-- INSERT: participant, only for self
CREATE POLICY "meeting_summary_views_insert" ON public.meeting_summary_views
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_meeting_participant(meeting_id, auth.uid())
  );

-- UPDATE: allow upsert (viewed_at refresh)
CREATE POLICY "meeting_summary_views_update" ON public.meeting_summary_views
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- Trigger: protect meeting_summary from overwrite
-- =============================================

CREATE OR REPLACE FUNCTION public.protect_meeting_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when summary is being changed
  IF OLD.meeting_summary IS NOT NULL
     AND OLD.meeting_summary <> ''
     AND NEW.meeting_summary IS DISTINCT FROM OLD.meeting_summary
  THEN
    -- Allow if user has privileged permission
    IF has_permission(auth.uid(), 'meetings.edit_summary_date') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Summary already saved. Use thread for clarifications.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_meeting_summary
  BEFORE UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_meeting_summary();