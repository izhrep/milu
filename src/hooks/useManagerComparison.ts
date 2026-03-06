import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData, getFullName } from '@/lib/userDataDecryption';

export interface EmployeeComparison {
  id: string;
  full_name: string;
  position: string;
  department: string;
  skill_average: number;
  quality_average: number;
  overall_average: number;
  assessment_count: number;
  period: string;
}

interface ComparisonFilters {
  departmentId?: string;
  period?: string;
  skillId?: string;
  qualityId?: string;
}

export const useManagerComparison = (managerId: string | undefined) => {
  const [employees, setEmployees] = useState<EmployeeComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = async (filters?: ComparisonFilters) => {
    if (!managerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get subordinates
      let query = supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          middle_name,
          position_id,
          department_id,
          positions(name),
          departments(name)
        `)
        .eq('manager_id', managerId)
        .eq('status', true);

      if (filters?.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data: subordinates, error: subError } = await query;

      if (subError) throw subError;
      if (!subordinates || subordinates.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const employeeIds = subordinates.map(u => u.id);

      // Fetch skill survey results
      let skillQuery = supabase
        .from('hard_skill_results')
        .select(`
          evaluated_user_id,
          evaluation_period,
          hard_skill_answer_options(numeric_value),
          hard_skill_questions!inner(skill_id)
        `)
        .in('evaluated_user_id', employeeIds);

      if (filters?.period) {
        skillQuery = skillQuery.eq('evaluation_period', filters.period);
      }

      const { data: skillResults } = await skillQuery;

      // Fetch 360 survey results
      let qualityQuery = supabase
        .from('soft_skill_results')
        .select(`
          evaluated_user_id,
          evaluation_period,
          soft_skill_answer_options(numeric_value),
          soft_skill_questions!inner(quality_id)
        `)
        .in('evaluated_user_id', employeeIds);

      if (filters?.period) {
        qualityQuery = qualityQuery.eq('evaluation_period', filters.period);
      }

      const { data: qualityResults } = await qualityQuery;

      // Aggregate results with decryption
      const comparisons: EmployeeComparison[] = await Promise.all(
        subordinates.map(async (emp) => {
          // Decrypt user name
          const decrypted = await decryptUserData({
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            middle_name: emp.middle_name || '',
            email: '', // not needed for display
          });
          const fullName = getFullName(decrypted);

          const skillData = skillResults?.filter(r => r.evaluated_user_id === emp.id) || [];
          const qualityData = qualityResults?.filter(r => r.evaluated_user_id === emp.id) || [];

          const skillScores = skillData
            .map(r => (r as any).raw_numeric_value ?? (r as any).hard_skill_answer_options?.numeric_value)
            .filter((s): s is number => s != null);
          
          const qualityScores = qualityData
            .map(r => (r as any).raw_numeric_value ?? (r as any).soft_skill_answer_options?.numeric_value)
            .filter((s): s is number => s != null);

          const skillAvg = skillScores.length > 0
            ? skillScores.reduce((a, b) => a + b, 0) / skillScores.length
            : 0;

          const qualityAvg = qualityScores.length > 0
            ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
            : 0;

          const overallAvg = (skillAvg + qualityAvg) / 2;

          return {
            id: emp.id,
            full_name: fullName,
            position: (emp.positions as any)?.name || 'Не указано',
            department: (emp.departments as any)?.name || 'Не указано',
            skill_average: Number(skillAvg.toFixed(2)),
            quality_average: Number(qualityAvg.toFixed(2)),
            overall_average: Number(overallAvg.toFixed(2)),
            assessment_count: skillData.length + qualityData.length,
            period: filters?.period || 'Все периоды'
          };
        })
      );

      setEmployees(comparisons);
    } catch (err: any) {
      console.error('Error fetching comparison:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, [managerId]);

  return {
    employees,
    loading,
    error,
    refetch: fetchComparison
  };
};
