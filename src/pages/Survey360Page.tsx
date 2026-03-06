import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDiagnosticStageParticipants } from '@/hooks/useDiagnosticStageParticipants';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useSurvey360Assignments } from '@/hooks/useSurvey360Assignments';
import { useSurvey360ResultsEnhanced } from '@/hooks/useSurvey360ResultsEnhanced';
import { DiagnosticStepper } from '@/components/DiagnosticStepper';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ColleagueSelectionDialog } from '@/components/ColleagueSelectionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Survey360Page = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isParticipant, activeStageId, loading: participantLoading } = useDiagnosticStageParticipants(currentUser?.id);
  const { activeStage } = useDiagnosticStages();
  const { assignments, loading: assignmentsLoading } = useSurvey360Assignments(currentUser?.id);
  const { qualityResults, summary, loading: resultsLoading } = useSurvey360ResultsEnhanced(currentUser?.id);

  const [selfAssignment, setSelfAssignment] = useState<any>(null);
  const [managerAssignment, setManagerAssignment] = useState<any>(null);
  const [colleagueAssignments, setColleagueAssignments] = useState<any[]>([]);
  const [showColleagueDialog, setShowColleagueDialog] = useState(false);
  const [managerId, setManagerId] = useState<string | undefined>();

  useEffect(() => {
    const fetchManagerId = async () => {
      if (currentUser?.id) {
        const { data } = await supabase
          .from('users')
          .select('manager_id')
          .eq('id', currentUser.id)
          .single();
        
        if (data?.manager_id) {
          setManagerId(data.manager_id);
        }
      }
    };

    fetchManagerId();
  }, [currentUser]);

  useEffect(() => {
    if (assignments && currentUser) {
      // Фильтруем только по evaluated_user_id = currentUser
      const userAssignments = assignments.filter(a => 
        a.evaluated_user_id === currentUser.id
      );

      // Самооценка: evaluating = evaluated и assignment_type = 'self'
      const self = userAssignments.find(a => 
        a.evaluating_user_id === currentUser.id &&
        a.assignment_type === 'self'
      );
      setSelfAssignment(self);

      // Руководитель: assignment_type = 'manager'
      const manager = userAssignments.find(a => 
        a.assignment_type === 'manager'
      );
      setManagerAssignment(manager || null);

      // Коллеги: СТРОГО assignment_type = 'peer', evaluating != evaluated, diagnostic_stage_id не null
      const colleagues = userAssignments.filter(a => 
        a.assignment_type === 'peer' &&
        a.evaluating_user_id !== currentUser.id &&
        a.diagnostic_stage_id !== null
      );
      setColleagueAssignments(colleagues);
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
    if (!selfAssignment) {
      toast.error('Задание на самооценку не найдено');
      return;
    }

    // Если коллег нет вообще → открываем форму выбора
    if (totalColleagues === 0) {
      setShowColleagueDialog(true);
      return;
    }

    // Если коллеги в статусе pending → блокируем
    if (selectionStatus === 'pending_approval') {
      toast.error('Дождитесь утверждения коллег руководителем');
      return;
    }

    // Если коллеги approved → переходим к самооценке
    if (selectionStatus === 'approved') {
      navigate(`/unified-assessment/${selfAssignment.id}`);
      return;
    }

    // Во всех остальных случаях → открываем форму выбора
    setShowColleagueDialog(true);
  };

  const handleColleagueSelectionConfirm = async (selectedColleagues: string[]) => {
    toast.success('Список коллег отправлен руководителю на утверждение');
    setShowColleagueDialog(false);
    // Обновляем assignments для отображения актуального статуса
    window.location.reload();
  };

  const hasCompletedSelf = selfAssignment?.status === 'completed';
  const hasCompletedManager = managerAssignment?.status === 'completed';
  const completedColleagues = colleagueAssignments.filter(a => a.status === 'completed').length;
  const totalColleagues = colleagueAssignments.length;
  const pendingApprovalColleagues = colleagueAssignments.filter(a => a.status === 'pending').length;
  const approvedColleagues = colleagueAssignments.filter(a => a.status === 'approved').length;
  const canViewResults = hasCompletedSelf && hasCompletedManager && completedColleagues >= 1;

  // Определяем статус выбора коллег
  const colleagueSelectionStatus = () => {
    if (totalColleagues === 0) return 'not_selected';
    if (pendingApprovalColleagues > 0) return 'pending_approval';
    if (approvedColleagues > 0) return 'approved';
    return 'not_selected';
  };

  const selectionStatus = colleagueSelectionStatus();

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
            <h1 className="text-3xl font-bold text-text-primary">Оценка 360°</h1>
            <p className="text-text-secondary mt-2">
              Оценка 360° – это инструмент всесторонней оценки качеств сотрудника, основанный на обратной связи от коллег и руководителей.
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
        <Button variant="default">
          Оценка 360°
        </Button>
        <Button
          onClick={() => navigate('/skill-survey')}
          variant="outline"
        >
          Оценка навыков
        </Button>
        <Button
          onClick={() => navigate('/survey-360-results')}
          variant="outline"
          disabled={!canViewResults}
        >
          Результаты
        </Button>
      </div>

      {/* Опросники и оценки */}
      <Card>
        <CardHeader>
          <CardTitle>Опросники и оценки</CardTitle>
          <CardDescription>
            Выберите коллег для оценки и пройдите самооценку
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Руководители */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Руководители</h3>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {managerAssignment ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Выбрано руководителей: 1</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm">Руководитель не назначен</span>
                  </>
                )}
              </div>
              {managerAssignment && (
                <Badge variant="default">
                  Согласовано (автоматически)
                </Badge>
              )}
            </div>
          </div>

          {/* Коллеги */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Коллеги</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {totalColleagues === 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm">Выбрано коллег: 0</span>
                    </>
                  ) : pendingApprovalColleagues > 0 ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm">Выбрано коллег: {totalColleagues}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Выбрано коллег: {totalColleagues}</span>
                    </>
                  )}
                </div>
                <Badge variant={approvedColleagues > 0 ? "default" : "outline"}>
                  {totalColleagues === 0 
                    ? 'Не выбраны' 
                    : pendingApprovalColleagues > 0 
                      ? 'Отправлено на утверждение' 
                      : 'Согласовано'}
                </Badge>
              </div>

              {/* Кнопки действий */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowColleagueDialog(true)}
                  disabled={selectionStatus === 'pending_approval'}
                >
                  {selectionStatus === 'not_selected' 
                    ? 'Выбор коллег перед самооценкой'
                    : selectionStatus === 'pending_approval'
                      ? 'Ожидание утверждения'
                      : 'Изменить выбор коллег'}
                </Button>

                <Button
                  className="w-full"
                  onClick={handleStartSelfAssessment}
                  disabled={selectionStatus === 'pending_approval' || hasCompletedSelf}
                >
                  {hasCompletedSelf 
                    ? 'Самооценка завершена' 
                    : totalColleagues === 0 
                      ? 'Выбрать коллег и начать самооценку' 
                      : 'Начать самооценку'}
                </Button>
              </div>

              {/* Статус подсказки */}
              {selectionStatus === 'not_selected' && (
                <div className="text-xs text-muted-foreground p-2 bg-amber-50 rounded-md">
                  ℹ️ Перед началом самооценки необходимо выбрать коллег для оценки
                </div>
              )}
              {selectionStatus === 'pending_approval' && (
                <div className="text-xs text-amber-600 p-2 bg-amber-50 rounded-md">
                  ⏳ Список коллег отправлен руководителю на утверждение ({pendingApprovalColleagues})
                </div>
              )}
              {selectionStatus === 'approved' && !hasCompletedSelf && (
                <div className="text-xs text-green-600 p-2 bg-green-50 rounded-md">
                  ✅ Коллеги утверждены ({approvedColleagues}). Можно начинать самооценку!
                </div>
              )}
            </div>
          </div>

          {/* Статус самооценки */}
          {selfAssignment && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Статус самооценки:</span>
                <Badge variant={hasCompletedSelf ? "default" : "outline"}>
                  {hasCompletedSelf ? 'Завершена' : selfAssignment.status}
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
        </CardContent>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
              Ожидается оценка от руководителя
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
                Руководитель получил запрос на оценку
              </p>
            )}
          </CardContent>
        </Card>

        {/* Colleagues Assessment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Оценка коллег</span>
              {completedColleagues >= 1 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-amber-500" />
              )}
            </CardTitle>
            <CardDescription>
              Минимум 1 коллега должен оценить
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Прогресс:</span>
                <Badge variant={completedColleagues >= 1 ? "default" : "outline"}>
                  {completedColleagues} / {totalColleagues}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-brand-purple h-2 rounded-full transition-all duration-300"
                  style={{ width: `${totalColleagues > 0 ? (completedColleagues / totalColleagues) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            {totalColleagues === 0 && (
              <p className="text-sm text-muted-foreground">
                Коллеги не назначены
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Preview */}
      {canViewResults && qualityResults && qualityResults.length > 0 && (
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
              onClick={() => navigate('/survey-360-results')}
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

      {/* Colleague Selection Dialog */}
      <ColleagueSelectionDialog
        open={showColleagueDialog}
        onOpenChange={setShowColleagueDialog}
        onConfirm={handleColleagueSelectionConfirm}
        currentUserId={currentUser?.id || ''}
        managerId={managerId}
        diagnosticStageId={activeStageId}
      />
    </div>
  );
};

export default Survey360Page;