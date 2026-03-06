-- Enable RLS on meeting tables
ALTER TABLE meeting_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_stage_participants ENABLE ROW LEVEL SECURITY;

-- Policies for meeting_stages
CREATE POLICY "Admins can manage meeting stages"
ON meeting_stages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view meeting stages"
ON meeting_stages
FOR SELECT
TO authenticated
USING (true);

-- Policies for meeting_stage_participants
CREATE POLICY "Admins can manage meeting stage participants"
ON meeting_stage_participants
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own participation"
ON meeting_stage_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));