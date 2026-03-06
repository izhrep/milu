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

export const useSkillSurveyResultsEnhanced = (userId?: string, diagnosticStageId?: string | null) => {
  const [skillResults, setSkillResults] = useState<SkillDetailedResult[]>([]);
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
      setSkillResults([]);
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

      // Получаем все результаты опроса навыков с комментариями (исключаем пропущенные)
      let query = supabase
        .from('hard_skill_results')
        .select(`
          id,
          created_at,
          evaluating_user_id,
          evaluated_user_id,
          answer_option_id,
          comment,
          is_anonymous_comment,
          diagnostic_stage_id,
          hard_skill_questions!inner (
            skill_id,
            hard_skills:skill_id!inner (
              name,
              description,
              category_hard_skills:category_id (
                name
              ),
              sub_category_hard_skills:sub_category_id (
                name
              )
            )
          ),
          hard_skill_answer_options (
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

      // Группируем результаты по навыкам
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

      resultsData?.forEach((result: any) => {
        const skillId = result.hard_skill_questions.skill_id;
        const skill = result.hard_skill_questions.hard_skills;
        const skillName = skill.name;
        const skillDescription = skill.description;
        const score = (result as any).raw_numeric_value ?? result.hard_skill_answer_options?.numeric_value;
        const evaluatingUserId = result.evaluating_user_id;
        
        // Получаем категорию и подкатегорию
        const categoryName = Array.isArray(skill.category_hard_skills)
          ? skill.category_hard_skills[0]?.name
          : skill.category_hard_skills?.name;
        const subcategoryName = Array.isArray(skill.sub_category_hard_skills)
          ? skill.sub_category_hard_skills[0]?.name
          : skill.sub_category_hard_skills?.name;

        if (!skillGroups[skillId]) {
          skillGroups[skillId] = {
            name: skillName,
            description: skillDescription,
            category: categoryName,
            subcategory: subcategoryName,
            scores: [],
            self_scores: [],
            supervisor_scores: [],
            colleague_scores: [],
            subSkills: {},
            comments: []
          };
        }

        // Добавляем оценку
        skillGroups[skillId].scores.push(score);

        // Определяем тип оценивающего
        if (evaluatingUserId === userId) {
          skillGroups[skillId].self_scores.push(score);
        } else if (evaluatingUserId === userData.manager_id || evaluatingUserId === userData.hr_bp_id) {
          skillGroups[skillId].supervisor_scores.push(score);
        } else {
          skillGroups[skillId].colleague_scores.push(score);
        }

        // Добавляем комментарий
        if (result.comment) {
          const evaluatorType = evaluatingUserId === userId ? 'self' 
            : (evaluatingUserId === userData.manager_id || evaluatingUserId === userData.hr_bp_id) ? 'supervisor' 
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