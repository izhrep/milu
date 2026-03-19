import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Edit3, 
  Trash2, 
  Clock, 
  Target, 
  AlertTriangle,
  Filter,
  Calendar,
  User,
  Star,
  Eye,
  Users,
  Play,
  Video
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTasks, Task as TaskFromHook } from '@/hooks/useTasks';
import { useSkills } from '@/hooks/useSkills';
import { useQualities } from '@/hooks/useQualities';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { PeerSelectionButton } from '@/components/PeerSelectionButton';
import { ManagerRespondentApproval } from '@/components/ManagerRespondentApproval';
import { decryptUserData } from '@/lib/userDataDecryption';

interface LocalTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  task_type: string;
  priority: string;
  deadline?: string;
  competency_ref?: string;
  kpi_expected_level?: number;
  kpi_result_level?: number;
  category?: string;
  created_at: string;
  assignment_id?: string;
  assignment_type?: string;
  diagnostic_stage_id?: string;
  user_id: string;
  updated_at: string;
}

type Task = TaskFromHook | LocalTask;

interface TasksManagerProps {
  onNavigateToSurveys?: () => void;
}

interface DevelopmentPlanTask {
  hard_skill_id?: string;
  soft_skill_id?: string;
  title: string;
  priority: string;
  goal: string;
  how_to: string;
  measurable_result: string;
  career_track_id?: string;
  career_track_step_id?: string;
}

interface NewDevelopmentTask {
  title: string;
  goal: string;
  how_to: string;
  measurable_result: string;
  priority: 'normal' | 'urgent';
  deadline: string;
  hard_skill_id?: string;
  soft_skill_id?: string;
  career_track_id?: string;
  career_track_step_id?: string;
}

export const TasksManager: React.FC<TasksManagerProps> = ({ onNavigateToSurveys }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks: tasksFromHook, loading: tasksLoading, refetch: refetchTasks } = useTasks(user?.id);
  const { skills } = useSkills();
  const { qualities } = useQualities();
  const { tracks } = useCareerTracks(user?.id);
  const [allTasks, setAllTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingDevTask, setIsAddingDevTask] = useState(false);
  const [editingTask, setEditingTask] = useState<LocalTask | null>(null);
  const [viewingTask, setViewingTask] = useState<LocalTask | null>(null);
  const [viewingDevPlanTask, setViewingDevPlanTask] = useState<DevelopmentPlanTask | null>(null);
  const [completingTask, setCompletingTask] = useState<LocalTask | null>(null);
  const [selectedResultLevel, setSelectedResultLevel] = useState<number>(0);
  const [managerId, setManagerId] = useState<string | undefined>();
  const [decryptedTitles, setDecryptedTitles] = useState<Record<string, string>>({});
  const [decryptedDescriptions, setDecryptedDescriptions] = useState<Record<string, string>>({});
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalTaskData, setApprovalTaskData] = useState<{
    evaluatedUserId: string;
    evaluatedUserName: string;
    diagnosticStageId: string;
  } | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'development' as const,
    priority: 'normal' as const,
    deadline: '',
    kpi_expected_level: 0,
    category: ''
  });
  const [newDevTask, setNewDevTask] = useState<NewDevelopmentTask>({
    title: '',
    goal: '',
    how_to: '',
    measurable_result: '',
    priority: 'normal',
    deadline: '',
    hard_skill_id: undefined,
    soft_skill_id: undefined,
    career_track_id: undefined,
    career_track_step_id: undefined,
  });

  useEffect(() => {
    if (user?.id) {
      fetchAllTasks();
      loadManagerId();
    }
  }, [user?.id]);

  const loadManagerId = async () => {
    if (!user?.id) return;
    
    const { data } = await supabase
      .from('users')
      .select('manager_id')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setManagerId(data.manager_id);
    }
  };

  useEffect(() => {
    // Объединяем задачи из хука (с расшифрованными ФИО) и все остальные задачи
    if (!tasksLoading) {
      const combinedTasks = [...tasksFromHook, ...allTasks.filter(t => !tasksFromHook.find(th => th.id === t.id))];
      setLoading(false);
    }
  }, [tasksFromHook, tasksLoading, allTasks]);

  // Расшифровываем имена для задач peer_approval и survey_360_evaluation
  useEffect(() => {
    const decryptTaskTitles = async () => {
      const tasksToDecrypt = tasksFromHook.filter(t => 
        (t.task_type === 'peer_approval' || t.task_type === 'survey_360_evaluation') && t.assignment_id
      );
      
      for (const task of tasksToDecrypt) {
        if (decryptedTitles[task.id]) continue;
        
        try {
          let targetUserId = task.assignment_id;
          let assignmentType: string | undefined;
          
          // Fetch assignment to get evaluated_user_id and assignment_type
          const { data: assignment } = await supabase
            .from('survey_360_assignments')
            .select('evaluated_user_id, assignment_type')
            .eq('id', task.assignment_id)
            .single();
          
          if (assignment) {
            targetUserId = assignment.evaluated_user_id;
            assignmentType = assignment.assignment_type || undefined;
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
                [task.id]: `Утвердить список респондентов для ${fullName}`
              }));
              setDecryptedDescriptions(prev => ({
                ...prev,
                [task.id]: `Необходимо рассмотреть и утвердить список респондентов для ${fullName}`
              }));
            } else if (task.task_type === 'survey_360_evaluation') {
              // Determine title based on assignment type
              const isManagerEvaluation = assignmentType === 'manager';
              const title = isManagerEvaluation
                ? `Обратная связь для сотрудника: ${fullName}`
                : `Обратная связь для коллеги: ${fullName}`;
              const description = isManagerEvaluation
                ? `Необходимо заполнить форму обратной связи для вашего сотрудника ${fullName}`
                : `Необходимо заполнить форму обратной связи для ${fullName}`;
              
              setDecryptedTitles(prev => ({
                ...prev,
                [task.id]: title
              }));
              setDecryptedDescriptions(prev => ({
                ...prev,
                [task.id]: description
              }));
            }
          }
        } catch (error) {
          console.error('Error decrypting task title:', error);
        }
      }
    };

    if (tasksFromHook.length > 0) {
      decryptTaskTitles();
    }
  }, [tasksFromHook]);

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      
      // Сначала получаем список активных diagnostic_stages
      const { data: activeStages } = await supabase
        .from('diagnostic_stages')
        .select('id, is_active, parent_stages!inner(is_active)')
        .eq('parent_stages.is_active', true)
        .eq('is_active', true);
      
      const activeStageIds = (activeStages || []).map(s => s.id);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        // История: показываем только завершённые задачи.
        // Просроченные (expired) и активные (pending/in_progress) в "Мои задачи" не выводим.
        .eq('status', 'completed')
        .order('priority', { ascending: false })
        .order('deadline', { ascending: true });

      if (error) throw error;
      
      // КРИТИЧНО: Фильтруем completed задачи - исключаем задачи закрытых этапов
      // Показываем только: задачи без diagnostic_stage_id ИЛИ из активных этапов
      const filteredData = (data || []).filter(task => {
        if (!task.diagnostic_stage_id) return true; // manual tasks
        return activeStageIds.includes(task.diagnostic_stage_id);
      });
      
      setAllTasks(filteredData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Ошибка при загрузке задач');
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const taskData = {
        user_id: user?.id,
        title: newTask.title,
        description: newTask.description,
        task_type: newTask.task_type,
        priority: newTask.priority,
        deadline: newTask.deadline || null,
        kpi_expected_level: newTask.task_type === 'development' ? newTask.kpi_expected_level : null,
        category: newTask.category || null,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      await refetchTasks();
      await fetchAllTasks();
      setNewTask({
        title: '',
        description: '',
        task_type: 'development',
        priority: 'normal',
        deadline: '',
        kpi_expected_level: 0,
        category: ''
      });
      setIsAddingTask(false);
      toast.success('Задача создана');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Ошибка при создании задачи');
    }
  };

  const handleCreateDevTask = async () => {
    if (!newDevTask.title.trim() || !newDevTask.goal.trim()) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('Пользователь не авторизован');

      // Создаем задачу
      const taskData = {
        user_id: authUser.user.id,
        title: newDevTask.title,
        description: newDevTask.goal,
        task_type: 'development',
        priority: newDevTask.priority,
        deadline: newDevTask.deadline || null,
        status: 'pending'
      };

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) throw taskError;

      // Создаем запись в development_plan_tasks
      const devPlanTaskData = {
        user_id: authUser.user.id,
        task_id: task.id,
        title: newDevTask.title,
        goal: newDevTask.goal,
        how_to: newDevTask.how_to,
        measurable_result: newDevTask.measurable_result,
        priority: newDevTask.priority,
        hard_skill_id: newDevTask.hard_skill_id || null,
        soft_skill_id: newDevTask.soft_skill_id || null,
        career_track_id: newDevTask.career_track_id || null,
        career_track_step_id: newDevTask.career_track_step_id || null,
      };

      const { error: devPlanError } = await supabase
        .from('development_plan_tasks')
        .insert(devPlanTaskData);

      if (devPlanError) throw devPlanError;

      await refetchTasks();
      await fetchAllTasks();
      
      setNewDevTask({
        title: '',
        goal: '',
        how_to: '',
        measurable_result: '',
        priority: 'normal',
        deadline: '',
        hard_skill_id: undefined,
        soft_skill_id: undefined,
        career_track_id: undefined,
        career_track_step_id: undefined,
      });
      setIsAddingDevTask(false);
      toast.success('Задача развития создана');
    } catch (error) {
      console.error('Error creating development task:', error);
      toast.error('Ошибка при создании задачи развития');
    }
  };

  const handleUpdateTask = async (taskId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      await refetchTasks();
      await fetchAllTasks();
      toast.success('Задача обновлена');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Ошибка при обновлении задачи');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await refetchTasks();
      await fetchAllTasks();
      toast.success('Задача удалена');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Ошибка при удалении задачи');
    }
  };

  const handleViewTask = async (task: LocalTask) => {
    setViewingTask(task);
    
    // Fetch development plan task details if it's a development task
    if (task.task_type === 'development') {
      try {
        const { data, error } = await supabase
          .from('development_plan_tasks')
          .select('*')
          .eq('task_id', task.id)
          .maybeSingle();
        
        if (!error && data) {
          setViewingDevPlanTask(data as DevelopmentPlanTask);
        }
      } catch (error) {
        console.error('Error fetching development plan task:', error);
      }
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;
    
    try {
      await handleUpdateTask(completingTask.id, {
        status: 'completed',
        kpi_result_level: selectedResultLevel
      });
      setCompletingTask(null);
      setSelectedResultLevel(0);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleCompleteKpiTask = async (task: Task, resultLevel: number) => {
    await handleUpdateTask(task.id, {
      status: 'completed',
      kpi_result_level: resultLevel
    });
  };

  const getTaskTypeIcon = (type?: string) => {
    switch (type) {
      case 'development': return Target;
      default: return CheckSquare;
    }
  };

  const getTaskTypeColor = (type?: string) => {
    switch (type) {
      case 'development': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'expired': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Выполнено';
      case 'in_progress': return 'Выполняется';
      case 'expired': return 'Просрочено';
      default: return 'Новая';
    }
  };

  const getTypeText = (type?: string) => {
    switch (type) {
      case 'development': return 'ИПР';
      default: return 'Задача';
    }
  };

  const tasks: Task[] = [...tasksFromHook, ...allTasks.filter(t => !tasksFromHook.find(th => th.id === t.id))];

  const sortedTasks = tasks.sort((a, b) => {
    // Urgent tasks first
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    
    // Then by deadline
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    
    return 0;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка задач...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Development Task Form */}
      {isAddingDevTask && (
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4">Создать задачу развития</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название задачи *</label>
              <input
                type="text"
                value={newDevTask.title}
                onChange={(e) => setNewDevTask({...newDevTask, title: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Название задачи"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Цель задачи *</label>
              <textarea
                value={newDevTask.goal}
                onChange={(e) => setNewDevTask({...newDevTask, goal: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                rows={2}
                placeholder="Какую цель преследует задача"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Как выполнить *</label>
              <textarea
                value={newDevTask.how_to}
                onChange={(e) => setNewDevTask({...newDevTask, how_to: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Конкретные шаги для выполнения задачи"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Измеримый результат *</label>
              <textarea
                value={newDevTask.measurable_result}
                onChange={(e) => setNewDevTask({...newDevTask, measurable_result: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                rows={2}
                placeholder="Как будет измеряться результат выполнения"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Приоритет</label>
                <select
                  value={newDevTask.priority}
                  onChange={(e) => setNewDevTask({...newDevTask, priority: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="normal">Обычная</option>
                  <option value="urgent">Срочная</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Срок выполнения</label>
                <input
                  type="date"
                  value={newDevTask.deadline}
                  onChange={(e) => setNewDevTask({...newDevTask, deadline: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Профессиональный навык</label>
                <select
                  value={newDevTask.hard_skill_id || ''}
                  onChange={(e) => setNewDevTask({...newDevTask, hard_skill_id: e.target.value || undefined})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">Не выбрано</option>
                  {skills?.map(skill => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Личное качество</label>
                <select
                  value={newDevTask.soft_skill_id || ''}
                  onChange={(e) => setNewDevTask({...newDevTask, soft_skill_id: e.target.value || undefined})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">Не выбрано</option>
                  {qualities?.map(quality => (
                    <option key={quality.id} value={quality.id}>{quality.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Карьерный трек</label>
              <select
                value={newDevTask.career_track_id || ''}
                onChange={(e) => {
                  setNewDevTask({
                    ...newDevTask, 
                    career_track_id: e.target.value || undefined,
                    career_track_step_id: undefined
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="">Не выбрано</option>
                {tracks?.map(track => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </div>

            {newDevTask.career_track_id && (
              <div>
                <label className="block text-sm font-medium mb-1">Шаг карьерного трека</label>
                <select
                  value={newDevTask.career_track_step_id || ''}
                  onChange={(e) => setNewDevTask({...newDevTask, career_track_step_id: e.target.value || undefined})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">Не выбрано</option>
                  {tracks
                    ?.find(t => t.id === newDevTask.career_track_id)
                    ?.steps.map(step => (
                      <option key={step.id} value={step.id}>
                        Шаг {step.step_order}: {step.grade.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={handleCreateDevTask}>
              Создать
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddingDevTask(false);
                setNewDevTask({
                  title: '',
                  goal: '',
                  how_to: '',
                  measurable_result: '',
                  priority: 'normal',
                  deadline: '',
                  hard_skill_id: undefined,
                  soft_skill_id: undefined,
                  career_track_id: undefined,
                  career_track_step_id: undefined,
                });
              }}
            >
              Отменить
            </Button>
          </div>
        </Card>
      )}

      {/* Add Task Form */}
      {isAddingTask && (
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4">Создать новую задачу</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название *</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Название задачи"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Описание цели и ожидаемого результата"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Тип задачи</label>
                <select
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({...newTask, task_type: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="development">Задача развития</option>
                  <option value="development">Задача развития</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Приоритет</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="normal">Обычная</option>
                  <option value="urgent">Срочная</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Срок выполнения</label>
                <input
                  type="date"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {newTask.task_type === 'development' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Ожидаемый уровень (0-4)</label>
                  <select
                    value={newTask.kpi_expected_level}
                    onChange={(e) => setNewTask({...newTask, kpi_expected_level: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={0}>0 - Не выполнено</option>
                    <option value={1}>1 - Частично выполнено</option>
                    <option value={2}>2 - Выполнено</option>
                    <option value={3}>3 - Хорошо выполнено</option>
                    <option value={4}>4 - Перевыполнено</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={handleCreateTask}>
              Создать
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddingTask(false);
                setNewTask({
                  title: '',
                  description: '',
                  task_type: 'development',
                  priority: 'normal',
                  deadline: '',
                  kpi_expected_level: 0,
                  category: ''
                });
              }}
            >
              Отменить
            </Button>
          </div>
        </Card>
      )}

      {/* Tasks List */}
      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Нет задач
            </h4>
            <p className="text-gray-600 mb-6">
              Нет назначенных задач
            </p>
          </Card>
        ) : (
          sortedTasks.map((task) => {
            const handleTaskClick = () => {
              if (task.task_type === 'meeting' && task.assignment_id) {
                navigate('/meetings');
              } else if ('assignment_id' in task && task.assignment_id) {
                // Переход к конкретной оценке
                navigate(`/unified-assessment/${task.assignment_id}`);
              }
            };
            const taskType = 'task_type' in task ? task.task_type : undefined;
            const TypeIcon = getTaskTypeIcon(taskType);
            const evaluatedUserName = 'evaluated_user_name' in task ? task.evaluated_user_name : undefined;
            const isSelfAssessment = 'is_self_assessment' in task ? task.is_self_assessment : undefined;
            const kpiExpectedLevel = 'kpi_expected_level' in task ? task.kpi_expected_level : undefined;
            const kpiResultLevel = 'kpi_result_level' in task ? task.kpi_result_level : undefined;
            
            const displayTitle = (task.task_type === 'peer_approval' || task.task_type === 'survey_360_evaluation') && decryptedTitles[task.id] 
              ? decryptedTitles[task.id] 
              : task.title;
            
            const displayDescription = (task.task_type === 'peer_approval' || task.task_type === 'survey_360_evaluation') && decryptedDescriptions[task.id]
              ? decryptedDescriptions[task.id]
              : task.description;
            
            return (
              <Card key={task.id} className={`p-4 ${task.priority === 'urgent' ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeIcon className="w-4 h-4 text-gray-500" />
                      <h5 className="font-medium text-gray-900">{displayTitle}</h5>
                      
                      {task.priority === 'urgent' && (
                        <Badge variant="destructive" className="ml-2">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Срочно
                        </Badge>
                      )}
                    </div>
                    
                    {displayDescription && (
                      <p className="text-gray-600 text-sm mb-3">{displayDescription}</p>
                    )}
                    
                    {evaluatedUserName && !isSelfAssessment && (
                      <p className="text-gray-500 text-sm mb-2">
                        <User className="w-3 h-3 inline mr-1" />
                        Сотрудник: {evaluatedUserName}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      <Badge className={getTaskTypeColor(taskType)}>
                        {getTypeText(taskType)}
                      </Badge>
                      
                      <Badge className={getStatusColor(task.status)}>
                        {getStatusText(task.status)}
                      </Badge>
                      
                      {task.deadline && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.deadline).toLocaleDateString('ru-RU')}
                        </div>
                      )}
                      
                      {taskType === 'kpi' && kpiExpectedLevel !== null && kpiExpectedLevel !== undefined && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="text-gray-600">
                            Цель: {kpiExpectedLevel}
                            {kpiResultLevel !== null && kpiResultLevel !== undefined && (
                              <span className="ml-1">| Результат: {kpiResultLevel}</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {taskType === 'development' && (
                      <>
                        <Button
                          onClick={() => handleViewTask(task as LocalTask)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Посмотреть
                        </Button>
                        
                        {task.status !== 'completed' && (
                          <>
                            {task.status === 'pending' && (
                              <Button
                                onClick={() => handleUpdateTask(task.id, { status: 'in_progress' })}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Начать
                              </Button>
                            )}
                            
                            {task.status === 'in_progress' && (
                              <Button
                                onClick={() => {
                                  setCompletingTask(task as LocalTask);
                                  setSelectedResultLevel(0);
                                }}
                              >
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Завершить
                              </Button>
                            )}
                          </>
                        )}
                        
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    
                    {(taskType === 'meeting' || taskType === 'assessment' || ('assignment_type' in task && task.assignment_type)) && taskType !== 'peer_selection' && taskType !== 'peer_approval' && (
                      <>
                        {task.status === 'pending' && (
                          <Button
                            onClick={handleTaskClick}
                          >
                            {('assignment_type' in task && task.assignment_type === 'self') && (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Начать самооценку
                              </>
                            )}
                            {('assignment_type' in task && task.assignment_type === 'manager') && (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Оценить подчиненного
                              </>
                            )}
                            {('assignment_type' in task && task.assignment_type === 'peer') && (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Дать фидбек коллеге
                              </>
                            )}
                            {taskType === 'meeting' && (
                              <>
                                <Video className="w-4 h-4 mr-2" />
                                Перейти к встрече
                              </>
                            )}
                          </Button>
                        )}
                        
                        {task.status === 'in_progress' && (
                          <Button
                            onClick={handleTaskClick}
                          >
                            {('assignment_type' in task && task.assignment_type === 'self') && (
                              <>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Продолжить самооценку
                              </>
                            )}
                            {('assignment_type' in task && task.assignment_type === 'manager') && (
                              <>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Продолжить оценку подчиненного
                              </>
                            )}
                            {('assignment_type' in task && task.assignment_type === 'peer') && (
                              <>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Продолжить оценку коллеги
                              </>
                            )}
                            {taskType === 'meeting' && (
                              <>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Продолжить
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    
                    {taskType === 'peer_selection' && task.status === 'pending' && (
                      <PeerSelectionButton
                        currentUserId={user?.id || ''}
                        managerId={managerId}
                        diagnosticStageId={task.diagnostic_stage_id}
                        taskId={task.id}
                        onSelectionComplete={() => {
                          refetchTasks();
                          fetchAllTasks();
                        }}
                      />
                    )}
                    
                    {taskType === 'peer_approval' && task.status === 'pending' && (
                      <Button
                        onClick={async () => {
                          try {
                            // Получаем данные оцениваемого пользователя
                            const { data: userData } = await supabase
                              .from('users')
                              .select('first_name, last_name, email')
                              .eq('id', task.assignment_id)
                              .single();

                            if (userData) {
                              const decrypted = await decryptUserData({
                                first_name: userData.first_name,
                                last_name: userData.last_name,
                                middle_name: null,
                                email: userData.email
                              });
                              setApprovalTaskData({
                                evaluatedUserId: task.assignment_id || '',
                                evaluatedUserName: `${decrypted.last_name} ${decrypted.first_name}`,
                                diagnosticStageId: task.diagnostic_stage_id || ''
                              });
                              setShowApprovalDialog(true);
                            }
                          } catch (error) {
                            console.error('Error loading user data:', error);
                            toast.error('Ошибка загрузки данных пользователя');
                          }
                        }}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Утвердить список оценивающих
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* View Development Task Dialog */}
      {viewingTask && (
        <Dialog open={!!viewingTask} onOpenChange={() => {
          setViewingTask(null);
          setViewingDevPlanTask(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {viewingTask.task_type === 'peer_approval' && decryptedTitles[viewingTask.id] 
                  ? decryptedTitles[viewingTask.id] 
                  : viewingTask.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Статус</label>
                <p className="mt-1">
                  <Badge className={getStatusColor(viewingTask.status)}>
                    {getStatusText(viewingTask.status)}
                  </Badge>
                </p>
              </div>

              {viewingTask.deadline && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Срок выполнения</label>
                  <p className="mt-1">{new Date(viewingTask.deadline).toLocaleDateString('ru-RU')}</p>
                </div>
              )}

              {viewingTask.priority && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Приоритет</label>
                  <p className="mt-1">{viewingTask.priority === 'urgent' ? 'Срочный' : 'Обычный'}</p>
                </div>
              )}

              {viewingDevPlanTask && (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Цель задачи</label>
                    <p className="mt-1 text-foreground">{viewingDevPlanTask.goal}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Как выполнить</label>
                    <p className="mt-1 text-foreground whitespace-pre-wrap">{viewingDevPlanTask.how_to}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Измеримый результат</label>
                    <p className="mt-1 text-foreground">{viewingDevPlanTask.measurable_result}</p>
                  </div>
                </>
              )}

              {viewingTask.description && !viewingDevPlanTask && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Описание</label>
                  <p className="mt-1 text-foreground whitespace-pre-wrap">{viewingTask.description}</p>
                </div>
              )}

              {viewingTask.kpi_result_level !== null && viewingTask.kpi_result_level !== undefined && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Результат выполнения</label>
                  <p className="mt-1">
                    <Badge variant="secondary">
                      Уровень: {viewingTask.kpi_result_level}
                    </Badge>
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Complete Development Task Dialog */}
      {completingTask && (
        <Dialog open={!!completingTask} onOpenChange={() => {
          setCompletingTask(null);
          setSelectedResultLevel(0);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Завершение задачи</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Выберите уровень достижения результата для задачи "{completingTask.task_type === 'peer_approval' && decryptedTitles[completingTask.id] 
                  ? decryptedTitles[completingTask.id] 
                  : completingTask.title}"
              </p>

              <div>
                <label className="text-sm font-medium">Уровень результата (0-4)</label>
                <select
                  value={selectedResultLevel}
                  onChange={(e) => setSelectedResultLevel(Number(e.target.value))}
                  className="w-full mt-2 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value={0}>0 - Не выполнено</option>
                  <option value={1}>1 - Частично выполнено</option>
                  <option value={2}>2 - Выполнено</option>
                  <option value={3}>3 - Хорошо выполнено</option>
                  <option value={4}>4 - Перевыполнено</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompletingTask(null);
                    setSelectedResultLevel(0);
                  }}
                >
                  Отмена
                </Button>
                <Button onClick={handleCompleteTask}>
                  Завершить задачу
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Peer Approval Dialog */}
      {approvalTaskData && (
        <ManagerRespondentApproval
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          evaluatedUserId={approvalTaskData.evaluatedUserId}
          evaluatedUserName={approvalTaskData.evaluatedUserName}
          diagnosticStageId={approvalTaskData.diagnosticStageId}
          onApprovalComplete={() => {
            refetchTasks();
            fetchAllTasks();
            setShowApprovalDialog(false);
            setApprovalTaskData(null);
          }}
        />
      )}
    </div>
  );
};