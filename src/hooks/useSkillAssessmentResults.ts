import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SkillAssessmentSummary {
  skill_id: string;
  skill_name: string;
  skill_category: string;
  self_score?: number;
  supervisor_score?: number;
  overall_average: number;
  gap_analysis: number; // Разница между целевым (5) и текущим уровнем
}

export interface SkillAggregatedResults {
  self_assessment: SkillAssessmentSummary[];
  supervisor_assessment: SkillAssessmentSummary[];
  overall_summary: {
    total_skills: number;
    average_self_score: number;
    average_supervisor_score: number;
    overall_average: number;
    priority_skills: SkillAssessmentSummary[]; // Навыки с наибольшим gap
  };
}

export const useSkillAssessmentResults = (userId?: string) => {
  const [aggregatedResults, setAggregatedResults] = useState<SkillAggregatedResults | null>(null);
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

      // Получаем все результаты навыков для пользователя
      const { data: resultsData, error: resultsError } = await supabase
        .from('hard_skill_results')
        .select(`
          *,
          hard_skill_questions!inner (
            skill_id
          )
        `)
        .eq('evaluated_user_id', userId);
      
      if (resultsError) throw resultsError;

      // Отдельно получаем данные о навыках и ответах
      const questionIds = Array.from(new Set(resultsData?.map((r: any) => r.question_id) || []));
      const answerOptionIds = Array.from(new Set(
        resultsData?.map((r: any) => r.answer_option_id).filter(Boolean) || []
      ));

      const questionsPromise = supabase
        .from('hard_skill_questions')
        .select('id, skill_id, hard_skills!inner(name, category_id, category_hard_skills(name))')
        .in('id', questionIds);

      const answersPromise = answerOptionIds.length > 0
        ? supabase
            .from('hard_skill_answer_options')
            .select('id, numeric_value')
            .in('id', answerOptionIds)
        : Promise.resolve({ data: [] as any[] });

      const [{ data: questionsData }, { data: answerOptionsData }] = await Promise.all([
        questionsPromise,
        answersPromise,
      ]);

      // Создаем мапы для быстрого доступа
      const questionsMap = new Map((questionsData || []).map((q: any) => [q.id, q]));
      const answersMap = new Map((answerOptionsData || []).map((a: any) => [a.id, a]));

      if (resultsError) throw resultsError;

      // Получаем информацию о руководителе пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('manager_id, hr_bp_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Группируем результаты по навыкам и типам оценивающих
      const skillGroups: { [key: string]: {
        name: string;
        category: string;
        self_scores: number[];
        supervisor_scores: number[];
      } } = {};

      resultsData?.forEach((result: any) => {
        const question: any = questionsMap.get(result.question_id);
        const answer: any = answersMap.get(result.answer_option_id);
        
        // COALESCE: raw_numeric_value first, then legacy answer_option numeric_value
        const score = result.raw_numeric_value ?? answer?.numeric_value;
        if (!question || score == null) return;
        
        const skillId = question.skill_id;
        const skillName = question.hard_skills?.name || 'Неизвестно';
        const categoryName = question.hard_skills?.category_hard_skills?.name;
        const skillCategory = categoryName || 'Общие';
        const evaluatingUserId = result.evaluating_user_id;

        if (!skillGroups[skillId]) {
          skillGroups[skillId] = {
            name: skillName,
            category: skillCategory,
            self_scores: [],
            supervisor_scores: []
          };
        }

        if (evaluatingUserId === userId) {
          // Самооценка
          skillGroups[skillId].self_scores.push(score);
        } else if (evaluatingUserId === userData.manager_id || evaluatingUserId === userData.hr_bp_id) {
          // Оценка руководителя
          skillGroups[skillId].supervisor_scores.push(score);
        }
      });

      // Вычисляем агрегированные результаты
      const skillResults: SkillAssessmentSummary[] = Object.entries(skillGroups).map(([skillId, data]) => {
        const selfAvg = data.self_scores.length > 0 
          ? data.self_scores.reduce((sum, score) => sum + score, 0) / data.self_scores.length 
          : undefined;
        
        const supervisorAvg = data.supervisor_scores.length > 0 
          ? data.supervisor_scores.reduce((sum, score) => sum + score, 0) / data.supervisor_scores.length 
          : undefined;

        const allScores = [...data.self_scores, ...data.supervisor_scores];
        const overallAvg = allScores.length > 0 
          ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length 
          : 0;

        const gapAnalysis = 5 - overallAvg; // Целевой уровень = 5

        return {
          skill_id: skillId,
          skill_name: data.name,
          skill_category: data.category,
          self_score: selfAvg,
          supervisor_score: supervisorAvg,
          overall_average: overallAvg,
          gap_analysis: gapAnalysis
        };
      });

      // Вычисляем общую сводку
      const selfScores = skillResults.filter(s => s.self_score !== undefined).map(s => s.self_score!);
      const supervisorScores = skillResults.filter(s => s.supervisor_score !== undefined).map(s => s.supervisor_score!);

      // Приоритетные навыки (с наибольшим gap)
      const prioritySkills = [...skillResults]
        .sort((a, b) => b.gap_analysis - a.gap_analysis)
        .slice(0, 3);

      const summary = {
        total_skills: skillResults.length,
        average_self_score: selfScores.length > 0 ? selfScores.reduce((sum, score) => sum + score, 0) / selfScores.length : 0,
        average_supervisor_score: supervisorScores.length > 0 ? supervisorScores.reduce((sum, score) => sum + score, 0) / supervisorScores.length : 0,
        overall_average: skillResults.reduce((sum, s) => sum + s.overall_average, 0) / (skillResults.length || 1),
        priority_skills: prioritySkills
      };

      setAggregatedResults({
        self_assessment: skillResults.filter(s => s.self_score !== undefined),
        supervisor_assessment: skillResults.filter(s => s.supervisor_score !== undefined),
        overall_summary: summary
      });

    } catch (err) {
      console.error('Error fetching skill assessment results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return {
    aggregatedResults,
    loading,
    error,
    refetch: fetchResults
  };
};