-- 1. Create meeting_status_events table
CREATE TABLE public.meeting_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid,
  change_source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by meeting
CREATE INDEX idx_meeting_status_events_meeting_id ON public.meeting_status_events(meeting_id);

-- 2. Enable RLS — SELECT only for participants or meetings.view_all
ALTER TABLE public.meeting_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting participants can view status events"
  ON public.meeting_status_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_id
        AND (m.employee_id = auth.uid() OR m.manager_id = auth.uid())
    )
    OR public.has_permission(auth.uid(), 'meetings.view_all')
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — trigger-only writes

-- 3. Trigger function to log status transitions
CREATE OR REPLACE FUNCTION public.log_meeting_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.meeting_status_events (meeting_id, previous_status, new_status, changed_by, change_source)
    VALUES (
      NEW.id,
      NULL,
      NEW.status,
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.meeting_status_events (meeting_id, previous_status, new_status, changed_by, change_source)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger AFTER INSERT OR UPDATE on one_on_one_meetings
CREATE TRIGGER trg_log_meeting_status_event
  AFTER INSERT OR UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_meeting_status_event();