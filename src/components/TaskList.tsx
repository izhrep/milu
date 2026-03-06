import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { useNavigate } from 'react-router-dom';
import { Calendar, Play, Edit, Users as UsersIcon, Video, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PeerSelectionButton } from './PeerSelectionButton';
import { ManagerRespondentApproval } from './ManagerRespondentApproval';
import { useAuth } from '@/contexts/AuthContext';
import { decryptUserData } from '@/lib/userDataDecryption';
import { supabase } from '@/integrations/supabase/client';

interface TaskListProps {
  userId: string;
}

export const TaskList: React.FC<TaskListProps> = ({ userId }) => {
  const { tasks, loading, refetch } = useTasks(userId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalTaskData, setApprovalTaskData] = useState<{
    evaluatedUserId: string;
    evaluatedUserName: string;
    diagnosticStageId: string;
  } | null>(null);
  const [managerId, setManagerId] = useState<string | undefined>();
  const [decryptedTitles, setDecryptedTitles] = useState<Record<string, string>>({});

  // Загружаем manager_id
  useEffect(() => {
    const loadManagerId = async () => {
      const { data } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', userId)
        .single();
      
      if (data) {
        setManagerId(data.manager_id);
      }
    };
    loadManagerId();
  }, [userId]);

  // Расшифровываем имена для задач peer_approval и survey_360_evaluation
  useEffect(() => {
    const decryptTaskTitles = async () => {
      const tasksToDecrypt = tasks.filter(t => 
        (t.task_type === 'peer_approval' || t.task_type === 'survey_360_evaluation') && t.assignment_id
      );
      
      for (const task of tasksToDecrypt) {
        if (decryptedTitles[task.id]) continue;
        
        try {
          // Для survey_360_evaluation нужно получить evaluated_user_id из assignment
          let targetUserId = task.assignment_id;
          
          if (task.task_type === 'survey_360_evaluation') {
            const { data: assignment } = await supabase
              .from('survey_360_assignments')
              .select('evaluated_user_id')
              .eq('id', task.assignment_id)
              .single();
            
            if (assignment) {
              targetUserId = assignment.evaluated_user_id;
            }
          }
          
          const { data: userData } = await supabase
            .from('users')
            .select('first_name, last_name, middle_name, email')
            .eq('id', targetUserId)
            .single();

          if (userData) {
            const decrypted = await decryptUserData({
              first_name: userData.first_name,
              last_name: userData.last_name,
              middle_name: userData.middle_name,
              email: userData.email
            });
            
            const fullName = [decrypted.last_name, decrypted.first_name, decrypted.middle_name].filter(Boolean).join(' ');
            
            if (task.task_type === 'peer_approval') {
              setDecryptedTitles(prev => ({
                ...prev,
                [task.id]: `Утвердить список оценивающих для ${fullName}`
              }));
            } else if (task.task_type === 'survey_360_evaluation') {
              setDecryptedTitles(prev => ({
                ...prev,
                [task.id]: `Обратная связь для коллеги: ${fullName}`
              }));
            }
          }
        } catch (error) {
          console.error('Error decrypting task title:', error);
        }
      }
    };

    if (tasks.length > 0) {
      decryptTaskTitles();
    }
  }, [tasks]);

  const handleStartSurvey = (assignmentId: string, assignmentType?: string, taskType?: string) => {
    // Для задач самооценки (diagnostic_stage) открываем unified-assessment
    if (taskType === 'diagnostic_stage') {
      navigate(`/unified-assessment/${assignmentId}`);
    } else if (assignmentType === 'skill_survey') {
      navigate(`/skill-survey/questions/${assignmentId}`);
    } else if (assignmentType === 'survey_360') {
      navigate('/questionnaires');
    } else {
      navigate('/my-assignments');
    }
  };

  const handleStart360Survey = () => {
    navigate('/questionnaires');
  };

  const handleStartSkillSurvey = () => {
    navigate('/questionnaires');
  };

  const handleGoToMeetings = () => {
    navigate('/meetings');
  };

  const handleGoToDevelopment = () => {
    navigate('/questionnaires');
  };

  const handlePeerApproval = async (task: any) => {
    try {
      // Получаем данные оцениваемого пользователя
      const { data: userData } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', task.assignment_id) // assignment_id содержит evaluated_user_id
        .single();

      if (userData) {
        const decrypted = await decryptUserData({
          first_name: userData.first_name,
          last_name: userData.last_name,
          middle_name: null,
          email: userData.email
        });
        setApprovalTaskData({
          evaluatedUserId: task.assignment_id,
          evaluatedUserName: `${decrypted.last_name} ${decrypted.first_name}`,
          diagnosticStageId: task.diagnostic_stage_id || ''
        });
        setShowApprovalDialog(true);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Ошибка загрузки данных пользователя');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">Загрузка задач...</p>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const isAssessmentTask = task.task_type === 'assessment';
        const isSelfAssessment = task.is_self_assessment;
        const isDevelopmentTask = task.category === 'development' || task.task_type === 'development';
        const isMeetingTask = task.task_type === 'meeting' || task.category === 'Встречи 1:1';
        const isDiagnosticTask = task.task_type === 'diagnostic_stage' || task.category === 'Диагностика';
        const isManagerEvaluationTask = task.task_type === 'survey_360_evaluation';
        // Кнопки должны оставаться видимыми для pending и in_progress (пока не completed)
        const isActiveTask = ['pending', 'in_progress', 'new', 'Новая'].includes(task.status);
        // Для peer_selection и peer_approval кнопки показываются только при pending
        const isPendingTask = task.status === 'pending';
        const isDevPlanTask = task.task_type === 'development';
        
        // Determine task description based on requirements
        let taskDescription = task.description;
        
        // Rule 1-2: For assessment tasks where evaluating == evaluated (self-assessment)
        if (isAssessmentTask && isSelfAssessment) {
          if (task.assignment_type === 'skill_survey') {
            taskDescription = 'Необходимо пройти опрос "Обратная связь 360" по себе';
          } else if (task.assignment_type === 'survey_360') {
            taskDescription = 'Необходимо пройти опрос "Обратная связь 360" по себе';
          }
        }
        // For development tasks without assignment_id, show combined text
        else if (isDevelopmentTask && !task.assignment_id) {
          taskDescription = 'Необходимо пройти опрос "Обратная связь 360" по себе';
        }

        // Button logic for diagnostic tasks - показывать пока задача активна
        const showDiagnosticButton = isDiagnosticTask && isActiveTask && task.assignment_id;
        // Button logic for assessment tasks - показывать пока задача активна
        const showAssessmentButton = isAssessmentTask && isActiveTask && task.assignment_id && !showDiagnosticButton;
        // Button logic for development tasks - показывать пока задача активна
        const showDevelopmentButtons = isDevelopmentTask && isActiveTask && !task.assignment_id;
        // Button logic for meeting tasks - показывать пока задача активна
        const showMeetingButton = isMeetingTask && isActiveTask;
        // Button logic for manager evaluation tasks - показывать пока задача активна
        const showManagerEvaluationButton = isManagerEvaluationTask && isActiveTask;

        const displayTitle = (task.task_type === 'peer_approval' || task.task_type === 'survey_360_evaluation') && decryptedTitles[task.id] 
          ? decryptedTitles[task.id] 
          : task.title;

        return (
          <Card key={task.id} className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <h4 className="font-medium">{displayTitle}</h4>
                <p className="text-sm text-muted-foreground mt-1">{taskDescription}</p>
                {task.deadline && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar size={14} />
                    <span>Срок: {formatDate(task.deadline)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Кнопка "Выбрать оценивающих" для peer_selection - только pending */}
                {task.task_type === 'peer_selection' && isPendingTask && (
                  <PeerSelectionButton
                    currentUserId={userId}
                    managerId={managerId}
                    diagnosticStageId={task.diagnostic_stage_id}
                    taskId={task.id}
                    onSelectionComplete={() => refetch()}
                  />
                )}

                {/* Кнопка "Утвердить список" для peer_approval - только pending */}
                {task.task_type === 'peer_approval' && isPendingTask && (
                  <Button 
                    onClick={() => handlePeerApproval(task)}
                  >
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Утвердить список оценивающих
                  </Button>
                )}

                {/* Остальные кнопки */}
                {isDevPlanTask ? (
                  <Button 
                    onClick={() => navigate('/tasks')}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Посмотреть
                  </Button>
                ) : showDiagnosticButton ? (
                  <>
                    {task.status === 'pending' && (
                      <Button 
                        onClick={() => navigate(`/unified-assessment/${task.assignment_id}`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {task.assignment_type === 'self' && 'Начать опрос "Обратная связь 360" по себе'}
                        {task.assignment_type === 'manager' && 'Дать обратную связь сотруднику'}
                        {task.assignment_type === 'peer' && 'Дать обратную связь коллеге'}
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button 
                        onClick={() => navigate(`/unified-assessment/${task.assignment_id}`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {task.assignment_type === 'self' && 'Продолжить опрос "Обратная связь 360" по себе'}
                        {task.assignment_type === 'manager' && 'Продолжить форму обратной связи сотруднику'}
                        {task.assignment_type === 'peer' && 'Продолжить фидбек по коллеге'}
                      </Button>
                    )}
                  </>
                ) : showAssessmentButton ? (
                  <Button 
                    onClick={() => handleStartSurvey(task.assignment_id, task.assignment_type, task.task_type)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Перейти в раздел Обратная связь 360
                  </Button>
                ) : showManagerEvaluationButton ? (
                  <Button 
                    onClick={() => navigate('/questionnaires')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Перейти в раздел Обратная связь 360
                  </Button>
                ) : showDevelopmentButtons ? (
                  <>
                    <Button 
                      onClick={handleStart360Survey}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Опросник 360
                    </Button>
                    <Button 
                      onClick={handleStartSkillSurvey}
                      className="mt-2"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Опрос навыков
                    </Button>
                  </>
                ) : showMeetingButton ? (
                  <Button 
                    onClick={handleGoToMeetings}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Перейти к встрече 1:1
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}

      {approvalTaskData && (
        <ManagerRespondentApproval
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          evaluatedUserId={approvalTaskData.evaluatedUserId}
          evaluatedUserName={approvalTaskData.evaluatedUserName}
          diagnosticStageId={approvalTaskData.diagnosticStageId}
          onApprovalComplete={() => {
            refetch();
            setShowApprovalDialog(false);
          }}
        />
      )}
    </div>
  );
};