import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData } from '@/lib/userDataDecryption';

export interface Task {
  id: string;
  user_id: string;
  assignment_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  assignment_type?: 'survey_360' | 'skill_survey' | 'self' | 'peer' | 'manager';
  is_self_assessment?: boolean;
  evaluated_user_name?: string;
  deadline?: string;
  category?: string;
  competency_ref?: string;
  kpi_expected_level?: number;
  kpi_result_level?: number;
  priority?: string;
  task_type?: string;
  diagnostic_stage_id?: string;
}

export const useTasks = (userId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchTasks();
    }
  }, [userId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем id активных diagnostic_stages (из активных parent_stages И с is_active = true)
      // КРИТИЧНО: фильтруем по ОБОИМ условиям - активный parent_stage И активный diagnostic_stage
      const { data: activeStages } = await supabase
        .from('diagnostic_stages')
        .select('id, is_active, parent_stages!inner(is_active, end_date)')
        .eq('parent_stages.is_active', true)
        .eq('is_active', true);
      
      const activeStageIds = (activeStages || []).map(s => s.id);

      // Получаем все задачи пользователя (pending и in_progress)
      // Исключаем задачи из завершённых этапов
      // Также исключаем задачи со статусом expired - они уже обработаны
      const { data: allTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Фильтруем задачи: показываем только те, которые либо не связаны с этапом,
      // либо связаны с активным этапом
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filteredTasks = (allTasks || []).filter(task => {
        // Исключаем задачи со статусом expired (дополнительная защита)
        if (task.status === 'expired') return false;
        
        // Исключаем просроченные задачи (дедлайн в прошлом)
        if (task.deadline) {
          const deadlineDate = new Date(task.deadline);
          deadlineDate.setHours(0, 0, 0, 0);
          if (deadlineDate < today) return false;
        }
        
        // Meeting tasks and tasks without diagnostic_stage_id — always show
        if (!task.diagnostic_stage_id) return true;
        if (['meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary', 'meeting_plan_new'].includes(task.task_type || '')) return true;
        
        // КРИТИЧНО: задачи связанные с этапом показываем ТОЛЬКО если этап активен
        // Это исключает задачи из закрытых этапов (is_active=false)
        return activeStageIds.includes(task.diagnostic_stage_id);
      });

      // Получаем дополнительную информацию о назначениях
      const tasksWithDetails = [];
      
      for (const task of filteredTasks) {
        let taskDetails: Task = { 
          ...task,
          assignment_type: task.assignment_type as any,
          is_self_assessment: undefined,
          evaluated_user_name: undefined
        };

        // Расшифровываем ФИО для всех задач с assignment_id
        if (task.assignment_id) {
          const { data: assignment } = await supabase
            .from('survey_360_assignments')
            .select('evaluated_user_id, evaluating_user_id, diagnostic_stage_id')
            .eq('id', task.assignment_id)
            .single();

          if (assignment) {
            // Проверяем наличие черновиков для задач диагностики
            if (task.task_type === 'diagnostic_stage' && assignment.diagnostic_stage_id) {
              const { data: draftResults } = await supabase
                .from('hard_skill_results')
                .select('id')
                .eq('assignment_id', task.assignment_id)
                .eq('is_draft', true)
                .limit(1);

              const { data: softDraftResults } = await supabase
                .from('soft_skill_results')
                .select('id')
                .eq('assignment_id', task.assignment_id)
                .eq('is_draft', true)
                .limit(1);

              if ((draftResults && draftResults.length > 0) || (softDraftResults && softDraftResults.length > 0)) {
                if (task.status === 'pending') {
                  await supabase
                    .from('tasks')
                    .update({ status: 'in_progress' })
                    .eq('id', task.id);
                  taskDetails.status = 'in_progress';
                }
              }
            }

            // Получаем и расшифровываем данные оцениваемого пользователя
            const { data: evaluatedUser } = await supabase
              .from('users')
              .select('last_name, first_name, middle_name, email')
              .eq('id', assignment.evaluated_user_id)
              .single();

            let fullName = '';
            let decryptionSuccessful = false;
            if (evaluatedUser) {
              try {
                const decrypted = await decryptUserData({
                  first_name: evaluatedUser.first_name,
                  last_name: evaluatedUser.last_name,
                  middle_name: evaluatedUser.middle_name,
                  email: evaluatedUser.email,
                });
                // Проверяем что расшифровка успешна (имя не содержит base64 символов)
                const decryptedName = [decrypted.last_name, decrypted.first_name, decrypted.middle_name].filter(Boolean).join(' ');
                if (decryptedName && !decryptedName.includes('=') && decryptedName.length < 100) {
                  fullName = decryptedName;
                  decryptionSuccessful = true;
                }
              } catch (error) {
                console.error('Error decrypting user data:', error);
              }
            }
            
            // Если расшифровка не удалась, используем имя из существующего title если оно есть
            if (!decryptionSuccessful && task.title?.includes(':')) {
              const existingName = task.title.split(':')[1]?.trim();
              if (existingName && existingName !== 'Неизвестно' && !existingName.includes('=')) {
                fullName = existingName;
                decryptionSuccessful = true;
              }
            }
            
            // Если всё ещё нет имени, ставим "Неизвестно"
            if (!fullName) {
              fullName = 'Неизвестно';
            }

            const isSelfAssessment = assignment.evaluated_user_id === assignment.evaluating_user_id;
            if (!taskDetails.assignment_type) {
              taskDetails.assignment_type = (task.task_type === 'skill_survey' || task.task_type === 'survey_360') 
                ? task.task_type 
                : 'survey_360';
            }
            taskDetails.is_self_assessment = isSelfAssessment;
            taskDetails.evaluated_user_name = fullName;
            
            // Обновляем title только если расшифровка успешна
            if (task.task_type === 'survey_360_evaluation' && decryptionSuccessful) {
              if (task.title?.includes('подчинённого')) {
                taskDetails.title = `Обратная связь для сотрудника: ${fullName}`;
              } else if (task.title?.includes('коллеги')) {
                taskDetails.title = `Обратная связь для коллеги: ${fullName}`;
              }
            } else if (task.task_type === 'diagnostic_stage' && decryptionSuccessful) {
              // Для diagnostic_stage тоже обновляем title если там есть имя
              if (task.title?.includes(':')) {
                taskDetails.title = task.title.split(':')[0] + ': ' + fullName;
              }
            }
            
            taskDetails.description = isSelfAssessment 
              ? 'Необходимо пройти опрос "Обратная связь 360" по себе'
              : `Необходимо заполнить форму обратной связи для ${fullName}`;
          }
        }

        tasksWithDetails.push(taskDetails);
      }

      setTasks(tasksWithDetails);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Обновляем локальное состояние
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status, updated_at: new Date().toISOString() }
          : task
      ));
      
      return { success: true };
    } catch (err) {
      console.error('Error updating task status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обновлении статуса задачи';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    tasks,
    loading,
    error,
    updateTaskStatus,
    refetch: fetchTasks
  };
};