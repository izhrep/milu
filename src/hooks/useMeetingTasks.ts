import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for managing meeting-related task acknowledgments.
 * Task creation is handled by DB triggers, not frontend.
 * This hook only handles closing meeting_review_summary tasks on acknowledgment.
 */
export const useMeetingTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const acknowledgeMeetingReview = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Close any active meeting_review_summary task for this meeting and user
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('assignment_id', meetingId)
        .eq('task_type', 'meeting_review_summary')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return {
    acknowledgeMeetingReview: acknowledgeMeetingReview.mutate,
  };
};
