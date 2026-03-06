import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData } from '@/lib/userDataDecryption';

export interface CommentByEvaluator {
  evaluator_id: string;
  evaluator_name: string;
  evaluator_type: 'self' | 'supervisor' | 'colleague';
  comment: string;
  created_at: string;
  is_anonymous: boolean;
}

export interface QualityDetailedResult {
  quality_id: string;
  quality_name: string;
  quality_description?: string;
  behavioral_indicators?: string;
  category?: string;
  subcategory?: string;
  average_score: number;
  self_score?: number;
  supervisor_score?: number;
  colleague_score?: number;
  response_count: number;
  comments: CommentByEvaluator[];
}

export interface EnhancedAggregatedResults {
  qualities: QualityDetailedResult[];
  overall_summary: {
    total_qualities: number;
    average_self_score: number;
    average_supervisor_score: number;
    average_colleague_score: number;
    overall_average: number;
  };
}

export const useSurvey360ResultsEnhanced = (userId?: string, diagnosticStageId?: string | null) => {
  const [qualityResults, setQualityResults] = useState<QualityDetailedResult[]>([]);
  const [summary, setSummary] = useState<EnhancedAggregatedResults['overall_summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && diagnosticStageId) {
      fetchResults();
    } else if (userId && diagnosticStageId === undefined) {
      // Если diagnosticStageId не передан вообще - старое поведение
      fetchResults();
    } else {
      // Если diagnosticStageId = null, сбрасываем результаты
      setQualityResults([]);
      setSummary(null);
    }
  }, [userId, diagnosticStageId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем информацию о пользователе
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, manager_id, hr_bp_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Получаем все результаты 360 для пользователя с комментариями
      // ВАЖНО: Peer-оценки включают ВСЕ оценки коллег с is_draft=false (без привязки к структуре подчинённости)
      let query = supabase
        .from('soft_skill_results')
        .select(`
          id,
          created_at,
          evaluating_user_id,
          evaluated_user_id,
          answer_option_id,
          comment,
          is_anonymous_comment,
          diagnostic_stage_id,
          assignment_id,
          soft_skill_questions!inner (
            quality_id,
            behavioral_indicators,
            soft_skills!soft_skill_questions_soft_skill_id_fkey (
              name,
              description,
              category_soft_skills:category_id (
                name
              ),
              sub_category_soft_skills:sub_category_id (
                name
              )
            )
          ),
          soft_skill_answer_options (
            numeric_value
          )
        `)
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false)
        .neq('is_skip', true);

      // Фильтрация по diagnostic_stage_id если передан
      if (diagnosticStageId) {
        query = query.eq('diagnostic_stage_id', diagnosticStageId);
      }

      const { data: resultsData, error: resultsError } = await query;

      if (resultsError) throw resultsError;

      // Получаем информацию об assignments для корректной сегментации
      const assignmentIds = [...new Set(resultsData?.map(r => r.assignment_id).filter(Boolean) || [])];
      const assignmentsMap = new Map<string, string>();
      if (assignmentIds.length > 0) {
        const { data: assignments } = await supabase
          .from('survey_360_assignments')
          .select('id, assignment_type')
          .in('id', assignmentIds);
        
        (assignments || []).forEach((a: any) => {
          assignmentsMap.set(a.id, a.assignment_type);
        });
      }

      // Получаем имена всех оценивающих
      const evaluatorIds = [...new Set(resultsData?.map(r => r.evaluating_user_id) || [])];
      const { data: evaluatorsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, middle_name, email')
        .in('id', evaluatorIds);

      // Расшифровываем данные пользователей
      const evaluatorsMap = new Map<string, string>();
      if (evaluatorsData) {
        for (const evaluator of evaluatorsData) {
          const decrypted = await decryptUserData({
            id: evaluator.id,
            first_name: evaluator.first_name,
            last_name: evaluator.last_name,
            middle_name: evaluator.middle_name || '',
            email: evaluator.email
          });
          const fullName = [decrypted.last_name, decrypted.first_name, decrypted.middle_name]
            .filter(Boolean)
            .join(' ');
          evaluatorsMap.set(evaluator.id, fullName);
        }
      }

      // Получаем текущего пользователя для проверки анонимности
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id;
      const isCurrentUserEvaluated = currentUserId === userId;

      // Группируем результаты по качествам
      const qualityGroups: { [key: string]: {
        name: string;
        description?: string;
        behavioral_indicators?: string;
        category?: string;
        subcategory?: string;
        scores: number[];
        self_scores: number[];
        supervisor_scores: number[];
        colleague_scores: number[];
        comments: CommentByEvaluator[];
      } } = {};

      resultsData?.forEach((result: any) => {
        const qualityId = result.soft_skill_questions.quality_id;
        const quality = result.soft_skill_questions.soft_skills;
        const question = result.soft_skill_questions;
        const score = (result as any).raw_numeric_value ?? result.soft_skill_answer_options?.numeric_value;
        const evaluatingUserId = result.evaluating_user_id;
        
        // Получаем категорию и подкатегорию
        const categoryName = Array.isArray(quality.category_soft_skills)
          ? quality.category_soft_skills[0]?.name
          : quality.category_soft_skills?.name;
        const subcategoryName = Array.isArray(quality.sub_category_soft_skills)
          ? quality.sub_category_soft_skills[0]?.name
          : quality.sub_category_soft_skills?.name;

        if (!qualityGroups[qualityId]) {
          qualityGroups[qualityId] = {
            name: quality.name,
            description: quality.description,
            behavioral_indicators: question.behavioral_indicators,
            category: categoryName,
            subcategory: subcategoryName,
            scores: [],
            self_scores: [],
            supervisor_scores: [],
            colleague_scores: [],
            comments: []
          };
        }

        // Добавляем оценку
        qualityGroups[qualityId].scores.push(score);

        // Определяем тип оценивающего по assignment_type (приоритет)
        // КРИТИЧЕСКАЯ ЛОГИКА: Тип оценщика определяется по assignment_type, а не по manager_id
        const assignmentType = result.assignment_id 
          ? assignmentsMap.get(result.assignment_id) 
          : undefined;
        
        const isSelf = evaluatingUserId === userId || assignmentType === 'self';
        const isManager = assignmentType === 'manager';
        
        if (isSelf) {
          qualityGroups[qualityId].self_scores.push(score);
        } else if (isManager) {
          qualityGroups[qualityId].supervisor_scores.push(score);
        } else {
          // Все остальные (peer, undefined) - коллеги
          qualityGroups[qualityId].colleague_scores.push(score);
        }

        // Добавляем комментарий
        if (result.comment) {
          const evaluatorType = isSelf ? 'self' 
            : isManager ? 'supervisor' 
            : 'colleague';

          // КРИТИЧЕСКАЯ ЛОГИКА БЕЗОПАСНОСТИ:
          // Если is_anonymous_comment === true, то для оцениваемого пользователя
          // НЕ передаём evaluator_id и evaluator_name — они будут замаскированы
          const isAnonymous = result.is_anonymous_comment === true;
          
          // Маскируем данные оценщика для анонимных комментариев,
          // если текущий пользователь — это тот, кого оценивали
          const shouldMaskEvaluator = isAnonymous && isCurrentUserEvaluated;
          const evaluatorName = shouldMaskEvaluator 
            ? 'Анонимно' 
            : (evaluatorsMap.get(evaluatingUserId) || 'Неизвестный');

          qualityGroups[qualityId].comments.push({
            evaluator_id: shouldMaskEvaluator ? '' : evaluatingUserId,
            evaluator_name: evaluatorName,
            evaluator_type: evaluatorType,
            comment: result.comment,
            created_at: result.created_at,
            is_anonymous: isAnonymous
          });
        }
      });

      // Формируем итоговые результаты
      const detailedResults: QualityDetailedResult[] = Object.entries(qualityGroups).map(([qualityId, data]) => {
        const averageScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
        const selfScore = data.self_scores.length > 0
          ? data.self_scores.reduce((sum, score) => sum + score, 0) / data.self_scores.length
          : undefined;
        const supervisorScore = data.supervisor_scores.length > 0
          ? data.supervisor_scores.reduce((sum, score) => sum + score, 0) / data.supervisor_scores.length
          : undefined;
        const colleagueScore = data.colleague_scores.length > 0
          ? data.colleague_scores.reduce((sum, score) => sum + score, 0) / data.colleague_scores.length
          : undefined;

        return {
          quality_id: qualityId,
          quality_name: data.name,
          quality_description: data.description,
          behavioral_indicators: data.behavioral_indicators,
          category: data.category,
          subcategory: data.subcategory,
          average_score: averageScore,
          self_score: selfScore,
          supervisor_score: supervisorScore,
          colleague_score: colleagueScore,
          response_count: data.scores.length,
          comments: data.comments
        };
      });

      setQualityResults(detailedResults);

      // Вычисляем сводку
      const selfScores = detailedResults.filter(q => q.self_score !== undefined).map(q => q.self_score!);
      const supervisorScores = detailedResults.filter(q => q.supervisor_score !== undefined).map(q => q.supervisor_score!);
      const colleagueScores = detailedResults.filter(q => q.colleague_score !== undefined).map(q => q.colleague_score!);

      setSummary({
        total_qualities: detailedResults.length,
        average_self_score: selfScores.length > 0 ? selfScores.reduce((sum, s) => sum + s, 0) / selfScores.length : 0,
        average_supervisor_score: supervisorScores.length > 0 ? supervisorScores.reduce((sum, s) => sum + s, 0) / supervisorScores.length : 0,
        average_colleague_score: colleagueScores.length > 0 ? colleagueScores.reduce((sum, s) => sum + s, 0) / colleagueScores.length : 0,
        overall_average: detailedResults.reduce((sum, q) => sum + q.average_score, 0) / (detailedResults.length || 1)
      });

    } catch (err) {
      console.error('Error fetching enhanced 360 survey results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return {
    qualityResults,
    summary,
    loading,
    error,
    refetch: fetchResults
  };
};