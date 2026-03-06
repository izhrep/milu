import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Survey360Assignment {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  assigned_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  diagnostic_stage_id?: string;
  is_manager_participant?: boolean;
  assignment_type?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  added_by_manager?: boolean;
}

export const useSurvey360Assignments = (userId?: string) => {
  const [assignments, setAssignments] = useState<Survey360Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchAssignments();
    }
  }, [userId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('survey_360_assignments')
        .select('id, evaluated_user_id, evaluating_user_id, assigned_date, status, created_at, updated_at, diagnostic_stage_id, is_manager_participant, assignment_type, approved_by, approved_at, rejected_at, rejection_reason, added_by_manager')
        .or(`evaluated_user_id.eq.${userId},evaluating_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAssignments(data || []);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке назначений');
    } finally {
      setLoading(false);
    }
  };

  const createAssignments = async (
    evaluatedUserId: string, 
    evaluatingUserIds: string[], 
    diagnosticStageId?: string
  ) => {
    try {
      setError(null);

      // Проверяем существующие назначения
      const { data: existingAssignments } = await supabase
        .from('survey_360_assignments')
        .select('evaluated_user_id, evaluating_user_id')
        .eq('evaluated_user_id', evaluatedUserId)
        .in('evaluating_user_id', evaluatingUserIds);

      // Фильтруем только новые назначения
      const existingPairs = new Set(
        existingAssignments?.map(a => `${a.evaluated_user_id}-${a.evaluating_user_id}`) || []
      );

      const assignmentsToCreate = evaluatingUserIds
        .filter(evaluatingUserId => 
          !existingPairs.has(`${evaluatedUserId}-${evaluatingUserId}`)
        )
        .map(evaluatingUserId => ({
          evaluated_user_id: evaluatedUserId,
          evaluating_user_id: evaluatingUserId,
          diagnostic_stage_id: diagnosticStageId,
          assignment_type: 'peer', // Всегда peer, т.к. это коллеги
          status: 'pending',
          added_by_manager: false // Добавлено сотрудником, а не руководителем
        }));

      let insertedData = [];

      // Создаем только новые назначения
      if (assignmentsToCreate.length > 0) {
        const { data, error: insertError } = await supabase
          .from('survey_360_assignments')
          .insert(assignmentsToCreate)
          .select('id, evaluated_user_id, evaluating_user_id, assigned_date, status, created_at, updated_at, diagnostic_stage_id');

        if (insertError) throw insertError;
        insertedData = data || [];
      }

      // Получаем все назначения для возврата (включая существующие)
      const { data: allAssignments } = await supabase
        .from('survey_360_assignments')
        .select('id, evaluated_user_id, evaluating_user_id, assigned_date, status, created_at, updated_at, diagnostic_stage_id')
        .eq('evaluated_user_id', evaluatedUserId)
        .in('evaluating_user_id', evaluatingUserIds);

      // Обновляем локальное состояние только новыми назначениями
      if (insertedData.length > 0) {
        setAssignments(prev => [...insertedData, ...prev]);
      }
      
      return { success: true, data: allAssignments || [] };
    } catch (err) {
      console.error('Error creating assignments:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании назначений';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, status: string) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('survey_360_assignments')
        .update({ status })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      // Обновляем локальное состояние
      setAssignments(prev => prev.map(assignment => 
        assignment.id === assignmentId 
          ? { ...assignment, status, updated_at: new Date().toISOString() }
          : assignment
      ));
      
      return { success: true };
    } catch (err) {
      console.error('Error updating assignment status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обновлении статуса';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    assignments,
    loading,
    error,
    createAssignments,
    updateAssignmentStatus,
    refetch: fetchAssignments
  };
};