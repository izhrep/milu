
CREATE TABLE public.meeting_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  previous_date timestamptz NOT NULL,
  new_date timestamptz NOT NULL,
  rescheduled_by uuid NOT NULL REFERENCES public.users(id),
  rescheduled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager and HR can view reschedules"
  ON public.meeting_reschedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_id
        AND (m.manager_id = auth.uid()
             OR public.has_permission(auth.uid(), 'meetings.view_all'))
    )
  );

CREATE POLICY "Meeting participants can insert reschedules"
  ON public.meeting_reschedules FOR INSERT TO authenticated
  WITH CHECK (
    rescheduled_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = meeting_id
        AND (m.employee_id = auth.uid() OR m.manager_id = auth.uid())
    )
  );
