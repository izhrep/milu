import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDiagnosticStageParticipants } from '@/hooks/useDiagnosticStageParticipants';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useSkillSurveyResultsEnhanced } from '@/hooks/useSkillSurveyResultsEnhanced';
import { DiagnosticStepper } from '@/components/DiagnosticStepper';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const SkillSurveyPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isParticipant, activeStageId, loading: participantLoading } = useDiagnosticStageParticipants(currentUser?.id);
  const { activeStage } = useDiagnosticStages();
  // Skill assignments are now part of survey_360_assignments
  const assignments: any[] = [];
  const assignmentsLoading = false;
  const { skillResults, loading: resultsLoading } = useSkillSurveyResultsEnhanced(currentUser?.id);

  const [selfAssignment, setSelfAssignment] = useState<any>(null);
  const [managerAssignment, setManagerAssignment] = useState<any>(null);

  useEffect(() => {
    // Assignments are handled through diagnostic stages now
    if (currentUser) {
      setSelfAssignment(null);
      setManagerAssignment(null);
    }
  }, [assignments, currentUser]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleStartSelfAssessment = () => {
    if (selfAssignment) {
      navigate(`/assessment/${selfAssignment.id}`);
    } else {
      toast.error('Задание на самооценку не найдено');
    }
  };

  const hasCompletedSelf = selfAssignment?.status === 'completed';
  const hasCompletedManager = managerAssignment?.status === 'completed';
  const canViewResults = hasCompletedSelf && hasCompletedManager;

  if (participantLoading || assignmentsLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Breadcrumbs />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Диагностический этап не активен
            </CardTitle>
            <CardDescription>
              Вы не являетесь участником текущего этапа диагностики. Обратитесь к HR-администратору.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto form-fade-in">
      <Breadcrumbs />

      {/* Stepper */}
      <DiagnosticStepper userId={currentUser?.id} />
      
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Оценка профессиональных навыков</h1>
            <p className="text-text-secondary mt-2">
              Оценка профессиональных навыков – это инструмент для определения уровня владения ключевыми компетенциями.
            </p>
          </div>
          {activeStage && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Напоминание</p>
              <p className="text-lg font-semibold text-text-primary">
                {formatDate(activeStage.reminder_date)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => navigate('/survey-360')}
          variant="outline"
        >
          Оценка 360°
        </Button>
        <Button variant="default">
          Оценка навыков
        </Button>
        <Button
          onClick={() => navigate('/skill-survey/results')}
          variant="outline"
          disabled={!canViewResults}
        >
          Результаты
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Self Assessment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Самооценка навыков</span>
              {hasCompletedSelf ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-amber-500" />
              )}
            </CardTitle>
            <CardDescription>
              Оцените свои профессиональные навыки
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selfAssignment && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Статус:</span>
                  <Badge variant={hasCompletedSelf ? "default" : "outline"}>
                    {selfAssignment.status}
                  </Badge>
                </div>
                {selfAssignment.updated_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar size={14} />
                    <span>
                      {hasCompletedSelf ? 'Завершено' : 'Обновлено'}: {formatDate(selfAssignment.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {!hasCompletedSelf && (
              <Button 
                onClick={handleStartSelfAssessment}
                disabled={!selfAssignment}
                className="w-full"
              >
                {selfAssignment ? 'Начать самооценку' : 'Задание не найдено'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Manager Assessment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Оценка руководителя</span>
              {hasCompletedManager ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-amber-500" />
              )}
            </CardTitle>
            <CardDescription>
              Ожидается оценка от вашего руководителя
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {managerAssignment && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Статус:</span>
                  <Badge variant={hasCompletedManager ? "default" : "outline"}>
                    {managerAssignment.status}
                  </Badge>
                </div>
                {managerAssignment.updated_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar size={14} />
                    <span>
                      {hasCompletedManager ? 'Завершено' : 'Обновлено'}: {formatDate(managerAssignment.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {!hasCompletedManager && (
              <p className="text-sm text-muted-foreground">
                Руководитель получил запрос на оценку ваших навыков
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Preview */}
      {canViewResults && skillResults && skillResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Результаты доступны
            </CardTitle>
            <CardDescription>
              Все необходимые оценки собраны, вы можете просмотреть результаты
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/skill-survey/results')}
              className="w-full"
            >
              Перейти к результатам
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      {!selfAssignment && !managerAssignment && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5" />
              Ожидание заданий
            </CardTitle>
            <CardDescription className="text-amber-700">
              Задания на оценку создаются автоматически при добавлении вас в диагностический этап. 
              Если вы не видите заданий, обратитесь к HR-администратору.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default SkillSurveyPage;