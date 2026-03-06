import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SkillSurveyQuestion {
  id: string;
  skill_id: string;
  question_text: string;
  order_index: number;
  visibility_restriction_enabled?: boolean;
  visibility_restriction_type?: string;
  hard_skills: {
    name: string;
    description?: string;
  };
}

export interface SkillSurveyAnswerOption {
  id: string;
  numeric_value: number;
  title: string;
  description: string;
}

export interface SkillSurveyAnswer {
  question_id: string;
  answer_option_id: string;
  comment?: string;
}

export const useSkillSurvey = () => {
  const [questions, setQuestions] = useState<SkillSurveyQuestion[]>([]);
  const [answerOptions, setAnswerOptions] = useState<SkillSurveyAnswerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем варианты ответов
      const { data: optionsData, error: optionsError } = await supabase
        .from('hard_skill_answer_options')
        .select('*')
        .order('order_index', { ascending: true });

      if (optionsError) throw optionsError;
      setAnswerOptions(optionsData || []);

    } catch (err) {
      console.error('Error fetching skill survey data:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionsForGrade = async (gradeId: string, respondentType?: 'self' | 'manager' | 'peer') => {
    try {
      setLoading(true);
      setError(null);

      // Получаем навыки, требуемые для грейда
      const { data: gradeSkills, error: gradeSkillsError } = await supabase
        .from('grade_skills')
        .select('skill_id')
        .eq('grade_id', gradeId);

      if (gradeSkillsError) throw gradeSkillsError;

      const skillIds = gradeSkills?.map(gs => gs.skill_id) || [];

      if (skillIds.length === 0) {
        setQuestions([]);
        return [];
      }

      // Получаем вопросы только по навыкам грейда
      const { data: questionsData, error: questionsError } = await supabase
        .from('hard_skill_questions')
        .select(`
          *,
          hard_skills (
            name,
            description
          )
        `)
        .in('skill_id', skillIds)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      // Фильтруем вопросы по типу респондента
      const filteredQuestions = (questionsData || []).filter(q => {
        // Если ограничение не включено, показываем всем
        if (!q.visibility_restriction_enabled) return true;
        
        // Если тип респондента не указан, показываем все (для совместимости)
        if (!respondentType) return true;
        
        // Если ограничение включено, скрываем от указанного типа
        return q.visibility_restriction_type !== respondentType;
      });

      setQuestions(filteredQuestions);
      return filteredQuestions;

    } catch (err) {
      console.error('Error fetching questions for grade:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке вопросов');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const submitSurveyResults = async (
    userId: string,
    evaluatingUserId: string,
    answers: SkillSurveyAnswer[]
  ) => {
    try {
      setError(null);

      // Удаляем существующие результаты для этой пары пользователей
      const { error: deleteError } = await supabase
        .from('hard_skill_results')
        .delete()
        .eq('evaluated_user_id', userId)
        .eq('evaluating_user_id', evaluatingUserId);

      if (deleteError) throw deleteError;

      // Вставляем новые результаты
      const results = answers.map(answer => ({
        evaluated_user_id: userId,
        evaluating_user_id: evaluatingUserId,
        question_id: answer.question_id,
        answer_option_id: answer.answer_option_id,
        comment: answer.comment
      }));

      const { data, error: insertError } = await supabase
        .from('hard_skill_results')
        .insert(results)
        .select();

      if (insertError) throw insertError;

      return { success: true, data };
    } catch (err) {
      console.error('Error submitting skill survey results:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при сохранении результатов';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    questions,
    answerOptions,
    loading,
    error,
    getQuestionsForGrade,
    submitSurveyResults,
    refetch: fetchSurveyData
  };
};