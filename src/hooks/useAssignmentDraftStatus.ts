import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DraftStatus {
  hasDraft: boolean;
  loading: boolean;
}

export const useAssignmentDraftStatus = (assignmentId: string | undefined, userId: string | undefined): DraftStatus => {
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDraftStatus = async () => {
      if (!assignmentId || !userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Проверяем наличие черновиков в soft_skill_results
        const { data: softDrafts, error: softError } = await supabase
          .from('soft_skill_results')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('evaluating_user_id', userId)
          .eq('is_draft', true)
          .limit(1);

        if (softError) throw softError;

        // Проверяем наличие черновиков в hard_skill_results
        const { data: hardDrafts, error: hardError } = await supabase
          .from('hard_skill_results')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('evaluating_user_id', userId)
          .eq('is_draft', true)
          .limit(1);

        if (hardError) throw hardError;

        // Есть черновик если найден хотя бы один результат в любой из таблиц
        const hasDraftResults = (softDrafts && softDrafts.length > 0) || (hardDrafts && hardDrafts.length > 0);
        setHasDraft(hasDraftResults);
      } catch (error) {
        console.error('Error checking draft status:', error);
        setHasDraft(false);
      } finally {
        setLoading(false);
      }
    };

    checkDraftStatus();
  }, [assignmentId, userId]);

  return { hasDraft, loading };
};
