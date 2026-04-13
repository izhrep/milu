import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNotObserved } from '@/lib/diagnosticResultContract';

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
}

export interface DiagnosticProgress {
  total_participants: number;
  completed_skill: number;
  completed_360: number;
  completion_percentage: number;
}

export interface CompetencyAverage {
  name: string;
  category: string;
  average: number;
  count: number;
}

export interface GrowthArea {
  name: string;
  type: 'skill' | 'quality';
  gap: number;
  employees_affected: number;
}

export interface DynamicTrend {
  period: string;
  skill_average: number;
  quality_average: number;
}

export const useHRAnalytics = (filters?: AnalyticsFilters) => {
  const [progress, setProgress] = useState<DiagnosticProgress | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyAverage[]>([]);
  const [growthAreas, setGrowthAreas] = useState<GrowthArea[]>([]);
  const [dynamics, setDynamics] = useState<DynamicTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build user filter query
      let userIds: string[] = [];
      
      if (filters?.managerId) {
        // Use subtree to get all subordinates of the selected manager
        const { data: subtreeIds, error: subtreeError } = await supabase
          .rpc('get_management_subtree_ids', { _manager_id: filters.managerId });
        if (subtreeError) throw subtreeError;
        userIds = subtreeIds || [];
        
        // Further filter by department/position if set
        if (userIds.length > 0 && (filters?.departmentId || filters?.positionId)) {
          let refinedQuery = supabase.from('users').select('id').eq('status', true).in('id', userIds);
          if (filters?.departmentId) refinedQuery = refinedQuery.eq('department_id', filters.departmentId);
          if (filters?.positionId) refinedQuery = refinedQuery.eq('position_id', filters.positionId);
          const { data: refined } = await refinedQuery;
          userIds = refined?.map(u => u.id) || [];
        }
      } else {
        let userQuery = supabase.from('users').select('id').eq('status', true);
        if (filters?.departmentId) userQuery = userQuery.eq('department_id', filters.departmentId);
        if (filters?.positionId) userQuery = userQuery.eq('position_id', filters.positionId);
        const { data: users } = await userQuery;
        userIds = users?.map(u => u.id) || [];
      }


      if (userIds.length === 0) {
        setProgress({ total_participants: 0, completed_skill: 0, completed_360: 0, completion_percentage: 0 });
        setCompetencies([]);
        setGrowthAreas([]);
        setDynamics([]);
        setLoading(false);
        return;
      }

      // Fetch diagnostic progress
      let skillQuery = supabase
        .from('hard_skill_results')
        .select('evaluated_user_id')
        .in('evaluated_user_id', userIds);

      let quality360Query = supabase
        .from('soft_skill_results')
        .select('evaluated_user_id')
        .in('evaluated_user_id', userIds);

      if (filters?.startDate) {
        skillQuery = skillQuery.gte('created_at', filters.startDate);
        quality360Query = quality360Query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        skillQuery = skillQuery.lte('created_at', filters.endDate);
        quality360Query = quality360Query.lte('created_at', filters.endDate);
      }

      const [skillResults, quality360Results] = await Promise.all([
        skillQuery,
        quality360Query
      ]);

      const completedSkill = new Set(skillResults.data?.map(r => r.evaluated_user_id) || []).size;
      const completed360 = new Set(quality360Results.data?.map(r => r.evaluated_user_id) || []).size;

      setProgress({
        total_participants: userIds.length,
        completed_skill: completedSkill,
        completed_360: completed360,
        completion_percentage: Math.round(((completedSkill + completed360) / (userIds.length * 2)) * 100)
      });

      // Fetch competency averages
      const { data: skillData } = await supabase
        .from('hard_skill_results')
        .select(`
          hard_skill_questions!inner(skill_id, hard_skills(name, category_id, category_hard_skills(name))),
          hard_skill_answer_options(numeric_value)
        `)
        .in('evaluated_user_id', userIds);

      const { data: qualityData } = await supabase
        .from('soft_skill_results')
        .select(`
          soft_skill_questions!inner(quality_id, soft_skills(name, category_id, category_soft_skills(name))),
          soft_skill_answer_options(numeric_value)
        `)
        .in('evaluated_user_id', userIds);

      // Aggregate skills
      const skillMap = new Map<string, { name: string; category: string; total: number; count: number }>();
      
      skillData?.forEach(result => {
        const skill = (result as any).hard_skill_questions?.hard_skills;
        const categoryName = skill?.category_hard_skills?.name;
        const numericValue = (result as any).raw_numeric_value ?? (result as any).hard_skill_answer_options?.numeric_value;
        
        if (skill && numericValue != null && !isNotObserved(numericValue)) {
          const key = skill.name;
          const existing = skillMap.get(key) || { name: skill.name, category: categoryName || 'Общие', total: 0, count: 0 };
          existing.total += numericValue;
          existing.count += 1;
          skillMap.set(key, existing);
        }
      });

      const qualityMap = new Map<string, { name: string; category: string; total: number; count: number }>();
      
      qualityData?.forEach(result => {
        const quality = (result as any).soft_skill_questions?.soft_skills;
        const categoryName = quality?.category_soft_skills?.name;
        const numericValue = (result as any).raw_numeric_value ?? (result as any).soft_skill_answer_options?.numeric_value;
        
        if (quality && numericValue != null && !isNotObserved(numericValue)) {
          const key = quality.name;
          const existing = qualityMap.get(key) || { name: quality.name, category: categoryName || 'Качества', total: 0, count: 0 };
          existing.total += numericValue;
          existing.count += 1;
          qualityMap.set(key, existing);
        }
      });

      const competencyAverages: CompetencyAverage[] = [
        ...Array.from(skillMap.values()).map(s => ({
          name: s.name,
          category: s.category,
          average: Number((s.total / s.count).toFixed(2)),
          count: s.count
        })),
        ...Array.from(qualityMap.values()).map(q => ({
          name: q.name,
          category: q.category,
          average: Number((q.total / q.count).toFixed(2)),
          count: q.count
        }))
      ].sort((a, b) => a.average - b.average);

      setCompetencies(competencyAverages);

      // Growth areas (lowest 10)
      // @legacy: gap computed against hardcoded max=5; should use stage ScaleDomain when available
      const growth: GrowthArea[] = competencyAverages.slice(0, 10).map(c => ({
        name: c.name,
        type: skillMap.has(c.name) ? 'skill' : 'quality',
        gap: Number((5 - c.average).toFixed(2)),
        employees_affected: c.count
      }));

      setGrowthAreas(growth);

      // Dynamics over time
      const { data: skillDynamics } = await supabase
        .from('hard_skill_results')
        .select('evaluation_period, hard_skill_answer_options(numeric_value)')
        .in('evaluated_user_id', userIds)
        .order('evaluation_period');

      const { data: qualityDynamics } = await supabase
        .from('soft_skill_results')
        .select('evaluation_period, soft_skill_answer_options(numeric_value)')
        .in('evaluated_user_id', userIds)
        .order('evaluation_period');

      const periodSkillMap = new Map<string, { total: number; count: number }>();
      const periodQualityMap = new Map<string, { total: number; count: number }>();

      skillDynamics?.forEach(r => {
        const period = r.evaluation_period || 'Unknown';
        const numericValue = (r as any).raw_numeric_value ?? (r as any).hard_skill_answer_options?.numeric_value;
        if (numericValue != null) {
          const existing = periodSkillMap.get(period) || { total: 0, count: 0 };
          existing.total += numericValue;
          existing.count += 1;
          periodSkillMap.set(period, existing);
        }
      });

      qualityDynamics?.forEach(r => {
        const period = r.evaluation_period || 'Unknown';
        const numericValue = (r as any).raw_numeric_value ?? (r as any).soft_skill_answer_options?.numeric_value;
        if (numericValue != null) {
          const existing = periodQualityMap.get(period) || { total: 0, count: 0 };
          existing.total += numericValue;
          existing.count += 1;
          periodQualityMap.set(period, existing);
        }
      });

      const allPeriods = new Set([...periodSkillMap.keys(), ...periodQualityMap.keys()]);
      const trends: DynamicTrend[] = Array.from(allPeriods).map(period => {
        const skillData = periodSkillMap.get(period);
        const qualityData = periodQualityMap.get(period);

        return {
          period,
          skill_average: skillData ? Number((skillData.total / skillData.count).toFixed(2)) : 0,
          quality_average: qualityData ? Number((qualityData.total / qualityData.count).toFixed(2)) : 0
        };
      }).sort((a, b) => a.period.localeCompare(b.period));

      setDynamics(trends);

    } catch (err: any) {
      console.error('Error fetching HR analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [JSON.stringify(filters)]);

  return {
    progress,
    competencies,
    growthAreas,
    dynamics,
    loading,
    error,
    refetch: fetchAnalytics
  };
};
