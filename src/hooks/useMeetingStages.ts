import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface MeetingStage {
  id: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // From parent_stages
  period?: string;
  start_date?: string;
  end_date?: string;
  reminder_date?: string;
  is_active?: boolean;
}

export const useMeetingStages = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: stages, isLoading } = useQuery({
    queryKey: ['meeting-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_stages')
        .select(`
          *,
          parent:parent_stages (
            period,
            start_date,
            end_date,
            reminder_date,
            is_active
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Flatten parent data into meeting stage
      return (data || []).map(stage => ({
        ...stage,
        period: stage.parent?.period,
        start_date: stage.parent?.start_date,
        end_date: stage.parent?.end_date,
        reminder_date: stage.parent?.reminder_date,
        is_active: stage.parent?.is_active ?? false
      })) as MeetingStage[];
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (stage: { parent_id: string }) => {
      const { data, error } = await supabase
        .from('meeting_stages')
        .insert({
          parent_id: stage.parent_id,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-stages'] });
      toast({ title: 'Подэтап Встречи 1:1 создан' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MeetingStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('meeting_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-stages'] });
      toast({ title: 'Этап обновлен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const addParticipantsMutation = useMutation({
    mutationFn: async ({ stageId, userIds }: { stageId: string; userIds: string[] }) => {
      const participants = userIds.map(userId => ({
        stage_id: stageId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('meeting_stage_participants')
        .insert(participants);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-stages'] });
      toast({ title: 'Участники добавлены' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      // Проверяем наличие участников
      const { data: participants, error: checkError } = await supabase
        .from('meeting_stage_participants')
        .select('id')
        .eq('stage_id', stageId)
        .limit(1);

      if (checkError) throw checkError;
      if (participants && participants.length > 0) {
        throw new Error('Невозможно удалить этап с участниками');
      }

      const { error } = await supabase
        .from('meeting_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-stages'] });
      toast({ title: 'Этап удален' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const getParticipantsCountMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { count, error } = await supabase
        .from('meeting_stage_participants')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);

      if (error) throw error;
      return count || 0;
    },
  });

  const getParticipantsMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { data, error } = await supabase
        .from('meeting_stage_participants')
        .select('user_id')
        .eq('stage_id', stageId);

      if (error) throw error;
      return data?.map(p => p.user_id) || [];
    },
  });

  return {
    stages,
    isLoading,
    createStage: createStageMutation.mutate,
    updateStage: updateStageMutation.mutate,
    addParticipants: addParticipantsMutation.mutateAsync,
    deleteStage: deleteStageMutation.mutate,
    getParticipantsCount: getParticipantsCountMutation.mutateAsync,
    getParticipants: getParticipantsMutation.mutateAsync,
  };
};
