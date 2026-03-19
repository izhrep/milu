
-- Create private backups bucket (replace public sprint-images usage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: only system.admin users can manage backup files
CREATE POLICY "Admin can upload backups"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'backups'
  AND public.has_permission(auth.uid(), 'system.admin')
);

CREATE POLICY "Admin can read backups"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_permission(auth.uid(), 'system.admin')
);

CREATE POLICY "Admin can delete backups"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_permission(auth.uid(), 'system.admin')
);
