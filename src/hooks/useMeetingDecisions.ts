import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MeetingDecision } from './useOneOnOneMeetings';

export const useMeetingDecisions = (meetingId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: decisions, isLoading } = useQuery({
    queryKey: ['meeting-decisions', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];

      const { data, error } = await supabase
        .from('meeting_decisions')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MeetingDecision[];
    },
    enabled: !!meetingId,
  });

  const { data: previousDecisions, isLoading: isLoadingPrevious } = useQuery({
    queryKey: ['previous-meeting-decisions', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];

      // Получаем текущую встречу
      const { data: currentMeeting } = await supabase
        .from('one_on_one_meetings')
        .select('employee_id, stage_id, created_at')
        .eq('id', meetingId)
        .single();

      if (!currentMeeting) return [];

      // Получаем предыдущую утвержденную встречу этого сотрудника
      const { data: previousMeeting } = await supabase
        .from('one_on_one_meetings')
        .select('id')
        .eq('employee_id', currentMeeting.employee_id)
        .eq('status', 'approved')
        .lt('created_at', currentMeeting.created_at)
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!previousMeeting) return [];

      // Получаем решения из предыдущей встречи
      const { data, error } = await supabase
        .from('meeting_decisions')
        .select('*')
        .eq('meeting_id', previousMeeting.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MeetingDecision[];
    },
    enabled: !!meetingId,
  });

  const addDecisionMutation = useMutation({
    mutationFn: async ({ meetingId, decisionText }: { meetingId: string; decisionText: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('meeting_decisions')
        .insert({
          meeting_id: meetingId,
          decision_text: decisionText,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-decisions'] });
      toast({ title: 'Решение добавлено' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateDecisionMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MeetingDecision> & { id: string }) => {
      const { data, error } = await supabase
        .from('meeting_decisions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-decisions'] });
      queryClient.invalidateQueries({ queryKey: ['previous-meeting-decisions'] });
      toast({ title: 'Решение обновлено' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDecisionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meeting_decisions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-decisions'] });
      toast({ title: 'Решение удалено' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    decisions,
    previousDecisions,
    isLoading,
    isLoadingPrevious,
    addDecision: addDecisionMutation.mutate,
    updateDecision: updateDecisionMutation.mutate,
    deleteDecision: deleteDecisionMutation.mutate,
  };
};
