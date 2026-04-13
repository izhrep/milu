import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';

export interface SummaryView {
  meeting_id: string;
  user_id: string;
  viewed_at: string;
  user_name?: string;
}

export const useMeetingSummaryViews = (meetingId: string) => {
  const queryKey = ['meeting-summary-views', meetingId];

  const { data: rawViews } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_summary_views')
        .select('*')
        .eq('meeting_id', meetingId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!meetingId,
  });

  const userIds = [...new Set((rawViews || []).map(v => v.user_id))];
  const { data: userMap } = useQuery({
    queryKey: ['summary-view-users', userIds.join(',')],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => {
        map[u.id] = [u.last_name, u.first_name].filter(Boolean).join(' ');
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const views: SummaryView[] = (rawViews || []).map(v => ({
    ...v,
    user_name: userMap?.[v.user_id] || '',
  }));

  return { views };
};

/**
 * Auto-record summary view when a participant opens a meeting with saved summary.
 * Only records if the user is NOT the summary author.
 */
export const useAutoRecordSummaryView = (
  meetingId: string | undefined,
  hasSummary: boolean,
  isParticipant: boolean,
  summarySavedBy: string | null | undefined,
) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recordedRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: { meeting_id: string; user_id: string }) => {
      const { error } = await supabase
        .from('meeting_summary_views')
        .upsert(
          { meeting_id: params.meeting_id, user_id: params.user_id, viewed_at: new Date().toISOString() },
          { onConflict: 'meeting_id,user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      if (meetingId) {
        queryClient.invalidateQueries({ queryKey: ['meeting-summary-views', meetingId] });
      }
    },
  });

  useEffect(() => {
    if (
      meetingId &&
      user &&
      hasSummary &&
      isParticipant &&
      user.id !== summarySavedBy &&
      recordedRef.current !== meetingId
    ) {
      recordedRef.current = meetingId;
      mutation.mutate({ meeting_id: meetingId, user_id: user.id });
    }
  }, [meetingId, user?.id, hasSummary, isParticipant, summarySavedBy]);
};

/** Batch fetch views for multiple meetings (for monitoring page) */
export const useMeetingSummaryViewsBatch = (meetingIds: string[]) => {
  return useQuery({
    queryKey: ['meeting-summary-views-batch', meetingIds.join(',')],
    queryFn: async () => {
      if (!meetingIds.length) return {};
      const { data, error } = await supabase
        .from('meeting_summary_views')
        .select('meeting_id, user_id, viewed_at')
        .in('meeting_id', meetingIds);
      if (error) throw error;
      const map: Record<string, Array<{ user_id: string; viewed_at: string }>> = {};
      (data || []).forEach(row => {
        if (!map[row.meeting_id]) map[row.meeting_id] = [];
        map[row.meeting_id].push({ user_id: row.user_id, viewed_at: row.viewed_at });
      });
      return map;
    },
    enabled: meetingIds.length > 0,
  });
};
