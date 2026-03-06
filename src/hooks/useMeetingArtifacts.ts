import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { AdminLogger } from '@/lib/adminLogger';
import { toast } from '@/hooks/use-toast';

const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'png', 'jpg', 'jpeg', 'webp', 'svg',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_FILES_PER_MEETING = 10;

export interface MeetingArtifact {
  id: string;
  meeting_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  is_deleted: boolean;
  created_at: string;
}

interface UseMeetingArtifactsOptions {
  meetingId: string;
  meetingStatus: string;
  meetingStageId: string | null;
  isManager: boolean;
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function sanitizeStorageName(fileName: string): string {
  const ext = getFileExtension(fileName);
  const base = fileName.replace(/\.[^.]+$/, '');
  // Replace non-ASCII and special chars with underscore, collapse multiples
  const safe = base
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return safe ? `${safe}.${ext}` : `file.${ext}`;
}

function validateFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Формат .${ext} не поддерживается. Допустимые: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум: 25 МБ`;
  }
  return null;
}

export function useMeetingArtifacts({ meetingId, meetingStatus, meetingStageId, isManager }: UseMeetingArtifactsOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission: hasMeetingsManage } = usePermission('meetings.manage');
  const [uploadProgress, setUploadProgress] = useState(false);

  // Fetch artifacts
  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ['meeting-artifacts', meetingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('meeting_artifacts')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as MeetingArtifact[];
    },
    enabled: !!meetingId,
  });

  // Can upload logic
  const isStageLessExpired = meetingStatus === 'expired' && meetingStageId === null;
  const canUpload = (() => {
    if (hasMeetingsManage) return true;
    if (!isManager) {
      return ['draft', 'returned'].includes(meetingStatus) || isStageLessExpired;
    }
    return meetingStatus === 'submitted' || isStageLessExpired;
  })();

  const canDelete = useCallback((artifact: MeetingArtifact) => {
    return artifact.uploaded_by === user?.id || hasMeetingsManage;
  }, [user?.id, hasMeetingsManage]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Не авторизован');

      const validationError = validateFile(file);
      if (validationError) throw new Error(validationError);

      if (artifacts.length >= MAX_FILES_PER_MEETING) {
        throw new Error(`Максимум ${MAX_FILES_PER_MEETING} файлов на встречу`);
      }

      setUploadProgress(true);

      const fileId = crypto.randomUUID();
      const storagePath = `${meetingId}/${fileId}_${sanitizeStorageName(file.name)}`;

      const { error: storageError } = await supabase.storage
        .from('meeting-artifacts')
        .upload(storagePath, file);

      if (storageError) throw storageError;

      const { error: dbError } = await (supabase as any)
        .from('meeting_artifacts')
        .insert({
          meeting_id: meetingId,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          uploaded_by: user.id,
        });

      if (dbError) {
        // Cleanup storage on DB error
        await supabase.storage.from('meeting-artifacts').remove([storagePath]);
        throw dbError;
      }

      // Audit log (best effort)
      const userData = await supabase.from('users' as any).select('last_name, first_name').eq('id', user.id).single();
      const userName = userData.data ? `${(userData.data as any).last_name} ${(userData.data as any).first_name}` : user.email || '';
      await AdminLogger.log({
        user_id: user.id,
        user_name: userName,
        action: 'artifact_upload',
        entity_type: 'meeting_artifact',
        entity_name: file.name,
        details: { meeting_id: meetingId, file_size: file.size, mime_type: file.type },
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-artifacts', meetingId] });
      toast({ title: 'Файл загружен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка загрузки', description: error.message, variant: 'destructive' });
    },
    onSettled: () => setUploadProgress(false),
  });

  // Delete mutation (soft delete + storage remove)
  const deleteMutation = useMutation({
    mutationFn: async (artifact: MeetingArtifact) => {
      if (!user) throw new Error('Не авторизован');

      const { error: dbError } = await (supabase as any)
        .from('meeting_artifacts')
        .update({ is_deleted: true })
        .eq('id', artifact.id);

      if (dbError) throw dbError;

      await supabase.storage.from('meeting-artifacts').remove([artifact.storage_path]).catch(() => {});

      // Audit log (best effort)
      const userData = await supabase.from('users' as any).select('last_name, first_name').eq('id', user.id).single();
      const userName = userData.data ? `${(userData.data as any).last_name} ${(userData.data as any).first_name}` : user.email || '';
      await AdminLogger.log({
        user_id: user.id,
        user_name: userName,
        action: 'artifact_delete',
        entity_type: 'meeting_artifact',
        entity_name: artifact.file_name,
        details: { meeting_id: meetingId, artifact_id: artifact.id },
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-artifacts', meetingId] });
      toast({ title: 'Файл удалён' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка удаления', description: error.message, variant: 'destructive' });
    },
  });

  // Get signed URL for download
  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('meeting-artifacts')
      .createSignedUrl(storagePath, 300);

    if (error) {
      toast({ title: 'Ошибка получения ссылки', description: error.message, variant: 'destructive' });
      return null;
    }
    return data.signedUrl;
  }, []);

  return {
    artifacts,
    isLoading,
    canUpload,
    canDelete,
    uploadArtifact: uploadMutation.mutate,
    isUploading: uploadProgress,
    deleteArtifact: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    getSignedUrl,
  };
}
