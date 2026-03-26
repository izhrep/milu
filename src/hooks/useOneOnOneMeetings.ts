import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeMeetingDateToUtcIso } from '@/lib/meetingDateTime';

export type MeetingStatus = 'scheduled' | 'awaiting_summary' | 'recorded';

export interface OneOnOneMeeting {
  id: string;
  stage_id: string | null;
  employee_id: string;
  manager_id: string;
  created_by: string | null;
  status: MeetingStatus;
  meeting_date: string | null;
  goal_and_agenda: string | null;
  energy_gained: string | null;
  energy_lost: string | null;
  previous_decisions_debrief: string | null;
  stoppers: string | null;
  ideas_and_suggestions: string | null;
  meeting_link: string | null;
  manager_comment: string | null;
  emp_mood: string | null;
  emp_successes: string | null;
  emp_problems: string | null;
  emp_news: string | null;
  emp_questions: string | null;
  meeting_summary: string | null;
  summary_saved_by: string | null;
  summary_saved_at: string | null;
  // Legacy fields (kept for backward compat, not used in new UI)
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
        query = query.eq('employee_id', employeeId);
      } else {
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
      meeting_date: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const employeeId = meeting.employee_id || user.id;

      // Конвертируем локально выбранные date/time в UTC ISO для timestamptz
      const meetingDateISO = normalizeMeetingDateToUtcIso(meeting.meeting_date);

      const meetingData = {
        stage_id: meeting.stage_id || null,
        manager_id: meeting.manager_id,
        employee_id: employeeId,
        created_by: user.id,
        meeting_date: meetingDateISO,
        // Status is computed by DB trigger based on meeting_date
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
      const safeUpdates: Partial<OneOnOneMeeting> = { ...updates };

      if (typeof safeUpdates.meeting_date === 'string' && safeUpdates.meeting_date) {
        safeUpdates.meeting_date = normalizeMeetingDateToUtcIso(safeUpdates.meeting_date);
      }

      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', variables.id] });
      toast({ title: 'Встреча обновлена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const saveSummaryMutation = useMutation({
    mutationFn: async ({ meetingId, summary }: { meetingId: string; summary: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .update({
          meeting_summary: summary,
          summary_saved_by: user.id,
          summary_saved_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', variables.meetingId] });
      toast({ title: 'Итоги встречи сохранены' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const rescheduleMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, previousDate, newDateIso }: { meetingId: string; previousDate: string; newDateIso: string }) => {
      if (!user) throw new Error('Not authenticated');

      // 1. Insert reschedule history
      const { error: histError } = await supabase
        .from('meeting_reschedules')
        .insert({
          meeting_id: meetingId,
          previous_date: previousDate,
          new_date: newDateIso,
          rescheduled_by: user.id,
        });
      if (histError) throw histError;

      // 2. Update meeting date (DB trigger recalculates status)
      const { error: updateError } = await supabase
        .from('one_on_one_meetings')
        .update({ meeting_date: newDateIso })
        .eq('id', meetingId);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', variables.meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-reschedules', variables.meetingId] });
      toast({ title: 'Встреча перенесена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка переноса', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('one_on_one_meetings')
        .delete()
        .eq('id', meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-on-one-meetings'] });
      toast({ title: 'Встреча удалена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка удаления', description: error.message, variant: 'destructive' });
    },
  });

  return {
    meetings,
    isLoading,
    createMeeting: createMeetingMutation.mutate,
    createMeetingAsync: createMeetingMutation.mutateAsync,
    updateMeeting: updateMeetingMutation.mutate,
    updateMeetingAsync: updateMeetingMutation.mutateAsync,
    saveSummary: saveSummaryMutation.mutate,
    saveSummaryAsync: saveSummaryMutation.mutateAsync,
    rescheduleMeeting: rescheduleMeetingMutation.mutateAsync,
    deleteMeeting: deleteMeetingMutation.mutateAsync,
    isDeletingMeeting: deleteMeetingMutation.isPending,
  };
};
