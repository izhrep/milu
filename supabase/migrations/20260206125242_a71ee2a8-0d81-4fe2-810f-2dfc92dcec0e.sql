-- ==================================
-- TASK 3: meeting_private_notes
-- ==================================

CREATE TABLE IF NOT EXISTS public.meeting_private_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.users(id),
    private_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(meeting_id, manager_id)
);

ALTER TABLE public.meeting_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_private_notes_manager_access"
ON public.meeting_private_notes
FOR ALL TO authenticated
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

DROP TRIGGER IF EXISTS update_meeting_private_notes_updated_at ON public.meeting_private_notes;
CREATE TRIGGER update_meeting_private_notes_updated_at
    BEFORE UPDATE ON public.meeting_private_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================================
-- TASK 4: Унификация user_profiles RLS
-- ==================================

DROP POLICY IF EXISTS "user_profiles_select_auth_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_restricted" ON public.user_profiles;

CREATE POLICY "user_profiles_select_unified"
ON public.user_profiles
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'hr_bp')
    )
    OR public.has_permission(auth.uid(), 'users.view')
);

-- ==================================
-- TASK 5: Модерация johari_ai_snapshots
-- ==================================

ALTER TABLE public.johari_ai_snapshots 
ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.review_johari_snapshot(p_snapshot_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE johari_ai_snapshots
    SET 
        is_reviewed = true,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_snapshot_id;
END;
$$;