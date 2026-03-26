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

      const { data: currentMeeting } = await supabase
        .from('one_on_one_meetings')
        .select('employee_id, stage_id, created_at')
        .eq('id', meetingId)
        .single();

      if (!currentMeeting) return [];

      // Get previous recorded meeting for this employee
      const { data: previousMeeting } = await supabase
        .from('one_on_one_meetings')
        .select('id')
        .eq('employee_id', currentMeeting.employee_id)
        .eq('status', 'recorded')
        .lt('created_at', currentMeeting.created_at)
        .order('meeting_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (!previousMeeting) return [];

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
      toast({ title: 'Договорённость добавлена' });
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
    onMutate: async (variables) => {
      const { id, ...updates } = variables;

      // Cancel refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['meeting-decisions'] });
      await queryClient.cancelQueries({ queryKey: ['previous-meeting-decisions'] });

      // Snapshot both caches for rollback
      const allDecisionCaches = queryClient.getQueriesData<MeetingDecision[]>({ queryKey: ['meeting-decisions'] });
      const allPrevDecisionCaches = queryClient.getQueriesData<MeetingDecision[]>({ queryKey: ['previous-meeting-decisions'] });

      // Optimistically update all matching caches
      const patchCache = (entries: [readonly unknown[], MeetingDecision[] | undefined][]) => {
        for (const [key, old] of entries) {
          if (!old) continue;
          const idx = old.findIndex(d => d.id === id);
          if (idx !== -1) {
            queryClient.setQueryData(key, old.map(d => d.id === id ? { ...d, ...updates } : d));
          }
        }
      };
      patchCache(allDecisionCaches);
      patchCache(allPrevDecisionCaches);

      return { allDecisionCaches, allPrevDecisionCaches };
    },
    onError: (error: Error, _vars, context) => {
      // Rollback on error
      if (context) {
        for (const [key, data] of context.allDecisionCaches) {
          queryClient.setQueryData(key, data);
        }
        for (const [key, data] of context.allPrevDecisionCaches) {
          queryClient.setQueryData(key, data);
        }
      }
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      // Background re-sync to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['meeting-decisions'] });
      queryClient.invalidateQueries({ queryKey: ['previous-meeting-decisions'] });
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
