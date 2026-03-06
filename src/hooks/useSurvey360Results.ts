import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Survey360Result {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  question_id: string;
  answer_option_id: string | null;
  raw_numeric_value?: number | null;
  comment?: string;
  created_at: string;
}

export interface QualityAverageResult {
  quality_id: string;
  quality_name: string;
  self_score?: number;
  supervisor_scores: number[];
  colleague_scores: number[];
  overall_average: number;
}

export interface AggregatedResults {
  self_assessment: QualityAverageResult[];
  supervisor_assessment: QualityAverageResult[];
  colleague_assessment: QualityAverageResult[];
  overall_summary: {
    total_qualities: number;
    average_self_score: number;
    average_supervisor_score: number;
    average_colleague_score: number;
    overall_average: number;
  };
}

export const useSurvey360Results = (userId?: string) => {
  const [results, setResults] = useState<Survey360Result[]>([]);
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchResults();
    }
  }, [userId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем все результаты 360 для пользователя (оптимизированный запрос, исключаем пропущенные)
      const { data: resultsData, error: resultsError } = await supabase
        .from('soft_skill_results')
        .select(`
          id,
          evaluated_user_id,
          evaluating_user_id,
          question_id,
          answer_option_id,
          created_at,
          soft_skill_questions!inner (
            quality_id,
            soft_skills:quality_id (
              name
            )
          ),
          soft_skill_answer_options (
            numeric_value
          )
        `)
        .eq('evaluated_user_id', userId)
        .neq('is_skip', true);

      if (resultsError) throw resultsError;
      setResults((resultsData as any[]) || []);

      // Получаем информацию о пользователях (руководители и коллеги)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, manager_id, hr_bp_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Группируем результаты по качествам и типам оценивающих
      const qualityGroups: { [key: string]: {
        name: string;
        self_scores: number[];
        supervisor_scores: number[];
        colleague_scores: number[];
      } } = {};

      resultsData?.forEach((result: any) => {
        const qualityId = result.soft_skill_questions.quality_id;
        const qualityName = result.soft_skill_questions.soft_skills.name;
        const score = result.raw_numeric_value ?? result.soft_skill_answer_options?.numeric_value;
        const evaluatingUserId = result.evaluating_user_id;

        if (!qualityGroups[qualityId]) {
          qualityGroups[qualityId] = {
            name: qualityName,
            self_scores: [],
            supervisor_scores: [],
            colleague_scores: []
          };
        }

        if (evaluatingUserId === userId) {
          // Самооценка
          qualityGroups[qualityId].self_scores.push(score);
        } else if (evaluatingUserId === userData.manager_id || evaluatingUserId === userData.hr_bp_id) {
          // Оценка руководителя
          qualityGroups[qualityId].supervisor_scores.push(score);
        } else {
          // Оценка коллег
          qualityGroups[qualityId].colleague_scores.push(score);
        }
      });

      // Вычисляем агрегированные результаты
      const qualityResults: QualityAverageResult[] = Object.entries(qualityGroups).map(([qualityId, data]) => {
        const selfAvg = data.self_scores.length > 0 
          ? data.self_scores.reduce((sum, score) => sum + score, 0) / data.self_scores.length 
          : undefined;
        
        const supervisorAvg = data.supervisor_scores.length > 0 
          ? data.supervisor_scores.reduce((sum, score) => sum + score, 0) / data.supervisor_scores.length 
          : 0;
        
        const colleagueAvg = data.colleague_scores.length > 0 
          ? data.colleague_scores.reduce((sum, score) => sum + score, 0) / data.colleague_scores.length 
          : 0;

        const allScores = [...data.self_scores, ...data.supervisor_scores, ...data.colleague_scores];
        const overallAvg = allScores.length > 0 
          ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length 
          : 0;

        return {
          quality_id: qualityId,
          quality_name: data.name,
          self_score: selfAvg,
          supervisor_scores: data.supervisor_scores,
          colleague_scores: data.colleague_scores,
          overall_average: overallAvg
        };
      });

      // Вычисляем общую сводку
      const selfScores = qualityResults.filter(q => q.self_score !== undefined).map(q => q.self_score!);
      const supervisorScores = qualityResults.flatMap(q => q.supervisor_scores);
      const colleagueScores = qualityResults.flatMap(q => q.colleague_scores);

      const summary = {
        total_qualities: qualityResults.length,
        average_self_score: selfScores.length > 0 ? selfScores.reduce((sum, score) => sum + score, 0) / selfScores.length : 0,
        average_supervisor_score: supervisorScores.length > 0 ? supervisorScores.reduce((sum, score) => sum + score, 0) / supervisorScores.length : 0,
        average_colleague_score: colleagueScores.length > 0 ? colleagueScores.reduce((sum, score) => sum + score, 0) / colleagueScores.length : 0,
        overall_average: qualityResults.reduce((sum, q) => sum + q.overall_average, 0) / (qualityResults.length || 1)
      };

      setAggregatedResults({
        self_assessment: qualityResults.filter(q => q.self_score !== undefined),
        supervisor_assessment: qualityResults.filter(q => q.supervisor_scores.length > 0),
        colleague_assessment: qualityResults.filter(q => q.colleague_scores.length > 0),
        overall_summary: summary
      });

    } catch (err) {
      console.error('Error fetching 360 survey results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return {
    results,
    aggregatedResults,
    loading,
    error,
    refetch: fetchResults
  };
};