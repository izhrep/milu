import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData } from '@/lib/userDataDecryption';
import type { SnapshotContext } from './useSnapshotContext';

export interface CommentByEvaluator {
  evaluator_id: string;
  evaluator_name: string;
  evaluator_type: 'self' | 'supervisor' | 'colleague';
  comment: string;
  created_at: string;
  is_anonymous: boolean;
}

export interface SubSkillResult {
  sub_skill_id: string;
  sub_skill_name: string;
  average_score: number;
  responses: number;
}

export interface SkillDetailedResult {
  skill_id: string;
  skill_name: string;
  skill_description?: string;
  category?: string;
  subcategory?: string;
  average_score: number;
  self_score?: number;
  supervisor_score?: number;
  colleague_score?: number;
  response_count: number;
  sub_skills: SubSkillResult[];
  comments: CommentByEvaluator[];
}

export const useSkillSurveyResultsEnhanced = (userId?: string, diagnosticStageId?: string | null, snapshotContext?: SnapshotContext | null, snapshotResolved: boolean = true) => {
  const [skillResults, setSkillResults] = useState<SkillDetailedResult[]>([]);
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
      setSkillResults([]);
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
        _skill_id: string | undefined;
        _skill_name: string;
        _skill_description: string | undefined;
        _category_name: string | undefined;
        _subcategory_name: string | undefined;
        _numeric_value: number;
      }

      let processedResults: NormalizedResult[];

      if (snapshotContext) {
        // SNAPSHOT MODE: query without live JOINs
        let query = supabase
          .from('hard_skill_results')
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
          const question = snapshotContext.hardQuestionsMap.get(r.question_id);
          const skillId = question?.skillId;
          const skill = skillId ? snapshotContext.hardSkillsMap.get(skillId) : null;
          // Resolve numeric value: raw_numeric_value > snapshot answer option > 0
          let numericValue = r.raw_numeric_value;
          if (numericValue == null && r.answer_option_id) {
            const snapshotOption = snapshotContext.hardAnswerOptionsMap.get(r.answer_option_id);
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
            _skill_id: skillId || undefined,
            _skill_name: skill?.name || '',
            _skill_description: skill?.description || undefined,
            _category_name: skill?.categoryName || undefined,
            _subcategory_name: skill?.subcategoryName || undefined,
            _numeric_value: numericValue ?? 0,
          };
        });
      } else {
        // LIVE MODE: query with JOINs
        let query = supabase
          .from('hard_skill_results')
          .select(`
            id, created_at, evaluating_user_id, evaluated_user_id, answer_option_id,
            comment, is_anonymous_comment, diagnostic_stage_id, assignment_id, question_id,
            hard_skill_questions!inner (
              skill_id,
              hard_skills:skill_id!inner (
                name, description,
                category_hard_skills:category_id (name),
                sub_category_hard_skills:sub_category_id (name)
              )
            ),
            hard_skill_answer_options (numeric_value)
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
          const skill = r.hard_skill_questions?.hard_skills;
          const categoryName = Array.isArray(skill?.category_hard_skills)
            ? skill.category_hard_skills[0]?.name
            : skill?.category_hard_skills?.name;
          const subcategoryName = Array.isArray(skill?.sub_category_hard_skills)
            ? skill.sub_category_hard_skills[0]?.name
            : skill?.sub_category_hard_skills?.name;
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
            _skill_id: r.hard_skill_questions?.skill_id,
            _skill_name: skill?.name || '',
            _skill_description: skill?.description || undefined,
            _category_name: categoryName || undefined,
            _subcategory_name: subcategoryName || undefined,
            _numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
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

      // ===== Group by skills =====
      const skillGroups: { [key: string]: {
        name: string;
        description?: string;
        category?: string;
        subcategory?: string;
        scores: number[];
        self_scores: number[];
        supervisor_scores: number[];
        colleague_scores: number[];
        subSkills: { [subSkillId: string]: { name: string; scores: number[] } };
        comments: CommentByEvaluator[];
      } } = {};

      processedResults.forEach((result) => {
        const skillId = result._skill_id;
        if (!skillId) return;
        
        const score = result._numeric_value;
        const evaluatingUserId = result.evaluating_user_id;
        
        if (!skillGroups[skillId]) {
          skillGroups[skillId] = {
            name: result._skill_name,
            description: result._skill_description,
            category: result._category_name,
            subcategory: result._subcategory_name,
            scores: [],
            self_scores: [],
            supervisor_scores: [],
            colleague_scores: [],
            subSkills: {},
            comments: []
          };
        }

        skillGroups[skillId].scores.push(score);

        // Определяем тип оценивающего по assignment_type (приоритет) или fallback на manager_id
        const assignmentType = result.assignment_id 
          ? assignmentsMap.get(result.assignment_id) 
          : undefined;
        
        const isSelf = evaluatingUserId === userId || assignmentType === 'self';
        const isManager = assignmentType === 'manager' || 
          (!assignmentType && (evaluatingUserId === userManagerId || evaluatingUserId === userHrBpId));

        if (isSelf) {
          skillGroups[skillId].self_scores.push(score);
        } else if (isManager) {
          skillGroups[skillId].supervisor_scores.push(score);
        } else {
          skillGroups[skillId].colleague_scores.push(score);
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

          skillGroups[skillId].comments.push({
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
      const detailedResults: SkillDetailedResult[] = Object.entries(skillGroups).map(([skillId, data]) => {
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

        const subSkills: SubSkillResult[] = Object.entries(data.subSkills).map(([subSkillId, subSkillData]) => ({
          sub_skill_id: subSkillId,
          sub_skill_name: subSkillData.name,
          average_score: subSkillData.scores.reduce((sum, score) => sum + score, 0) / subSkillData.scores.length,
          responses: subSkillData.scores.length
        }));

        return {
          skill_id: skillId,
          skill_name: data.name,
          skill_description: data.description,
          category: data.category,
          subcategory: data.subcategory,
          average_score: averageScore,
          self_score: selfScore,
          supervisor_score: supervisorScore,
          colleague_score: colleagueScore,
          response_count: data.scores.length,
          sub_skills: subSkills,
          comments: data.comments
        };
      });

      setSkillResults(detailedResults);

    } catch (err) {
      console.error('Error fetching enhanced skill survey results:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return {
    skillResults,
    loading,
    error,
    refetch: fetchResults
  };
};
