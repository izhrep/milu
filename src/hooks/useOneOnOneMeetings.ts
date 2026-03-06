import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface OneOnOneMeeting {
  id: string;
  stage_id: string | null;
  employee_id: string;
  manager_id: string;
  created_by: string | null;
  status: 'draft' | 'submitted' | 'returned' | 'approved' | 'expired';
  meeting_date: string | null;
  goal_and_agenda: string | null;
  energy_gained: string | null;
  energy_lost: string | null;
  previous_decisions_debrief: string | null;
  stoppers: string | null;
  ideas_and_suggestions: string | null;
  meeting_link: string | null;
  manager_comment: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  returned_at: string | null;
  return_reason: string | null;
  status_at_stage_end: string | null;
  stage_end_snapshot_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  decision_text: string;
  is_completed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useOneOnOneMeetings = (options?: { stageId?: string; employeeId?: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const stageId = options?.stageId;
  const employeeId = options?.employeeId;

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['one-on-one-meetings', stageId, employeeId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('one_on_one_meetings')
        .select('*');

      if (employeeId) {
        // Manager viewing subordinate's full history — RLS handles access
        query = query.eq('employee_id', employeeId);
      } else {
        // Default: my meetings (as employee or manager)
        query = query.or(`employee_id.eq.${user.id},manager_id.eq.${user.id}`);
      }

      if (stageId) {
        query = query.eq('stage_id', stageId);
      }

      query = query
        .order('meeting_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as OneOnOneMeeting[];
    },
    enabled: !!user,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (meeting: {
      stage_id?: string | null;
      employee_id?: string;
      manager_id: string;
      status?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const employeeId = meeting.employee_id || user.id;

      // Check for existing open meeting for this pair
      const { data: existing } = await supabase
        .from('one_on_one_meetings')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('manager_id', meeting.manager_id)
        .in('status', ['draft', 'submitted', 'returned'])

      if (existing && existing.length > 0) {
        throw new Error('У этой пары уже есть незавершённая встреча');
      }

      const meetingData = {
        stage_id: meeting.stage_id || null,
        manager_id: meeting.manager_id,
        employee_id: employeeId,
        created_by: user.id,
        status: meeting.status || 'draft',
      };

      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .insert(meetingData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Встреча создана' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OneOnOneMeeting> & { id: string }) => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Встреча обновлена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const submitMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      // Allow submitting from draft, returned, or expired (stage-less)
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Форма отправлена на утверждение' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const approveMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      // Allow approving from submitted or expired (stage-less)
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Встреча утверждена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const returnMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, reason }: { meetingId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
          return_reason: reason,
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Форма возвращена на доработку' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const reopenMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Встреча возобновлена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    meetings,
    isLoading,
    createMeeting: createMeetingMutation.mutate,
    createMeetingAsync: createMeetingMutation.mutateAsync,
    updateMeeting: updateMeetingMutation.mutate,
    updateMeetingAsync: updateMeetingMutation.mutateAsync,
    submitMeeting: submitMeetingMutation.mutate,
    approveMeeting: approveMeetingMutation.mutate,
    returnMeeting: returnMeetingMutation.mutate,
    reopenMeeting: reopenMeetingMutation.mutate,
  };
};
