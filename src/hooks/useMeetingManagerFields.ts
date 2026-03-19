import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MeetingManagerFields {
  id: string;
  meeting_id: string;
  mgr_praise: string | null;
  mgr_development_comment: string | null;
  mgr_news: string | null;
  created_at: string;
  updated_at: string;
}

export const useMeetingManagerFields = (meetingId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: managerFields, isLoading } = useQuery({
    queryKey: ['meeting-manager-fields', meetingId],
    queryFn: async () => {
      if (!meetingId) return null;

      const { data, error } = await supabase
        .from('meeting_manager_fields')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (error) throw error;
      return data as MeetingManagerFields | null;
    },
    enabled: !!meetingId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (fields: {
      meeting_id: string;
      mgr_praise?: string | null;
      mgr_development_comment?: string | null;
      mgr_news?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('meeting_manager_fields')
        .upsert({
          meeting_id: fields.meeting_id,
          mgr_praise: fields.mgr_praise ?? null,
          mgr_development_comment: fields.mgr_development_comment ?? null,
          mgr_news: fields.mgr_news ?? null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'meeting_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-manager-fields'] });
      toast({ title: 'Блок руководителя сохранён' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    managerFields,
    isLoading,
    upsertManagerFields: upsertMutation.mutate,
    upsertManagerFieldsAsync: upsertMutation.mutateAsync,
    isUpsertingManagerFields: upsertMutation.isPending,
  };
};
