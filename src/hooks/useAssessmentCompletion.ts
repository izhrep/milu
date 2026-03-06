import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUsers, getFullName } from './useUsers';

interface Respondent {
  id: string;
  name: string;
  type: 'self' | 'supervisor' | 'colleague';
  status: 'pending' | 'completed';
  completed_at?: string;
}

export const useAssessmentCompletion = (userId: string | undefined, assessmentType: '360' | 'skill') => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const { users, getSupervisor } = useUsers();

  useEffect(() => {
    if (userId) {
      fetchRespondents();
    }
  }, [userId, assessmentType]);

  const fetchRespondents = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Both assessment types now use survey_360_assignments
      const table = 'survey_360_assignments';
      const resultsTable = assessmentType === '360' ? 'soft_skill_results' : 'hard_skill_results';
      
      const { data: assignments, error } = await supabase
        .from(table)
        .select('*')
        .eq('evaluated_user_id', userId);

      if (error) throw error;

      const supervisor = getSupervisor(userId);
      const respondentsList: Respondent[] = [];

      for (const assignment of assignments || []) {
        const user = users.find(u => u.id === assignment.evaluating_user_id);
        if (!user) continue;

        const isSelf = assignment.evaluating_user_id === userId;
        const isSupervisor = assignment.evaluating_user_id === supervisor?.id;

        // Check if completed
        let completed = false;
        let completedAt: string | undefined;

        if (assessmentType === '360') {
          const { data: results, error: resultsError } = await supabase
            .from('soft_skill_results')
            .select('created_at')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .limit(1);
          
          if (!resultsError && results && results.length > 0) {
            completed = true;
            completedAt = results[0].created_at;
          }
        } else {
          const { data: results, error: resultsError } = await supabase
            .from('hard_skill_results')
            .select('created_at')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .limit(1);
          
          if (!resultsError && results && results.length > 0) {
            completed = true;
            completedAt = results[0].created_at;
          }
        }

        respondentsList.push({
          id: assignment.id,
          name: getFullName(user) || user.email || 'Неизвестный пользователь',
          type: isSelf ? 'self' : isSupervisor ? 'supervisor' : 'colleague',
          status: completed ? 'completed' : 'pending',
          completed_at: completedAt
        });
      }

      setRespondents(respondentsList);

      // Check if assessment is complete
      const hasSelf = respondentsList.some(r => r.type === 'self' && r.status === 'completed');
      const hasSupervisor = respondentsList.some(r => r.type === 'supervisor' && r.status === 'completed');
      const colleagueCount = respondentsList.filter(r => r.type === 'colleague' && r.status === 'completed').length;

      setIsComplete(hasSelf && hasSupervisor && colleagueCount >= 1);
    } catch (error) {
      console.error('Error fetching respondents:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    respondents,
    isComplete,
    loading,
    refetch: fetchRespondents
  };
};