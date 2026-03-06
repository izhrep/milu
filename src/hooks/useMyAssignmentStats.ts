import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AssignmentStats {
  total_evaluators: number;
  completed_evaluators: number;
  pending_evaluators: number;
}

/**
 * Hook for fetching aggregated assignment statistics for evaluated user
 * Uses SECURITY DEFINER function to avoid exposing evaluator identities
 */
export const useMyAssignmentStats = () => {
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (evaluatedUserId: string, stageId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_my_assignment_stats', {
          _evaluated_user_id: evaluatedUserId,
          _stage_id: stageId || null
        });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setStats({
          total_evaluators: Number(data[0].total_evaluators) || 0,
          completed_evaluators: Number(data[0].completed_evaluators) || 0,
          pending_evaluators: Number(data[0].pending_evaluators) || 0
        });
      } else {
        setStats({
          total_evaluators: 0,
          completed_evaluators: 0,
          pending_evaluators: 0
        });
      }

      return data?.[0] || null;
    } catch (err) {
      console.error('Error fetching assignment stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки статистики';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    fetchStats
  };
};
