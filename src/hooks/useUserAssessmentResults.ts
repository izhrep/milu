import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AssessmentResult {
  id: string;
  user_id: string;
  assessment_period: string | null;
  assessment_date: string;
  quality_id?: string;
  quality_name?: string;
  quality_average?: number;
  skill_id?: string;
  skill_name?: string;
  skill_average?: number;
  total_responses: number;
}

export const useUserAssessmentResults = (userId: string) => {
  const [qualityResults, setQualityResults] = useState<AssessmentResult[]>([]);
  const [skillResults, setSkillResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchAssessmentResults();
    }
  }, [userId]);

  const fetchAssessmentResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем результаты quality
      const { data: qualityData, error: qualityError } = await supabase
        .from('user_assessment_results')
        .select('*, soft_skills(name)')
        .eq('user_id', userId)
        .not('quality_id', 'is', null)
        .order('assessment_date', { ascending: false });

      if (qualityError) throw qualityError;

      // Получаем результаты skill
      const { data: skillData, error: skillError } = await supabase
        .from('user_assessment_results')
        .select('*, skills(name)')
        .eq('user_id', userId)
        .not('skill_id', 'is', null)
        .order('assessment_date', { ascending: false });

      if (skillError) throw skillError;

      // Трансформируем quality results
      const transformedQualityResults: AssessmentResult[] = (qualityData || []).map((item: any) => {
        const avgQuality = (
          (item.self_assessment || 0) +
          (item.peers_average || 0) +
          (item.manager_assessment || 0)
        ) / 3;
        
        return {
          id: item.id,
          user_id: item.user_id,
          assessment_period: item.assessment_period,
          assessment_date: item.assessment_date,
          quality_id: item.quality_id,
          quality_name: item.qualities?.name || 'Неизвестное качество',
          quality_average: avgQuality,
          total_responses: item.total_responses,
        };
      });

      // Трансформируем skill results
      const transformedSkillResults: AssessmentResult[] = (skillData || []).map((item: any) => {
        const avgSkill = (
          (item.self_assessment || 0) +
          (item.peers_average || 0) +
          (item.manager_assessment || 0)
        ) / 3;
        
        return {
          id: item.id,
          user_id: item.user_id,
          assessment_period: item.assessment_period,
          assessment_date: item.assessment_date,
          skill_id: item.skill_id,
          skill_name: item.skills?.name || 'Неизвестный навык',
          skill_average: avgSkill,
          total_responses: item.total_responses,
        };
      });

      setQualityResults(transformedQualityResults);
      setSkillResults(transformedSkillResults);

    } catch (err) {
      console.error('Error fetching assessment results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов оценки');
    } finally {
      setLoading(false);
    }
  };

  return {
    qualityResults,
    skillResults,
    loading,
    error,
    refetch: fetchAssessmentResults
  };
};