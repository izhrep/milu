import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData } from '@/lib/userDataDecryption';
import type { SnapshotContext } from './useSnapshotContext';
import { isNotObserved, computeScoredAverage } from '@/lib/diagnosticResultContract';

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

export const useSurvey360ResultsEnhanced = (userId?: string, diagnosticStageId?: string | null, snapshotContext?: SnapshotContext | null, snapshotResolved: boolean = true) => {
  const [qualityResults, setQualityResults] = useState<QualityDetailedResult[]>([]);
  const [summary, setSummary] = useState<EnhancedAggregatedResults['overall_summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable snapshot identifier
  const snapshotId = snapshotContext?.snapshotId ?? null;

  useEffect(() => {
    // Guard: wait for snapshot resolution before fetching
    if (!snapshotResolved) return;
    if (userId && diagnosticStageId) {
      fetchResults();
    } else if (userId && diagnosticStageId === undefined) {
      fetchResults();
    } else {
      setQualityResults([]);
      setSummary(null);
    }
  }, [userId, diagnosticStageId, snapshotId, snapshotResolved]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем информацию о пользователе (из снапшота или live)
      let userManagerId: string | null = null;
      let userHrBpId: string | null = null;

      if (snapshotContext) {
        // В snapshot mode используем assignment_type из snapshot — manager_id не нужен
      } else {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, manager_id, hr_bp_id')
          .eq('id', userId)
          .single();
        if (userError) throw userError;
        userManagerId = userData?.manager_id || null;
        userHrBpId = userData?.hr_bp_id || null;
      }

      // ===== DUAL-PATH: fetch results =====
      interface NormalizedResult {
        id: string;
        created_at: string;
        evaluating_user_id: string;
        evaluated_user_id: string;
        comment: string | null;
        is_anonymous_comment: boolean | null;
        diagnostic_stage_id: string | null;
        assignment_id: string | null;
        question_id: string;
        _quality_id: string | undefined;
        _quality_name: string;
        _quality_description: string | undefined;
        _behavioral_indicators: string | undefined;
        _category_name: string | undefined;
        _subcategory_name: string | undefined;
        _numeric_value: number;
      }

      let processedResults: NormalizedResult[];

      if (snapshotContext) {
        // SNAPSHOT MODE: query without live JOINs
        let query = supabase
          .from('soft_skill_results')
          .select('id, created_at, evaluating_user_id, evaluated_user_id, question_id, raw_numeric_value, answer_option_id, comment, is_anonymous_comment, diagnostic_stage_id, assignment_id')
          .eq('evaluated_user_id', userId!)
          .eq('is_draft', false)
          .neq('is_skip', true);
        
        if (diagnosticStageId) {
          query = query.eq('diagnostic_stage_id', diagnosticStageId);
        }
        
        const { data, error: qError } = await query;
        if (qError) throw qError;
        
        processedResults = (data || []).map((r: any) => {
          const question = snapshotContext.softQuestionsMap.get(r.question_id);
          const qualityId = question?.qualityId;
          const quality = qualityId ? snapshotContext.softSkillsMap.get(qualityId) : null;
          // Resolve numeric value: raw_numeric_value > snapshot answer option > 0
          let numericValue = r.raw_numeric_value;
          if (numericValue == null && r.answer_option_id) {
            const snapshotOption = snapshotContext.softAnswerOptionsMap.get(r.answer_option_id);
            numericValue = snapshotOption?.numericValue;
          }
          return {
            id: r.id,
            created_at: r.created_at,
            evaluating_user_id: r.evaluating_user_id,
            evaluated_user_id: r.evaluated_user_id,
            comment: r.comment,
            is_anonymous_comment: r.is_anonymous_comment,
            diagnostic_stage_id: r.diagnostic_stage_id,
            assignment_id: r.assignment_id,
            question_id: r.question_id,
            _quality_id: qualityId || undefined,
            _quality_name: quality?.name || '',
            _quality_description: quality?.description || undefined,
            _behavioral_indicators: question?.behavioralIndicators || undefined,
            _category_name: quality?.categoryName || undefined,
            _subcategory_name: quality?.subcategoryName || undefined,
            _numeric_value: numericValue ?? 0,
          };
        });
      } else {
        // LIVE MODE: query with JOINs
        let query = supabase
          .from('soft_skill_results')
          .select(`
            id, created_at, evaluating_user_id, evaluated_user_id, answer_option_id,
            comment, is_anonymous_comment, diagnostic_stage_id, assignment_id, question_id,
            soft_skill_questions!inner (
              quality_id,
              behavioral_indicators,
              soft_skills!soft_skill_questions_soft_skill_id_fkey (
                name, description,
                category_soft_skills:category_id (name),
                sub_category_soft_skills:sub_category_id (name)
              )
            ),
            soft_skill_answer_options (numeric_value)
          `)
          .eq('evaluated_user_id', userId!)
          .eq('is_draft', false)
          .neq('is_skip', true);
        
        if (diagnosticStageId) {
          query = query.eq('diagnostic_stage_id', diagnosticStageId);
        }
        
        const { data, error: qError } = await query;
        if (qError) throw qError;
        
        processedResults = (data || []).map((r: any) => {
          const quality = r.soft_skill_questions?.soft_skills;
          const question = r.soft_skill_questions;
          const categoryName = Array.isArray(quality?.category_soft_skills)
            ? quality.category_soft_skills[0]?.name
            : quality?.category_soft_skills?.name;
          const subcategoryName = Array.isArray(quality?.sub_category_soft_skills)
            ? quality.sub_category_soft_skills[0]?.name
            : quality?.sub_category_soft_skills?.name;
          return {
            id: r.id,
            created_at: r.created_at,
            evaluating_user_id: r.evaluating_user_id,
            evaluated_user_id: r.evaluated_user_id,
            comment: r.comment,
            is_anonymous_comment: r.is_anonymous_comment,
            diagnostic_stage_id: r.diagnostic_stage_id,
            assignment_id: r.assignment_id,
            question_id: r.question_id,
            _quality_id: r.soft_skill_questions?.quality_id,
            _quality_name: quality?.name || '',
            _quality_description: quality?.description || undefined,
            _behavioral_indicators: question?.behavioral_indicators || undefined,
            _category_name: categoryName || undefined,
            _subcategory_name: subcategoryName || undefined,
            _numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
          };
        });
      }

      // ===== Assignments (snapshot or live) =====
      const assignmentIds = [...new Set(processedResults.map(r => r.assignment_id).filter(Boolean))];
      const assignmentsMap = new Map<string, string>();
      if (snapshotContext) {
        snapshotContext.assignmentsMap.forEach((a, id) => {
          if (a.assignmentType) assignmentsMap.set(id, a.assignmentType);
        });
      } else {
        if (assignmentIds.length > 0) {
          const { data: assignments } = await supabase
            .from('survey_360_assignments')
            .select('id, assignment_type')
            .in('id', assignmentIds);
          (assignments || []).forEach((a: any) => {
            assignmentsMap.set(a.id, a.assignment_type);
          });
        }
      }

      // ===== Evaluator names (snapshot or live) =====
      const evaluatorIds = [...new Set(processedResults.map(r => r.evaluating_user_id))];
      const evaluatorsMap = new Map<string, string>();
      
      if (snapshotContext) {
        evaluatorIds.forEach(id => {
          const u = snapshotContext.usersMap.get(id);
          if (u) {
            const fullName = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
            evaluatorsMap.set(id, fullName || 'Неизвестный');
          }
        });
      } else {
        const { data: evaluatorsData } = await supabase
          .from('users')
          .select('id, first_name, last_name, middle_name, email')
          .in('id', evaluatorIds);

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
      }

      // Получаем текущего пользователя для проверки анонимности
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id;
      const isCurrentUserEvaluated = currentUserId === userId;

      // ===== Group by qualities =====
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

      processedResults.forEach((result) => {
        const qualityId = result._quality_id;
        if (!qualityId) return;

        const score = result._numeric_value;
        const evaluatingUserId = result.evaluating_user_id;

        if (!qualityGroups[qualityId]) {
          qualityGroups[qualityId] = {
            name: result._quality_name,
            description: result._quality_description,
            behavioral_indicators: result._behavioral_indicators,
            category: result._category_name,
            subcategory: result._subcategory_name,
            scores: [],
            self_scores: [],
            supervisor_scores: [],
            colleague_scores: [],
            comments: []
          };
        }

        qualityGroups[qualityId].scores.push(score);

        // Определяем тип оценивающего по assignment_type (приоритет)
        const assignmentType = result.assignment_id 
          ? assignmentsMap.get(result.assignment_id) 
          : undefined;
        
        const isSelf = evaluatingUserId === userId || assignmentType === 'self';
        const isManager = assignmentType === 'manager';
        
        if (!isNotObserved(score)) {
          if (isSelf) {
            qualityGroups[qualityId].self_scores.push(score);
          } else if (isManager) {
            qualityGroups[qualityId].supervisor_scores.push(score);
          } else {
            qualityGroups[qualityId].colleague_scores.push(score);
          }
        }

        // Добавляем комментарий
        if (result.comment) {
          const evaluatorType = isSelf ? 'self' 
            : isManager ? 'supervisor' 
            : 'colleague';

          const isAnonymous = result.is_anonymous_comment === true;
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
        const averageScore = computeScoredAverage(data.scores) ?? 0;
        const selfScore = computeScoredAverage(data.self_scores) ?? undefined;
        const supervisorScore = computeScoredAverage(data.supervisor_scores) ?? undefined;
        const colleagueScore = computeScoredAverage(data.colleague_scores) ?? undefined;

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
