import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUsers, getFullName } from './useUsers';

interface Respondent {
  id: string;
  name: string;
  type: 'self' | 'supervisor' | 'colleague';
  status: 'pending' | 'completed';
  assigned_date: string;
  completed_at?: string;
}

export const useRespondentStatus = (userId: string | undefined, assessmentType: '360' | 'skill') => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(true);
  const { users, getSupervisor } = useUsers();

  useEffect(() => {
    if (userId) {
      fetchRespondents();
    }
  }, [userId, assessmentType, users]);

  const fetchRespondents = async () => {
    if (!userId || !users) return;
    
    setLoading(true);
    try {
      const { data: assignments, error } = await supabase
        .from('survey_360_assignments')
        .select('*')
        .eq('evaluated_user_id', userId);

      if (error) throw error;
      if (!assignments) {
        setRespondents([]);
        return;
      }

      const supervisor = getSupervisor(userId);
      const respondentsList: Respondent[] = [];

      for (const assignment of assignments) {
        const user = users.find((u: any) => u.id === assignment.evaluating_user_id);
        if (!user) continue;

        const isSelf = assignment.evaluating_user_id === userId;
        const isSupervisor = assignment.evaluating_user_id === supervisor?.id;

        // Check completion status
        let completed = false;
        let completedAt: string | undefined;

        if (assessmentType === '360') {
          const { data: results } = await supabase
            .from('soft_skill_results')
            .select('created_at')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .limit(1);
          
          if (results && results.length > 0) {
            completed = true;
            completedAt = results[0].created_at;
          }
        } else {
          const { data: results } = await supabase
            .from('hard_skill_results')
            .select('created_at')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .limit(1);
          
          if (results && results.length > 0) {
            completed = true;
            completedAt = results[0].created_at;
          }
        }

        respondentsList.push({
          id: assignment.id,
          name: getFullName(user) || user.email || 'Неизвестный',
          type: isSelf ? 'self' : isSupervisor ? 'supervisor' : 'colleague',
          status: completed ? 'completed' : 'pending',
          assigned_date: assignment.assigned_date,
          completed_at: completedAt
        });
      }

      setRespondents(respondentsList);
    } catch (error) {
      console.error('Error fetching respondents:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    respondents,
    loading,
    refetch: fetchRespondents
  };
};