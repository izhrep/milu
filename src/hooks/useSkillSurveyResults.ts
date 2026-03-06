import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SkillSurveyResult {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  question_id: string;
  answer_option_id: string | null;
  raw_numeric_value?: number | null;
  comment?: string;
  created_at: string;
}

export interface SkillAverageResult {
  skill_id: string;
  skill_name: string;
  average_score: number;
  response_count: number;
}

export const useSkillSurveyResults = (userId?: string) => {
  const [results, setResults] = useState<SkillSurveyResult[]>([]);
  const [skillAverages, setSkillAverages] = useState<SkillAverageResult[]>([]);
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

      // Получаем результаты опроса навыков для пользователя (оптимизированный запрос, исключаем пропущенные)
      const { data: resultsData, error: resultsError } = await supabase
        .from('hard_skill_results')
        .select('id, evaluated_user_id, evaluating_user_id, question_id, answer_option_id, comment, created_at, is_skip')
        .eq('evaluated_user_id', userId)
        .neq('is_skip', true);

      if (resultsError) throw resultsError;
      setResults(resultsData || []);

      // Получаем средние значения по навыкам (исключаем пропущенные)
      const { data: averagesData, error: averagesError } = await supabase
        .from('hard_skill_results')
        .select(`
          raw_numeric_value,
          hard_skill_questions!inner (
            skill_id,
            hard_skills!inner (
              name
            )
          ),
          hard_skill_answer_options (
            numeric_value
          )
        `)
        .eq('evaluated_user_id', userId)
        .neq('is_skip', true);

      if (averagesError) throw averagesError;

      // Группируем результаты по навыкам и вычисляем средние значения
      const skillGroups: { [key: string]: { scores: number[], name: string } } = {};
      
      averagesData?.forEach((result: any) => {
        const skillId = (result as any).hard_skill_questions.skill_id;
        const skillName = (result as any).hard_skill_questions.hard_skills.name;
        const score = (result as any).raw_numeric_value ?? (result as any).hard_skill_answer_options?.numeric_value;

        if (!skillGroups[skillId]) {
          skillGroups[skillId] = {
            scores: [],
            name: skillName
          };
        }
        skillGroups[skillId].scores.push(score);
      });

      const averages: SkillAverageResult[] = Object.entries(skillGroups).map(([skillId, data]) => ({
        skill_id: skillId,
        skill_name: data.name,
        average_score: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
        response_count: data.scores.length
      }));

      setSkillAverages(averages);

    } catch (err) {
      console.error('Error fetching skill survey results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return {
    results,
    skillAverages,
    loading,
    error,
    refetch: fetchResults
  };
};