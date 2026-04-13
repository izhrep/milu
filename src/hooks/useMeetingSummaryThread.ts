import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SummaryComment {
  id: string;
  meeting_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author_name?: string;
}

export const useMeetingSummaryThread = (meetingId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['meeting-summary-comments', meetingId];

  const { data: rawComments, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_summary_comments')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!meetingId,
  });

  // Fetch author names
  const authorIds = [...new Set((rawComments || []).map(c => c.author_id))];
  const { data: authorMap } = useQuery({
    queryKey: ['summary-comment-authors', authorIds.join(',')],
    queryFn: async () => {
      if (!authorIds.length) return {};
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', authorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => {
        map[u.id] = [u.last_name, u.first_name].filter(Boolean).join(' ');
      });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const comments: SummaryComment[] = (rawComments || []).map(c => ({
    ...c,
    author_name: authorMap?.[c.author_id] || '',
  }));

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('meeting_summary_comments')
        .insert({ meeting_id: meetingId, author_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const { error } = await supabase
        .from('meeting_summary_comments')
        .update({ body, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('meeting_summary_comments')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    comments,
    isLoading,
    sendComment: sendMutation.mutateAsync,
    editComment: editMutation.mutateAsync,
    deleteComment: deleteMutation.mutateAsync,
    isSending: sendMutation.isPending,
  };
};

/** Fetch comment counts for multiple meetings in one query */
export const useMeetingSummaryCommentCounts = (meetingIds: string[]) => {
  return useQuery({
    queryKey: ['meeting-summary-comment-counts', meetingIds.join(',')],
    queryFn: async () => {
      if (!meetingIds.length) return {};
      const { data, error } = await supabase
        .from('meeting_summary_comments')
        .select('meeting_id')
        .in('meeting_id', meetingIds)
        .is('deleted_at', null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        counts[row.meeting_id] = (counts[row.meeting_id] || 0) + 1;
      });
      return counts;
    },
    enabled: meetingIds.length > 0,
  });
};
