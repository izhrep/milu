import { useState, useEffect, useCallback, useRef } from 'react';
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
  const fetchIdRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    const fetchId = ++fetchIdRef.current;
    
    try {
      setLoading(true);
      setError(null);

      // Параллельно загружаем active stages и все задачи пользователя
      const [stagesRes, tasksRes] = await Promise.all([
        supabase
          .from('diagnostic_stages')
          .select('id, is_active, parent_stages!inner(is_active, end_date)')
          .eq('parent_stages.is_active', true)
          .eq('is_active', true),
        supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false }),
      ]);

      if (fetchId !== fetchIdRef.current) return; // stale request
      if (tasksRes.error) throw tasksRes.error;

      const activeStageIds = (stagesRes.data || []).map(s => s.id);
      const allTasks = tasksRes.data || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filteredTasks = allTasks.filter(task => {
        if (task.status === 'expired') return false;
        if (task.deadline) {
          const deadlineDate = new Date(task.deadline);
          deadlineDate.setHours(0, 0, 0, 0);
          if (deadlineDate < today) return false;
        }
        if (task.task_type === 'meeting' && !task.assignment_id) return false;
        if (!task.diagnostic_stage_id) return true;
        if (['meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary', 'meeting_plan_new'].includes(task.task_type || '')) return true;
        return activeStageIds.includes(task.diagnostic_stage_id);
      });

      // === Обогащаем meeting-задачи ===
      const meetingTaskTypes = ['meeting_scheduled', 'meeting_fill_summary', 'meeting_review_summary'];
      const meetingTasks = filteredTasks.filter(
        t => meetingTaskTypes.includes(t.task_type || '') && t.assignment_id
      );
      
      const meetingInfoMap: Record<string, {
        number: number;
        date: string;
        employee_id: string;
        manager_id: string;
        summary_saved_by: string | null;
      }> = {};
      
      if (meetingTasks.length > 0) {
        const meetingIds = [...new Set(meetingTasks.map(t => t.assignment_id))];
        
        const { data: meetings } = await supabase
          .from('one_on_one_meetings')
          .select('id, employee_id, manager_id, meeting_date, summary_saved_by')
          .in('id', meetingIds);
        
        if (fetchId !== fetchIdRef.current) return;
        
        if (meetings && meetings.length > 0) {
          const pairKeys = new Set<string>();
          for (const m of meetings) {
            pairKeys.add(`${m.employee_id}__${m.manager_id}`);
          }
          
          // Загружаем нумерацию параллельно для всех пар
          const pairPromises = [...pairKeys].map(async (pairKey) => {
            const [empId, mgrId] = pairKey.split('__');
            const { data: pairMeetings } = await supabase
              .from('one_on_one_meetings')
              .select('id, meeting_date')
              .eq('employee_id', empId)
              .eq('manager_id', mgrId)
              .order('meeting_date', { ascending: true });
            
            if (pairMeetings) {
              pairMeetings.forEach((pm, idx) => {
                const existing = meetings.find(m => m.id === pm.id);
                if (existing) {
                  meetingInfoMap[pm.id] = {
                    number: idx + 1,
                    date: pm.meeting_date,
                    employee_id: existing.employee_id,
                    manager_id: existing.manager_id,
                    summary_saved_by: existing.summary_saved_by,
                  };
                }
              });
            }
          });
          await Promise.all(pairPromises);
          if (fetchId !== fetchIdRef.current) return;
        }
      }

      // Обогащаем assignment-задачи ПАРАЛЛЕЛЬНО
      const tasksWithDetails = await Promise.all(filteredTasks.map(async (task) => {
        let taskDetails: Task = { 
          ...task,
          assignment_type: task.assignment_type as any,
          is_self_assessment: undefined,
          evaluated_user_name: undefined
        };

        // Meeting-задачи
        const mInfo = task.assignment_id ? meetingInfoMap[task.assignment_id] : undefined;
        if (mInfo && meetingTaskTypes.includes(task.task_type || '')) {
          const dateObj = new Date(mInfo.date);
          const formattedDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
          const meetingLabel = `one-to-one №${mInfo.number} от ${formattedDate}`;

          if (task.task_type === 'meeting_scheduled') {
            taskDetails.title = `Запланирована встреча ${meetingLabel}`;
            taskDetails.description = `У вас запланирована встреча one-to-one. Подготовьтесь к обсуждению.`;
          } else if (task.task_type === 'meeting_fill_summary') {
            taskDetails.title = `Заполните итоги встречи ${meetingLabel}`;
            taskDetails.description = `Необходимо зафиксировать итоги прошедшей встречи one-to-one.`;
          } else if (task.task_type === 'meeting_review_summary') {
            taskDetails.title = `Ознакомьтесь с итогами встречи ${meetingLabel}`;
            if (mInfo.summary_saved_by) {
              if (mInfo.summary_saved_by === mInfo.manager_id && task.user_id === mInfo.employee_id) {
                taskDetails.description = 'Ваш руководитель зафиксировал итоги встречи, пожалуйста, ознакомьтесь с ними';
              } else if (mInfo.summary_saved_by === mInfo.employee_id && task.user_id === mInfo.manager_id) {
                taskDetails.description = 'Ваш сотрудник зафиксировал итоги встречи, пожалуйста, ознакомьтесь с ними';
              } else {
                taskDetails.description = 'Итоги встречи зафиксированы, пожалуйста, ознакомьтесь с ними';
              }
            } else {
              taskDetails.description = 'Итоги встречи зафиксированы, пожалуйста, ознакомьтесь с ними';
            }
          }

          return taskDetails;
        }

        // Расшифровываем ФИО для assignment-задач
        if (task.assignment_id) {
          const { data: assignment } = await supabase
            .from('survey_360_assignments')
            .select('evaluated_user_id, evaluating_user_id, diagnostic_stage_id')
            .eq('id', task.assignment_id)
            .single();

          if (assignment) {
            // Параллельно проверяем черновики и загружаем пользователя
            const draftPromise = (task.task_type === 'diagnostic_stage' && assignment.diagnostic_stage_id)
              ? Promise.all([
                  supabase.from('hard_skill_results').select('id').eq('assignment_id', task.assignment_id).eq('is_draft', true).limit(1),
                  supabase.from('soft_skill_results').select('id').eq('assignment_id', task.assignment_id).eq('is_draft', true).limit(1),
                ])
              : Promise.resolve(null);

            const userPromise = supabase
              .from('users')
              .select('last_name, first_name, middle_name, email')
              .eq('id', assignment.evaluated_user_id)
              .single();

            const [draftResults, userRes] = await Promise.all([draftPromise, userPromise]);

            // Handle draft status update
            if (draftResults && Array.isArray(draftResults)) {
              const [hardDrafts, softDrafts] = draftResults;
              if (((hardDrafts.data?.length || 0) > 0) || ((softDrafts.data?.length || 0) > 0)) {
                if (task.status === 'pending') {
                  await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
                  taskDetails.status = 'in_progress';
                }
              }
            }

            const evaluatedUser = userRes.data;
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
                const decryptedName = [decrypted.last_name, decrypted.first_name, decrypted.middle_name].filter(Boolean).join(' ');
                if (decryptedName && !decryptedName.includes('=') && decryptedName.length < 100) {
                  fullName = decryptedName;
                  decryptionSuccessful = true;
                }
              } catch (error) {
                console.error('Error decrypting user data:', error);
              }
            }
            
            if (!decryptionSuccessful && task.title?.includes(':')) {
              const existingName = task.title.split(':')[1]?.trim();
              if (existingName && existingName !== 'Неизвестно' && !existingName.includes('=')) {
                fullName = existingName;
                decryptionSuccessful = true;
              }
            }
            
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
            
            if (task.task_type === 'survey_360_evaluation' && decryptionSuccessful) {
              if (task.title?.includes('подчинённого')) {
                taskDetails.title = `Обратная связь для сотрудника: ${fullName}`;
              } else if (task.title?.includes('коллеги')) {
                taskDetails.title = `Обратная связь для коллеги: ${fullName}`;
              }
            } else if (task.task_type === 'diagnostic_stage' && decryptionSuccessful) {
              if (task.title?.includes(':')) {
                taskDetails.title = task.title.split(':')[0] + ': ' + fullName;
              }
            }
            
            taskDetails.description = isSelfAssessment 
              ? 'Необходимо пройти опрос "Обратная связь 360" по себе'
              : `Необходимо заполнить форму обратной связи для ${fullName}`;
          }
        }

        return taskDetails;
      }));

      if (fetchId !== fetchIdRef.current) return;
      setTasks(tasksWithDetails);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке задач');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchTasks();
    }
  }, [userId, fetchTasks]);

  // Realtime subscription — auto-refetch on any tasks change for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tasks-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (updateError) throw updateError;

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