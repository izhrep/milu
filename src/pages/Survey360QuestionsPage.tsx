import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSurvey360, type Survey360Answer } from '@/hooks/useSurvey360';
import { useAuth } from '@/contexts/AuthContext';
import { decryptUserData, getFullName, type DecryptedUserData } from '@/lib/userDataDecryption';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CommentField } from '@/components/assessment/CommentField';

const Survey360QuestionsPage = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { questions, answerOptions, loading: surveyLoading, submitSurveyResults, getQuestionsForGrade } = useSurvey360();
  const { user: currentUser } = useAuth();
  const { updateTaskStatus } = useTasks();
  
  const [answers, setAnswers] = useState<Record<string, Survey360Answer>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [evaluatedUser, setEvaluatedUser] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluatorType, setEvaluatorType] = useState<'self' | 'manager' | 'peer'>('self');

  // Загружаем данные о назначении и оцениваемом пользователе
  useEffect(() => {
    if (assignmentId) {
      fetchAssignmentData();
    }
  }, [assignmentId]);

  const fetchAssignmentData = async () => {
    try {
      // Получаем данные о назначении
      const { data: assignment, error: assignmentError } = await supabase
        .from('survey_360_assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      
      if (!assignment) {
        toast.error('Оценка недоступна. Проверьте статус согласования списка коллег.');
        navigate('/development');
        return;
      }

      // Проверяем статус назначения
      if (assignment.status !== 'approved') {
        toast.error(`Оценка недоступна. Статус: ${assignment.status}`);
        navigate('/development');
        return;
      }

      setAssignmentData(assignment);

      // Определяем тип оценивающего
      const isSelf = assignment.evaluated_user_id === currentUser?.id;
      const isManager = assignment.assignment_type === 'manager_to_employee';
      const respondentType: 'self' | 'manager' | 'peer' = isSelf ? 'self' : isManager ? 'manager' : 'peer';
      setEvaluatorType(respondentType);

      // Получаем данные об оцениваемом пользователе с грейдом и должностью
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
        .eq('id', assignment.evaluated_user_id)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData) {
        toast.error('Пользователь не найден');
        navigate('/development');
        return;
      }
      
      const userDataTyped = userData as any;

      if (!userDataTyped.grade_id) {
        toast.error('У пользователя не указан грейд');
        navigate('/development');
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

      // Загружаем вопросы для грейда пользователя с учётом типа респондента
      const loadedQuestions = await getQuestionsForGrade(userDataTyped.grade_id, respondentType);
      
      if (!loadedQuestions || loadedQuestions.length === 0) {
        toast.error('Для грейда пользователя не настроены вопросы');
        navigate('/development');
        return;
      }

      // Загружаем ранее сохраненные ответы если они есть
      const { data: existingResults } = await supabase
        .from('soft_skill_results')
        .select('question_id, answer_option_id, comment')
        .eq('evaluated_user_id', assignment.evaluated_user_id)
        .eq('evaluating_user_id', currentUser?.id);

      if (existingResults && existingResults.length > 0) {
        const loadedAnswers: Record<string, Survey360Answer> = {};
        existingResults.forEach((result: any) => {
          loadedAnswers[result.question_id] = {
            question_id: result.question_id,
            answer_option_id: result.answer_option_id,
            comment: result.comment
          };
        });
        setAnswers(loadedAnswers);
      }

      console.log('Loaded questions for grade:', loadedQuestions.length);
      setLoading(false);

    } catch (err) {
      console.error('Error fetching assignment data:', err);
      toast.error('Ошибка при загрузке данных назначения');
      navigate('/development');
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!answers[currentQuestion.id]) {
      toast.error('Пожалуйста, выберите ответ перед переходом к следующему вопросу');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmit();
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


  const handleSubmit = async () => {
    console.log('handleSubmit called', {
      currentUser: currentUser?.id,
      assignmentData: assignmentData?.id,
      evaluatedUser: evaluatedUser?.id,
      answersCount: Object.keys(answers).length
    });

    if (!currentUser) {
      toast.error('Пользователь не авторизован');
      return;
    }

    if (!assignmentData) {
      toast.error('Данные назначения не загружены');
      return;
    }

    if (!evaluatedUser) {
      toast.error('Данные оцениваемого пользователя не загружены');
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
        evaluatedUserId: assignmentData.evaluated_user_id,
        evaluatingUserId: currentUser.id,
        answersCount: Object.values(answers).length,
        diagnosticStageId: assignmentData.diagnostic_stage_id
      });

      // Удаляем старые результаты для этого назначения
      const { error: deleteError } = await supabase
        .from('soft_skill_results')
        .delete()
        .eq('evaluated_user_id', assignmentData.evaluated_user_id)
        .eq('evaluating_user_id', currentUser.id)
        .eq('assignment_id', assignmentId);

      if (deleteError) {
        console.error('Error deleting old results:', deleteError);
      }

      // Сохраняем результаты с assignment_id и diagnostic_stage_id
      const results = Object.values(answers).map(answer => ({
        evaluated_user_id: assignmentData.evaluated_user_id,
        evaluating_user_id: currentUser.id,
        question_id: answer.question_id,
        answer_option_id: answer.answer_option_id,
        comment: answer.comment || null,
        is_anonymous_comment: answer.is_anonymous_comment ?? false,
        assignment_id: assignmentId,
        diagnostic_stage_id: assignmentData.diagnostic_stage_id,
        is_draft: false
      }));

      console.log('Inserting results:', results.length);

      const { data: insertedResults, error: resultsError } = await supabase
        .from('soft_skill_results')
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

      // Обновляем статус соответствующей задачи
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('user_id', currentUser.id)
          .eq('status', 'pending');

      if (tasks && tasks.length > 0) {
        await updateTaskStatus(tasks[0].id, 'completed');
      }

      toast.success('Оценка 360° успешно отправлена!');
      
      // Даем время триггерам агрегации сработать
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Переходим на страницу результатов
      navigate(`/assessment/results/${assignmentData.evaluated_user_id}`);
    } catch (err) {
      console.error('Error submitting results:', err);
      toast.error('Ошибка при сохранении результатов');
    }
  };

  const isSelfAssessment = assignmentData?.evaluated_user_id === currentUser?.id;
  const progress = questions.length > 0 ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100) : 0;

  if (loading || surveyLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!assignmentData || !evaluatedUser) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="mt-4 text-text-secondary">Данные не загружены</p>
          <Button onClick={() => navigate('/development')} className="mt-4">
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="mt-4 text-text-secondary">Вопросы не найдены для этого грейда</p>
          <Button onClick={() => navigate('/development')} className="mt-4">
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="mt-4 text-text-secondary">Текущий вопрос не найден</p>
          <Button onClick={() => navigate('/development')} className="mt-4">
            Вернуться назад
          </Button>
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
            <p className="text-text-secondary">Нет доступных вопросов для этого грейда</p>
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
            {isSelfAssessment ? 'Самооценка 360°' : `Оценка 360° для сотрудника: ${getFullName(evaluatedUser)}`}
          </h1>
        </div>
      </div>

      <p className="text-text-secondary mb-8 leading-relaxed">
        {isSelfAssessment 
          ? 'Самооценка 360° – это инструмент для оценки ваших личностных качеств и профессиональных компетенций. Данный метод помогает выявить сильные стороны и зоны роста.'
          : `Вы оцениваете личностные качества сотрудника ${getFullName(evaluatedUser)}. Ваша обратная связь поможет сформировать объективное представление о его компетенциях.`
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
      <div className="flex items-center mb-8 bg-surface-primary rounded-2xl p-6 border border-border">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-purple to-brand-pink flex items-center justify-center mr-4">
          <span className="text-white font-semibold text-lg">
            {getFullName(evaluatedUser)?.charAt(0) || 'U'}
          </span>
        </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {isSelfAssessment ? 'Моя самооценка 360°' : `Оценка для: ${getFullName(evaluatedUser)}`}
            </h2>
            <p className="text-text-secondary">
            {(evaluatedUser as any).positions?.name || 'Сотрудник'} 
            {(evaluatedUser as any).grades?.name && ` • ${(evaluatedUser as any).grades?.name}`}
          </p>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-surface-primary rounded-2xl p-8 border border-border mb-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Вопрос {currentQuestionIndex + 1}<span className="text-text-secondary">/{questions.length}</span>
          </h2>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-text-primary mb-4">
            {currentQuestion.question_text}
          </h3>
        </div>

        {/* Rating Scale */}
        <div className="mb-8">
          <p className="text-sm font-medium text-text-primary mb-4">Выставите оценку</p>
          
          {/* Slider */}
          <div className="relative mb-4">
            <input
              type="range"
              min="0"
              max={answerOptions.length - 1}
              step="1"
              value={answers[currentQuestion.id] ? 
                answerOptions.findIndex(opt => opt.id === answers[currentQuestion.id].answer_option_id) 
                : 0
              }
              onChange={(e) => {
                const index = parseInt(e.target.value);
                const option = answerOptions[index];
                if (option) {
                  updateAnswer(currentQuestion.id, option.id, answers[currentQuestion.id]?.comment);
                }
              }}
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, hsl(var(--brand-orange)) 0%, hsl(var(--brand-orange)) ${answers[currentQuestion.id] ? (answerOptions.findIndex(opt => opt.id === answers[currentQuestion.id].answer_option_id) / (answerOptions.length - 1)) * 100 : 0}%, hsl(var(--surface-tertiary)) ${answers[currentQuestion.id] ? (answerOptions.findIndex(opt => opt.id === answers[currentQuestion.id].answer_option_id) / (answerOptions.length - 1)) * 100 : 0}%, hsl(var(--surface-tertiary)) 100%)`
              }}
            />
            
            {/* Scale markers */}
            <div className="flex justify-between mt-2">
              {answerOptions.map((option, index) => (
                <div key={option.id} className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-surface-tertiary rounded-full border-2 border-surface-primary"></div>
                  <span className="text-xs text-text-secondary mt-1">{index}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Scale labels */}
          <div className="space-y-1 text-xs text-text-secondary mb-4">
              {answerOptions.map((option, index) => (
              <div key={option.id}>
                <span className="font-medium">{index}.</span> {option.title}
              </div>
            ))}
          </div>
          
          {/* Current selection display */}
          {answers[currentQuestion.id] && (
            <div className="mt-4 p-3 bg-brand-orange/10 rounded-lg border border-brand-orange/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  Выбранная оценка:
                </span>
                <span className="text-lg font-bold text-brand-orange">
                  {answerOptions.findIndex(opt => opt.id === answers[currentQuestion.id].answer_option_id)}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {answerOptions.find(opt => opt.id === answers[currentQuestion.id].answer_option_id)?.title} - {answerOptions.find(opt => opt.id === answers[currentQuestion.id].answer_option_id)?.description}
              </p>
            </div>
          )}
        </div>

        {/* Comment */}
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

export default Survey360QuestionsPage;