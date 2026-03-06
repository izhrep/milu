import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DetailedAssessmentData {
  self_assessment: number | null;
  manager_assessment: number | null;
  peers_average: number | null;
  all_except_self: number | null;
  all_average: number | null;
}

export interface CompetencyDetailedResult {
  competency_id: string;
  competency_name: string;
  competency_type: 'skill' | 'quality';
  category_name?: string; // Добавляем категорию для навыков
  data: DetailedAssessmentData;
}

export interface OverallDetailedResult {
  data: DetailedAssessmentData;
}

export const useDetailedAssessmentResults = (userId: string, diagnosticStageId?: string) => {
  const [overallResults, setOverallResults] = useState<OverallDetailedResult | null>(null);
  const [skillResults, setSkillResults] = useState<CompetencyDetailedResult[]>([]);
  const [qualityResults, setQualityResults] = useState<CompetencyDetailedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchDetailedResults();
    }
  }, [userId, diagnosticStageId]);

  const fetchDetailedResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Определяем фильтр по этапу
      let stageFilter = diagnosticStageId;
      if (!stageFilter) {
        // Получаем активный diagnostic_stage
        const { data: activeStage } = await supabase
          .from('diagnostic_stages')
          .select('id')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        stageFilter = activeStage?.id;
      }

      // Получаем данные из user_assessment_results
      const query = supabase
        .from('user_assessment_results')
        .select('*')
        .eq('user_id', userId);

      if (stageFilter) {
        query.eq('diagnostic_stage_id', stageFilter);
      }

      const { data: assessmentData, error: assessmentError } = await query;

      if (assessmentError) throw assessmentError;

      if (!assessmentData || assessmentData.length === 0) {
        setOverallResults(null);
        setSkillResults([]);
        setQualityResults([]);
        return;
      }

      // Получаем названия навыков и качеств
      const skillIds = [...new Set(assessmentData.filter(r => r.skill_id).map(r => r.skill_id))];
      const qualityIds = [...new Set(assessmentData.filter(r => r.quality_id).map(r => r.quality_id))];

      const { data: skillsData } = await supabase
        .from('hard_skills')
        .select(`
          id, 
          name,
          category_id,
          category_hard_skills:category_id (
            name
          )
        `)
        .in('id', skillIds);

      const { data: qualitiesData } = await supabase
        .from('soft_skills')
        .select('id, name')
        .in('id', qualityIds);

      const skillsMap = new Map(
        skillsData?.map(s => [
          s.id, 
          { 
            name: s.name, 
            category_name: Array.isArray(s.category_hard_skills) 
              ? s.category_hard_skills[0]?.name 
              : (s.category_hard_skills as any)?.name 
          }
        ]) || []
      );
      const qualitiesMap = new Map(qualitiesData?.map(q => [q.id, q.name]) || []);

      // Агрегируем общие результаты
      const overallData = calculateOverallData(assessmentData);
      setOverallResults({ data: overallData });

      // Агрегируем результаты по навыкам
      const skillsResults: CompetencyDetailedResult[] = [];
      for (const skillId of skillIds) {
        const skillRecords = assessmentData.filter(r => r.skill_id === skillId);
        const skillData = calculateOverallData(skillRecords);
        const skillInfo = skillsMap.get(skillId!);
        skillsResults.push({
          competency_id: skillId!,
          competency_name: skillInfo?.name || 'Неизвестный навык',
          category_name: skillInfo?.category_name,
          competency_type: 'skill',
          data: skillData
        });
      }
      setSkillResults(skillsResults);

      // Агрегируем результаты по качествам
      const qualitiesResults: CompetencyDetailedResult[] = [];
      for (const qualityId of qualityIds) {
        const qualityRecords = assessmentData.filter(r => r.quality_id === qualityId);
        const qualityData = calculateOverallData(qualityRecords);
        qualitiesResults.push({
          competency_id: qualityId!,
          competency_name: qualitiesMap.get(qualityId!) || 'Неизвестное качество',
          competency_type: 'quality',
          data: qualityData
        });
      }
      setQualityResults(qualitiesResults);

    } catch (err) {
      console.error('Error fetching detailed assessment results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке детальных результатов');
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallData = (records: any[]): DetailedAssessmentData => {
    if (records.length === 0) {
      return {
        self_assessment: null,
        manager_assessment: null,
        peers_average: null,
        all_except_self: null,
        all_average: null
      };
    }

    // Агрегируем значения
    const self = average(records.map(r => r.self_assessment).filter(v => v != null));
    const manager = average(records.map(r => r.manager_assessment).filter(v => v != null));
    const peers = average(records.map(r => r.peers_average).filter(v => v != null));

    // Все кроме self
    const allExceptSelf = average([manager, peers].filter(v => v != null));

    // Все (включая self)
    const all = average([self, manager, peers].filter(v => v != null));

    return {
      self_assessment: self,
      manager_assessment: manager,
      peers_average: peers,
      all_except_self: allExceptSelf,
      all_average: all
    };
  };

  const average = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  };

  return {
    overallResults,
    skillResults,
    qualityResults,
    loading,
    error,
    refetch: fetchDetailedResults
  };
};
