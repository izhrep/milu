-- Исправляем RLS политики для meeting_stages и meeting_stage_participants
-- Используем существующие permissions: meetings.create, meetings.view, meetings.update

-- 1. Удаляем старые политики для meeting_stages
DROP POLICY IF EXISTS "meeting_stages_insert_auth_policy" ON meeting_stages;
DROP POLICY IF EXISTS "meeting_stages_select_auth_policy" ON meeting_stages;
DROP POLICY IF EXISTS "meeting_stages_update_auth_policy" ON meeting_stages;

-- 2. Создаем новые политики для meeting_stages
CREATE POLICY "meeting_stages_insert_auth_policy" 
ON meeting_stages 
FOR INSERT 
TO authenticated
WITH CHECK (has_permission('meetings.create'));

CREATE POLICY "meeting_stages_select_auth_policy" 
ON meeting_stages 
FOR SELECT 
TO authenticated
USING (
  is_meeting_stage_participant(id, auth.uid()) OR 
  has_permission('meetings.view')
);

CREATE POLICY "meeting_stages_update_auth_policy" 
ON meeting_stages 
FOR UPDATE 
TO authenticated
USING (has_permission('meetings.update'));

-- 3. Удаляем старые политики для meeting_stage_participants
DROP POLICY IF EXISTS "meeting_stage_participants_delete_auth_policy" ON meeting_stage_participants;
DROP POLICY IF EXISTS "meeting_stage_participants_insert_auth_policy" ON meeting_stage_participants;
DROP POLICY IF EXISTS "meeting_stage_participants_select_auth_policy" ON meeting_stage_participants;

-- 4. Создаем новые политики для meeting_stage_participants
CREATE POLICY "meeting_stage_participants_insert_auth_policy" 
ON meeting_stage_participants 
FOR INSERT 
TO authenticated
WITH CHECK (has_permission('meetings.create'));

CREATE POLICY "meeting_stage_participants_select_auth_policy" 
ON meeting_stage_participants 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() OR 
  has_permission('meetings.view')
);

CREATE POLICY "meeting_stage_participants_delete_auth_policy" 
ON meeting_stage_participants 
FOR DELETE 
TO authenticated
USING (has_permission('meetings.delete'));