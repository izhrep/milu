import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Survey360Question {
  id: string;
  quality_id: string;
  question_text: string;
  order_index: number;
  visibility_restriction_enabled?: boolean;
  visibility_restriction_type?: string;
}

export interface Survey360AnswerOption {
  id: string;
  numeric_value: number;
  title: string;
  description: string;
}

export interface Survey360Answer {
  question_id: string;
  answer_option_id: string;
  comment?: string;
  is_anonymous_comment?: boolean;
}

export const useSurvey360 = () => {
  const [questions, setQuestions] = useState<Survey360Question[]>([]);
  const [answerOptions, setAnswerOptions] = useState<Survey360AnswerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      
      // Загружаем варианты ответов
      const { data: optionsData, error: optionsError } = await supabase
        .from('soft_skill_answer_options')
        .select('*')
        .order('order_index', { ascending: true });

      if (optionsError) throw optionsError;

      setAnswerOptions(optionsData || []);
    } catch (err) {
      console.error('Error fetching survey data:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных опроса');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionsForGrade = async (gradeId: string, respondentType?: 'self' | 'manager' | 'peer') => {
    try {
      setLoading(true);
      setError(null);

      // Получаем качества, требуемые для грейда
      const { data: gradeQualities, error: gradeQualitiesError } = await supabase
        .from('grade_qualities')
        .select('quality_id')
        .eq('grade_id', gradeId);

      if (gradeQualitiesError) throw gradeQualitiesError;

      const qualityIds = gradeQualities?.map(gq => gq.quality_id) || [];

      if (qualityIds.length === 0) {
        setQuestions([]);
        return [];
      }

      // Получаем вопросы только по качествам грейда
      const { data: questionsData, error: questionsError } = await supabase
        .from('soft_skill_questions')
        .select('*')
        .in('quality_id', qualityIds)
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
    evaluatedUserId: string,
    evaluatingUserId: string,
    answers: Survey360Answer[]
  ) => {
    try {
      console.log('Submitting survey results:', {
        evaluatedUserId,
        evaluatingUserId,
        answersCount: answers.length,
        answers
      });

      // Сначала удаляем существующие результаты для этого пользователя и оценивающего
      const { error: deleteError } = await supabase
        .from('soft_skill_results')
        .delete()
        .eq('evaluated_user_id', evaluatedUserId)
        .eq('evaluating_user_id', evaluatingUserId);

      if (deleteError) {
        console.error('Error deleting existing results:', deleteError);
        throw deleteError;
      }

      const results = answers.map(answer => ({
        evaluated_user_id: evaluatedUserId,
        evaluating_user_id: evaluatingUserId,
        question_id: answer.question_id,
        answer_option_id: answer.answer_option_id,
        comment: answer.comment || null,
        is_anonymous_comment: false,
        evaluation_period: `H${Math.ceil(new Date().getMonth() / 6) + 1}_${new Date().getFullYear()}`
      }));

      console.log('Prepared results for insert:', results);

      const { data, error } = await supabase
        .from('soft_skill_results')
        .insert(results);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Successfully inserted results:', data);
      return { success: true, data };
    } catch (err) {
      console.error('Error submitting survey results:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Ошибка при сохранении результатов' 
      };
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