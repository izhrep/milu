import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface DiagnosticStage {
  id: string;
  parent_id: string | null;
  evaluation_period: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: string;
  progress_percent: number | null;
  // From parent_stages
  period?: string;
  start_date?: string;
  end_date?: string;
  reminder_date?: string;
}

export const useDiagnosticStages = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: stages, isLoading } = useQuery({
    queryKey: ['diagnostic-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnostic_stages')
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
      
      // Flatten parent data into diagnostic stage
      return (data || []).map(stage => ({
        ...stage,
        period: stage.parent?.period,
        start_date: stage.parent?.start_date,
        end_date: stage.parent?.end_date,
        reminder_date: stage.parent?.reminder_date,
        is_active: stage.parent?.is_active ?? stage.is_active
      })) as DiagnosticStage[];
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (stage: { parent_id: string; evaluation_period?: string | null; config_template_id?: string }) => {
      const { data, error } = await supabase
        .from('diagnostic_stages')
        .insert({
          parent_id: stage.parent_id,
          evaluation_period: stage.evaluation_period,
          created_by: user?.id,
          ...(stage.config_template_id ? { config_template_id: stage.config_template_id } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-stages'] });
      toast({ title: 'Подэтап Диагностика создан' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DiagnosticStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('diagnostic_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-stages'] });
      toast({ title: 'Этап обновлен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const addParticipantsMutation = useMutation({
    mutationFn: async ({ stageId, userIds }: { stageId: string; userIds: string[] }) => {
      // Добавляем участников - триггеры БД автоматически создадут назначения и задачи
      const participants = userIds.map(userId => ({
        stage_id: stageId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('diagnostic_stage_participants')
        .insert(participants);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-stages'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
        .from('diagnostic_stage_participants')
        .select('id')
        .eq('stage_id', stageId)
        .limit(1);

      if (checkError) throw checkError;
      if (participants && participants.length > 0) {
        throw new Error('Невозможно удалить этап с участниками');
      }

      const { error } = await supabase
        .from('diagnostic_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-stages'] });
      toast({ title: 'Этап удален' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const getParticipantsCountMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { count, error } = await supabase
        .from('diagnostic_stage_participants')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);

      if (error) throw error;
      return count || 0;
    },
  });

  const getParticipantsMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { data, error } = await supabase
        .from('diagnostic_stage_participants')
        .select('user_id')
        .eq('stage_id', stageId);

      if (error) throw error;
      return data?.map(p => p.user_id) || [];
    },
  });

  const activeStage = stages?.find(s => s.is_active) || null;

  return {
    stages,
    activeStage,
    isLoading,
    createStage: createStageMutation.mutate,
    updateStage: updateStageMutation.mutate,
    addParticipants: addParticipantsMutation.mutateAsync,
    deleteStage: deleteStageMutation.mutate,
    getParticipantsCount: getParticipantsCountMutation.mutateAsync,
    getParticipants: getParticipantsMutation.mutateAsync,
  };
};