import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { decryptUserData, getFullName, type DecryptedUserData } from '@/lib/userDataDecryption';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CommentField } from '@/components/assessment/CommentField';
import { useStageTemplateConfig } from '@/hooks/useStageTemplateConfig';

interface SkillSurveyQuestion {
  id: string;
  skill_id: string;
  question_text: string;
  order_index: number;
  hard_skills: {
    name: string;
    description?: string;
    category?: string;
  };
}

interface SkillSurveyAnswerOption {
  id: string;
  numeric_value: number;
  title: string;
  description: string;
}

interface SkillSurveyAnswer {
  question_id: string;
  answer_option_id: string;
  comment?: string;
  is_anonymous_comment?: boolean;
}

const SkillSurveyQuestionsPage = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user: currentUser } = useAuth();
  
  const [questions, setQuestions] = useState<SkillSurveyQuestion[]>([]);
  const [answerOptions, setAnswerOptions] = useState<SkillSurveyAnswerOption[]>([]);
  const [answers, setAnswers] = useState<Record<string, SkillSurveyAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [evaluatedUser, setEvaluatedUser] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [evaluatorType, setEvaluatorType] = useState<'self' | 'manager' | 'peer'>('self');
  const [diagnosticStageId, setDiagnosticStageId] = useState<string | undefined>(undefined);

  // Single source of truth for stage config
  const { config: stageConfig, loading: stageConfigLoading } = useStageTemplateConfig(diagnosticStageId);

  useEffect(() => {
    if (assignmentId && currentUser) {
      fetchAssignment();
    }
  }, [assignmentId, currentUser]);

  // Check hard_skills_enabled after stageConfig resolves
  useEffect(() => {
    if (diagnosticStageId && !stageConfigLoading && !stageConfig.hardSkillsEnabled) {
      toast.error('Оценка hard-навыков отключена в текущем шаблоне');
      navigate('/my-assignments');
    }
  }, [diagnosticStageId, stageConfigLoading, stageConfig.hardSkillsEnabled, navigate]);

  const fetchAssignment = async () => {
    try {
      setLoading(true);

      // Получаем данные о назначении из survey_360_assignments
      const { data: assignment, error: assignmentError } = await supabase
        .from('survey_360_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignmentData(assignment);
      setDiagnosticStageId(assignment.diagnostic_stage_id ?? undefined);

      // Определяем тип оценивающего
      const isSelf = assignment.evaluated_user_id === currentUser?.id;
      const isManager = assignment.assignment_type === 'manager_to_employee';
      const respondentType: 'self' | 'manager' | 'peer' = isSelf ? 'self' : isManager ? 'manager' : 'peer';
      setEvaluatorType(respondentType);

      // Получаем данные об оцениваемом пользователе с должностью и грейдом
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id, 
          first_name,
          last_name,
          middle_name,
          email, 
          grade_id,
          position_id,
          positions (
            name
          ),
          grades (
            name,
            level
          )
        ` as any)
        .eq('id', (assignment as any).evaluated_user_id)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('Пользователь не найден');
      
      const userDataTyped = userData as any;
      
      if (!userDataTyped.grade_id) {
        toast.error('У пользователя не указан грейд');
        return;
      }
      
      // Расшифровываем данные пользователя
      const decryptedUser = await decryptUserData({
        id: userDataTyped.id,
        first_name: userDataTyped.first_name || '',
        last_name: userDataTyped.last_name || '',
        middle_name: userDataTyped.middle_name || '',
        email: userDataTyped.email || '',
      });
      
      setEvaluatedUser({
        ...decryptedUser,
        grade_id: userDataTyped.grade_id,
        position_id: userDataTyped.position_id,
        positions: userDataTyped.positions,
        grades: userDataTyped.grades,
      });

      // Получаем навыки для грейда пользователя
      const { data: gradeSkills, error: gradeSkillsError } = await supabase
        .from('grade_skills')
        .select('skill_id')
        .eq('grade_id', (userData as any).grade_id);

      if (gradeSkillsError) throw gradeSkillsError;

      const skillIds = gradeSkills?.map(gs => gs.skill_id) || [];

      if (skillIds.length === 0) {
        toast.error('Для грейда пользователя не настроены навыки');
        return;
      }

      // Получаем вопросы по навыкам грейда
      const { data: allQuestions } = await supabase
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
      
      console.log('Found questions for grade:', allQuestions?.length || 0);

      if (!allQuestions || allQuestions.length === 0) {
        toast.error('Вопросы по навыкам грейда не найдены');
        return;
      }

      // Фильтруем вопросы по типу респондента
      // visibility_restriction_type указывает, от какой роли СКРЫТЬ вопрос
      const filteredQuestions = allQuestions.filter((q: any) => {
        if (!q.visibility_restriction_enabled) return true;
        if (!q.visibility_restriction_type) return true;
        return q.visibility_restriction_type !== respondentType;
      });

      console.log('Filtered questions by respondent type:', filteredQuestions.length);

      if (filteredQuestions.length === 0) {
        toast.error('Нет доступных вопросов для данного типа оценки');
        return;
      }

      // Получаем варианты ответов
      const { data: optionsData, error: optionsError } = await supabase
        .from('hard_skill_answer_options')
        .select('*')
        .order('numeric_value');

      if (optionsError) throw optionsError;
      setQuestions(filteredQuestions);
      // Answer options will be scale-filtered after stageConfig resolves
      setAnswerOptions(optionsData || []);

      // Загружаем ранее сохраненные ответы если они есть
      const { data: existingResults } = await supabase
        .from('hard_skill_results')
        .select('question_id, answer_option_id, comment, is_anonymous_comment')
        .eq('evaluated_user_id', (assignment as any).evaluated_user_id)
        .eq('evaluating_user_id', currentUser?.id);

      if (existingResults && existingResults.length > 0) {
        const loadedAnswers: Record<string, SkillSurveyAnswer> = {};
        existingResults.forEach((result: any) => {
          loadedAnswers[result.question_id] = {
            question_id: result.question_id,
            answer_option_id: result.answer_option_id,
            comment: result.comment,
            is_anonymous_comment: result.is_anonymous_comment ?? false
          };
        });
        setAnswers(loadedAnswers);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (questionId: string, answerOptionId: string, comment?: string, isAnonymous?: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        answer_option_id: answerOptionId,
        comment,
        is_anonymous_comment: isAnonymous ?? prev[questionId]?.is_anonymous_comment ?? false
      }
    }));
  };

  const updateComment = (questionId: string, comment: string, isAnonymous: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        comment,
        is_anonymous_comment: isAnonymous
      }
    }));
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !assignmentData || !evaluatedUser) {
      toast.error('Данные не загружены');
      return;
    }

    const answeredQuestions = Object.keys(answers).length;
    if (answeredQuestions < questions.length) {
      toast.error(`Пожалуйста, ответьте на все вопросы (${answeredQuestions}/${questions.length})`);
      return;
    }

    try {
      console.log('Starting save with:', {
        assignmentId,
        evaluatedUserId: (assignmentData as any).evaluated_user_id,
        evaluatingUserId: currentUser.id,
        answersCount: Object.values(answers).length,
        diagnosticStageId: (assignmentData as any).diagnostic_stage_id
      });

      // Удаляем старые результаты для этого назначения
      const { error: deleteError } = await supabase
        .from('hard_skill_results')
        .delete()
        .eq('evaluated_user_id', (assignmentData as any).evaluated_user_id)
        .eq('evaluating_user_id', currentUser.id)
        .eq('assignment_id', assignmentId);

      if (deleteError) {
        console.error('Error deleting old results:', deleteError);
      }

      // Сохраняем результаты с assignment_id и diagnostic_stage_id
      const results = Object.values(answers).map(answer => {
        const matchedOption = answerOptions.find(o => o.id === answer.answer_option_id);
        return {
          evaluated_user_id: (assignmentData as any).evaluated_user_id,
          evaluating_user_id: currentUser.id,
          question_id: answer.question_id,
          answer_option_id: answer.answer_option_id,
          raw_numeric_value: matchedOption?.numeric_value ?? null,
          comment: answer.comment || null,
          is_anonymous_comment: answer.is_anonymous_comment ?? false,
          assignment_id: assignmentId,
          diagnostic_stage_id: (assignmentData as any).diagnostic_stage_id,
          is_draft: false
        };
      });

      console.log('Inserting results:', results.length);

      const { data: insertedResults, error: resultsError } = await supabase
        .from('hard_skill_results')
        .insert(results)
        .select();

      if (resultsError) {
        console.error('Error saving results:', resultsError);
        toast.error(`Ошибка при сохранении результатов: ${resultsError.message}`);
        return;
      }

      console.log('Results saved successfully:', insertedResults?.length);

      // Обновляем статус назначения на completed
      const { error: assignmentError } = await supabase
        .from('survey_360_assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);

      if (assignmentError) {
        console.error('Error updating assignment status:', assignmentError);
      }

      // Обновляем статус задачи
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('user_id', currentUser.id)
        .eq('status', 'pending');

      if (tasks && tasks.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', tasks[0].id);
      }

      toast.success('Оценка навыков успешно отправлена!');
      
      // Даем время триггерам агрегации сработать
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Переходим на страницу результатов
      navigate(`/assessment/results/${(assignmentData as any).evaluated_user_id}`);
    } catch (err) {
      console.error('Error submitting results:', err);
      toast.error('Ошибка при сохранении результатов');
    }
  };

  if (loading || !assignmentData || !evaluatedUser) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Breadcrumbs />
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-secondary">Нет доступных вопросов для этой должности</p>
            <button 
              onClick={() => navigate('/development')}
              className="mt-4 text-brand-purple hover:text-brand-purple/90"
            >
              Вернуться назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  // Filter answer options by frozen scale bounds for template-based stages
  const filteredAnswerOptions = !stageConfig.isLegacy
    ? answerOptions.filter(opt => opt.numeric_value >= stageConfig.hardScaleMin && opt.numeric_value <= stageConfig.hardScaleMax)
    : answerOptions;
  const progress = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
  const isSelfAssessment = assignmentData.evaluated_user_id === currentUser?.id;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Breadcrumbs />
      
      {/* Header */}
      <div className="flex items-center mb-8">
        <button 
          onClick={() => navigate('/development')}
          className="mr-4 p-2 hover:bg-surface-tertiary rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex-1">
          <p className="text-sm text-text-secondary">Обратно к разделу «Мое развитие»</p>
          <h1 className="text-2xl font-bold text-text-primary">
            {isSelfAssessment ? 'Самооценка профессиональных навыков' : `Оценка навыков сотрудника: ${getFullName(evaluatedUser)}`}
          </h1>
        </div>
      </div>

      <p className="text-text-secondary mb-8 leading-relaxed">
        {isSelfAssessment 
          ? 'На этой странице вы оцениваете свои профессиональные навыки. Данный метод позволяет выявить сильные стороны, определить зоны роста и составить персональный план развития.'
          : `Вы оцениваете профессиональные навыки сотрудника ${getFullName(evaluatedUser)}. Ваша оценка поможет сформировать объективное представление о компетенциях сотрудника.`
        }
      </p>

      {/* Progress Bar */}
      <div className="bg-surface-primary rounded-2xl p-6 border border-border mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">Прогресс прохождения</span>
          <span className="text-sm text-text-secondary">{currentQuestionIndex + 1} из {questions.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Profile Section */}
      <div className="flex items-center justify-between mb-8 bg-surface-primary rounded-2xl p-6 border border-border">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-purple to-brand-pink flex items-center justify-center mr-4">
            <span className="text-white font-semibold text-lg">
              {getFullName(evaluatedUser)?.charAt(0) || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{getFullName(evaluatedUser)}</h2>
            <p className="text-text-secondary">
              {(evaluatedUser as any).positions?.name || 'Сотрудник'} 
              {(evaluatedUser as any).grades?.name && ` • ${(evaluatedUser as any).grades?.name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-surface-primary rounded-2xl p-8 border border-border mb-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Вопрос {currentQuestionIndex + 1}<span className="text-text-secondary">/{questions.length}</span>
          </h2>
          <p className="text-brand-teal font-medium">
            {currentQuestion.hard_skills?.name}
          </p>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-text-primary mb-4">
            {currentQuestion.question_text}
          </h3>
          {currentQuestion.hard_skills?.description && (
            <p className="text-text-secondary text-sm">{currentQuestion.hard_skills.description}</p>
          )}
        </div>

        {/* Answer Options */}
        <div className="space-y-3 mb-8">
          {filteredAnswerOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => updateAnswer(currentQuestion.id, option.id, answers[currentQuestion.id]?.comment)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                answers[currentQuestion.id]?.answer_option_id === option.id
                  ? 'bg-brand-teal/10 border-brand-teal text-text-primary'
                  : 'bg-surface-secondary border-border text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              <div className="flex items-center">
                <span className="font-semibold mr-3">{option.numeric_value}.</span>
                <div>
                  <div className="font-medium">{option.title}</div>
                  <div className="text-sm text-text-secondary">{option.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Comment Section */}
        {answers[currentQuestion.id]?.answer_option_id && (
          <CommentField
            questionId={currentQuestion.id}
            comment={answers[currentQuestion.id]?.comment || ''}
            isAnonymous={answers[currentQuestion.id]?.is_anonymous_comment ?? false}
            evaluatorType={evaluatorType}
            onCommentChange={(value) => updateComment(
              currentQuestion.id, 
              value,
              answers[currentQuestion.id]?.is_anonymous_comment ?? false
            )}
            onAnonymousChange={(value) => updateComment(
              currentQuestion.id,
              answers[currentQuestion.id]?.comment || '',
              value
            )}
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            size="lg"
          >
            Предыдущий вопрос
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!answers[currentQuestion.id]}
            size="lg"
          >
            {currentQuestionIndex === questions.length - 1 ? 'Завершить опрос' : 'Следующий вопрос'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SkillSurveyQuestionsPage;