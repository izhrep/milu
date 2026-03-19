import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSurvey360Assignments } from '@/hooks/useSurvey360Assignments';
import { useSurvey360Results } from '@/hooks/useSurvey360Results';
import { useDiagnosticStageParticipants } from '@/hooks/useDiagnosticStageParticipants';
import { useTasks } from '@/hooks/useTasks';
import { useAssignmentDraftStatus } from '@/hooks/useAssignmentDraftStatus';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Users, CheckCircle2, XCircle, Play, Edit, AlertCircle } from 'lucide-react';
import { ColleagueSelectionDialog } from './ColleagueSelectionDialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SelfAssessmentButtonProps {
  assignmentId: string;
  userId: string | undefined;
  tasks: any[];
  activeStageId: string | null;
  onNavigate: (id: string) => void;
}

const SelfAssessmentButton: React.FC<SelfAssessmentButtonProps> = ({ 
  assignmentId, 
  userId, 
  tasks, 
  activeStageId,
  onNavigate 
}) => {
  const { hasDraft, loading: draftLoading } = useAssignmentDraftStatus(assignmentId, userId);

  const handleClick = async () => {
    const selfAssessmentTask = tasks.find(
      t => t.assignment_type === 'self' && 
           t.status === 'pending' &&
           t.diagnostic_stage_id === activeStageId
    );

    if (selfAssessmentTask) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', selfAssessmentTask.id);
      
      if (error) {
        console.error('Error updating task status:', error);
      }
    }
    
    onNavigate(assignmentId);
  };

  return (
    <Button 
      className="w-full"
      onClick={handleClick}
      disabled={draftLoading}
    >
      {draftLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Загрузка...
        </>
      ) : hasDraft ? (
        <>
          <Edit className="w-4 h-4 mr-2" />
          Продолжить опрос "Обратная связь 360" по себе
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          Начать опрос "Обратная связь 360" по себе
        </>
      )}
    </Button>
  );
};

interface ManagerEvaluationButtonProps {
  assignmentId: string;
  userId: string | undefined;
  taskId: string;
  onNavigate: (id: string) => void;
}

const ManagerEvaluationButton: React.FC<ManagerEvaluationButtonProps> = ({ 
  assignmentId, 
  userId,
  taskId,
  onNavigate 
}) => {
  const { hasDraft, loading: draftLoading } = useAssignmentDraftStatus(assignmentId, userId);

  const handleClick = async () => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId);
    
    if (error) {
      console.error('Error updating task status:', error);
    }
    
    onNavigate(assignmentId);
  };

  return (
    <Button
      className="w-full"
      onClick={handleClick}
      disabled={draftLoading}
    >
      {draftLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Загрузка...
        </>
      ) : hasDraft ? (
        <>
          <Edit className="w-4 h-4 mr-2" />
          Продолжить форму обратной связи сотруднику
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          Дать обратную связь сотруднику
        </>
      )}
    </Button>
  );
};

interface PeerEvaluationButtonProps {
  assignmentId: string;
  userId: string | undefined;
  onNavigate: (id: string) => void;
}

const PeerEvaluationButton: React.FC<PeerEvaluationButtonProps> = ({ 
  assignmentId, 
  userId,
  onNavigate 
}) => {
  const { hasDraft, loading: draftLoading } = useAssignmentDraftStatus(assignmentId, userId);

  const handleClick = async () => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('assignment_id', assignmentId)
      .eq('assignment_type', 'peer');
    
    if (error) {
      console.error('Error updating task status:', error);
    }
    
    onNavigate(assignmentId);
  };

  return (
    <Button
      className="w-full"
      onClick={handleClick}
      disabled={draftLoading}
    >
      {draftLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Загрузка...
        </>
      ) : hasDraft ? (
        <>
          <Edit className="w-4 h-4 mr-2" />
          Продолжить фидбек по коллеге
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          Дать обратную связь коллеге
        </>
      )}
    </Button>
  );
};

export const SurveyAccessWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { assignments: survey360Assignments, loading: loading360, refetch: refetch360, createAssignments } = useSurvey360Assignments(user?.id);
  const { results: survey360Results } = useSurvey360Results(user?.id);
  const { activeStageId, isParticipant } = useDiagnosticStageParticipants(user?.id);
  const { tasks, loading: loadingTasks } = useTasks(user?.id);
  const [showColleagueDialog, setShowColleagueDialog] = useState(false);
  const [evaluatedUsers, setEvaluatedUsers] = useState<{ [key: string]: string }>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedColleaguesCount, setSelectedColleaguesCount] = useState(0);
  const [managerId, setManagerId] = useState<string | undefined>();
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [hasSoftSkillResults, setHasSoftSkillResults] = useState(false);
  const [hasHardSkillResults, setHasHardSkillResults] = useState(false);

  // Определяем наличие назначений по типам
  const assignmentTypes = useMemo(() => {
    // Self: есть назначение где пользователь оценивает себя (любой активный статус, включая completed)
    const hasSelf = survey360Assignments.some(
      a => a.evaluated_user_id === user?.id && 
           a.evaluating_user_id === user?.id &&
           (a.status === 'approved' || a.status === 'pending' || a.status === 'completed')
    );
    
    // Manager: есть задачи оценки подчинённых (используем assignment_type='manager' вместо проверки заголовка)
    const managerTasks = tasks.filter(t => {
      const taskType = 'task_type' in t ? t.task_type : undefined;
      const assignmentType = 'assignment_type' in t ? t.assignment_type : undefined;
      return taskType === 'survey_360_evaluation' && 
             (t.status === 'pending' || t.status === 'in_progress') && 
             assignmentType === 'manager';
    });
    const hasManager = managerTasks.length > 0;
    
    // Peer: есть назначения где пользователь оценивает коллег (не себя), статус approved
    const peerAssignments = survey360Assignments.filter(
      a => a.evaluating_user_id === user?.id && 
           a.evaluated_user_id !== user?.id &&
           a.status === 'approved' &&
           a.assignment_type === 'peer' &&
           !a.is_manager_participant
    );
    const hasPeer = peerAssignments.length > 0;
    
    return { hasSelf, hasManager, hasPeer, managerTasks, peerAssignments };
  }, [survey360Assignments, tasks, user?.id]);

  // Проверяем, есть ли хотя бы одно назначение
  const hasAnyAssignment = assignmentTypes.hasSelf || assignmentTypes.hasManager || assignmentTypes.hasPeer;

  // Фильтруем задачи оценки подчинённых
  const managerEvaluationTasks = assignmentTypes.managerTasks;

  useEffect(() => {
    const fetchUsers = async () => {
      if (!survey360Assignments.length) {
        setLoadingUsers(false);
        return;
      }

      // Collect all unique user IDs from assignments
      const userIds = [...new Set(survey360Assignments.map(a => a.evaluated_user_id))];
      
      // Also add evaluated user IDs from peer assignments where current user is evaluator
      const peerEvaluatedIds = survey360Assignments
        .filter(a => a.evaluating_user_id === user?.id && a.evaluated_user_id !== user?.id)
        .map(a => a.evaluated_user_id);
      
      const allUserIds = [...new Set([...userIds, ...peerEvaluatedIds])];
      
      if (allUserIds.length === 0) {
        setLoadingUsers(false);
        return;
      }

      // Use SECURITY DEFINER RPC to bypass RLS restrictions on users table
      const { data: users, error: usersError } = await supabase
        .rpc('get_user_display_names', { p_user_ids: allUserIds });

      if (usersError) {
        console.error('Error fetching user display names:', usersError);
      }

      if (users) {
        const usersMap = users.reduce((acc: any, userItem: any) => {
          const fullName = `${userItem.last_name || ''} ${userItem.first_name || ''} ${userItem.middle_name || ''}`.trim();
          acc[userItem.id] = fullName || 'Неизвестно';
          return acc;
        }, {});
        setEvaluatedUsers(usersMap);
      }
      setLoadingUsers(false);
    };

    fetchUsers();
  }, [survey360Assignments, user?.id]);

  // Fetch manager ID
  useEffect(() => {
    const fetchManager = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', user.id)
        .single();

      if (!error && data?.manager_id) {
        setManagerId(data.manager_id);
      }
    };

    fetchManager();
  }, [user?.id]);

  // Проверяем наличие результатов в активном этапе
  useEffect(() => {
    const checkExistingResults = async () => {
      if (!user?.id || !activeStageId) {
        setHasSoftSkillResults(false);
        setHasHardSkillResults(false);
        return;
      }

      const { data: softResults } = await supabase
        .from('soft_skill_results')
        .select('id')
        .eq('evaluated_user_id', user.id)
        .eq('evaluating_user_id', user.id)
        .eq('diagnostic_stage_id', activeStageId)
        .eq('is_draft', false)
        .limit(1);

      setHasSoftSkillResults((softResults && softResults.length > 0) || false);

      const { data: hardResults } = await supabase
        .from('hard_skill_results')
        .select('id')
        .eq('evaluated_user_id', user.id)
        .eq('evaluating_user_id', user.id)
        .eq('diagnostic_stage_id', activeStageId)
        .eq('is_draft', false)
        .limit(1);

      setHasHardSkillResults((hardResults && hardResults.length > 0) || false);
    };

    checkExistingResults();
  }, [user?.id, activeStageId]);

  // Подсчитываем выбранных коллег
  useEffect(() => {
    if (user?.id && survey360Assignments.length > 0) {
      const count = survey360Assignments.filter(
        a => a.evaluated_user_id === user.id && 
             a.evaluating_user_id !== user.id &&
             a.assignment_type === 'peer' &&
             a.diagnostic_stage_id !== null &&
             (a.status === 'pending' || a.status === 'approved')
      ).length;
      setSelectedColleaguesCount(count);
    } else if (user?.id) {
      setSelectedColleaguesCount(0);
    }
  }, [survey360Assignments, user?.id]);

  // Self assessment data
  const selfAssignment = survey360Assignments.find(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id === user?.id
  );
  
  const hasExistingAssessment = selfAssignment?.status === 'completed';

  const managersCount = survey360Assignments.filter(
    a => a.evaluated_user_id === user?.id && 
         a.assignment_type === 'manager'
  ).length;

  const hasPendingApproval = survey360Assignments.some(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id !== user?.id &&
         a.assignment_type === 'peer' &&
         a.status === 'pending'
  );

  const colleaguesApproved = survey360Assignments.some(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id !== user?.id &&
         a.assignment_type === 'peer' &&
         (a.status === 'approved' || a.status === 'completed')
  );
  
  const approvedColleaguesCount = survey360Assignments.filter(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id !== user?.id &&
         a.assignment_type === 'peer' &&
         (a.status === 'approved' || a.status === 'completed')
  ).length;

  const colleaguesDraft = survey360Assignments.some(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id !== user?.id &&
         a.assignment_type === 'peer' &&
         a.status === 'draft'
  );

  const selfAssessmentPending = survey360Assignments.find(
    a => a.evaluated_user_id === user?.id && 
         a.evaluating_user_id === user?.id &&
         a.status === 'approved'
  );

  const handleStartAssessment = async (selectedColleagues: string[]) => {
    setSelectedColleaguesCount(selectedColleagues.length);
    await refetch360();
  };

  const handleRevokeList = async () => {
    if (!user?.id) return;

    try {
      setRevoking(true);

      const { error: deleteError } = await supabase
        .from('survey_360_assignments')
        .delete()
        .eq('evaluated_user_id', user.id)
        .eq('assignment_type', 'peer')
        .eq('status', 'pending');

      if (deleteError) throw deleteError;

      toast.success('Список коллег отозван.');
      setShowRevokeDialog(false);
      setShowColleagueDialog(false);
      
      refetch360();
    } catch (error) {
      console.error('Error revoking list:', error);
      toast.error('Ошибка при отзыве списка');
    } finally {
      setRevoking(false);
    }
  };

  const getFullName = (userId: string) => evaluatedUsers[userId] || 'Неизвестно';

  const isLoading = loading360 || loadingUsers || loadingTasks;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Формы обратной связи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyAssignment ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Нет назначенных форм обратной связи</p>
            </div>
          ) : (
            <>
              {/* Блок Самооценка - показываем только если есть self assignment */}
              {assignmentTypes.hasSelf && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Статус фидбека:</h3>
                  
                  {hasExistingAssessment ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm">Статус:</span>
                        <Badge variant="default">Фидбэк по себе завершён</Badge>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="text-sm font-medium">Коллеги</div>
                        <div className="text-sm text-muted-foreground">
                          Выбрано коллег: {approvedColleaguesCount > 0 ? approvedColleaguesCount : selectedColleaguesCount}
                        </div>
                        {hasPendingApproval && !colleaguesApproved && (
                          <div className="text-xs text-amber-600">Статус: Ожидает согласования</div>
                        )}
                        {colleaguesApproved && (
                          <div className="text-xs text-green-600">Статус: Согласовано</div>
                        )}
                        {selectedColleaguesCount === 0 && !colleaguesApproved && (
                          <div className="text-xs text-muted-foreground">Статус: Не выбраны</div>
                        )}
                      </div>

                      {colleaguesDraft && (
                        <Alert className="bg-muted/50 border-muted">
                          <AlertDescription className="ml-2">
                            <div className="text-sm">
                              Список отозван. Вы можете отредактировать коллег и отправить на утверждение заново.
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <Button 
                        variant={hasPendingApproval ? "outline" : "default"}
                        className="w-full gap-2"
                        onClick={() => {
                          if (hasPendingApproval) {
                            setShowRevokeDialog(true);
                          } else {
                            setShowColleagueDialog(true);
                          }
                        }}
                      >
                        {hasPendingApproval ? (
                          <>
                            <XCircle className="h-4 w-4" />
                            Отозвать список коллег
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4" />
                            {colleaguesApproved ? 'Изменить список респондентов' : 'Выбрать респондентов'}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="text-sm font-medium">Руководители</div>
                        <div className="text-sm text-muted-foreground">
                          Выбрано руководителей: {managersCount}
                        </div>
                        {managersCount > 0 && (
                          <div className="text-xs text-green-600">Согласовано (автоматически)</div>
                        )}
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="text-sm font-medium">Коллеги</div>
                        <div className="text-sm text-muted-foreground">
                          Выбрано коллег: {approvedColleaguesCount > 0 ? approvedColleaguesCount : selectedColleaguesCount}
                        </div>
                        {hasPendingApproval && !colleaguesApproved && (
                          <div className="text-xs text-amber-600">Статус: Ожидает согласования</div>
                        )}
                        {colleaguesApproved && (
                          <div className="text-xs text-green-600">Статус: Согласовано</div>
                        )}
                        {selectedColleaguesCount === 0 && !colleaguesApproved && (
                          <div className="text-xs text-muted-foreground">Статус: Не выбраны</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {colleaguesDraft && (
                          <Alert className="bg-muted/50 border-muted mb-2">
                            <AlertDescription className="ml-2">
                              <div className="text-sm">
                                Список отозван. Вы можете отредактировать коллег и отправить на утверждение заново.
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        <Button 
                          variant={hasPendingApproval ? "outline" : "default"}
                          className="w-full gap-2"
                          onClick={() => {
                            if (hasPendingApproval) {
                              setShowRevokeDialog(true);
                            } else {
                              setShowColleagueDialog(true);
                            }
                          }}
                        >
                          {hasPendingApproval ? (
                            <>
                              <XCircle className="h-4 w-4" />
                              Отозвать список коллег
                            </>
                          ) : (
                            <>
                              <Users className="h-4 w-4" />
                              {colleaguesApproved ? 'Изменить список респондентов' : 'Выбрать респондентов'}
                            </>
                          )}
                        </Button>

                        {(hasSoftSkillResults || hasHardSkillResults) ? (
                          <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="ml-2 text-green-700">
                              Фидбэк по себе завершён
                            </AlertDescription>
                          </Alert>
                        ) : selfAssessmentPending ? (
                          <SelfAssessmentButton
                            assignmentId={selfAssessmentPending.id}
                            userId={user?.id}
                            tasks={tasks}
                            activeStageId={activeStageId}
                            onNavigate={(id) => navigate(`/unified-assessment/${id}`)}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Разделитель между блоками */}
              {assignmentTypes.hasSelf && (assignmentTypes.hasManager || assignmentTypes.hasPeer) && (
                <Separator />
              )}

              {/* Блок Оценки подчинённых - показываем только если есть manager tasks */}
              {assignmentTypes.hasManager && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Обратная связь для твоих сотрудников</h3>
                  {managerEvaluationTasks.map(task => (
                    <div key={task.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{task.title?.replace('Оценка подчинённого:', 'Обратная связь для твоего сотрудника:').replace('Обратная связь для сотрудника:', 'Обратная связь для твоего сотрудника:')}</span>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        </div>
                        <Badge variant="secondary">Ожидает</Badge>
                      </div>
                      {(() => {
                        const assignmentIdFromTask = task.assignment_id;
                        const assignment = survey360Assignments.find(a => a.id === assignmentIdFromTask);
                        
                        return assignment ? (
                          <ManagerEvaluationButton
                            assignmentId={assignment.id}
                            userId={user?.id}
                            taskId={task.id}
                            onNavigate={(id) => navigate(`/unified-assessment/${id}`)}
                          />
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => toast.error('Не найдено назначение для оценки')}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Дать обратную связь сотруднику
                          </Button>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {/* Разделитель между блоками */}
              {assignmentTypes.hasManager && assignmentTypes.hasPeer && (
                <Separator />
              )}

              {/* Блок Оценки коллег - показываем только если есть peer assignments */}
              {assignmentTypes.hasPeer && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Обратная связь для коллег</h3>
                  {assignmentTypes.peerAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Обратная связь для коллеги</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getFullName(assignment.evaluated_user_id)}
                          </p>
                        </div>
                        <Badge variant="secondary">Назначено</Badge>
                      </div>
                      <PeerEvaluationButton
                        assignmentId={assignment.id}
                        userId={user?.id}
                        onNavigate={(id) => navigate(`/unified-assessment/${id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ColleagueSelectionDialog
        open={showColleagueDialog}
        onOpenChange={setShowColleagueDialog}
        onConfirm={handleStartAssessment}
        currentUserId={user?.id || ''}
        managerId={managerId}
        diagnosticStageId={activeStageId}
      />

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать список коллег?</AlertDialogTitle>
            <AlertDialogDescription>
              Список коллег будет отозван. Вы сможете изменить выбор и отправить на утверждение заново.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeList}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Отзыв...
                </>
              ) : (
                'Отозвать'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
