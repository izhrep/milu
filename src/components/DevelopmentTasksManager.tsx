import React, { useState } from 'react';
import { CheckSquare, Plus, Edit3, Trash2, Clock, Target } from 'lucide-react';
import { useDevelopmentTasks } from '@/hooks/useDevelopmentTasks';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { useUsers } from '@/hooks/useUsers';

interface Task {
  id: string;
  task_name: string;
  task_goal: string;
  how_to?: string;
  measurable_result?: string;
  status: 'pending' | 'in_progress' | 'completed';
  is_custom?: boolean;
}

interface DevelopmentTasksManagerProps {
  onNavigateToSurveys?: () => void;
}

export const DevelopmentTasksManager: React.FC<DevelopmentTasksManagerProps> = ({ onNavigateToSurveys }) => {
  const { getCurrentUser } = useUsers();
  const currentUser = getCurrentUser();
  const { profile, loading: profileLoading } = useCompetencyProfile(currentUser?.id);
  const { tasks, loading: tasksLoading } = useDevelopmentTasks(profile);
  
  const [customTasks, setCustomTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    task_name: '',
    task_goal: '',
    how_to: '',
    measurable_result: ''
  });

  const handleAddTask = () => {
    if (!newTask.task_name.trim() || !newTask.task_goal.trim()) return;
    
    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      status: 'pending',
      is_custom: true
    };
    
    setCustomTasks([...customTasks, task]);
    setNewTask({ task_name: '', task_goal: '', how_to: '', measurable_result: '' });
    setIsAddingTask(false);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      task_name: task.task_name,
      task_goal: task.task_goal,
      how_to: task.how_to || '',
      measurable_result: task.measurable_result || ''
    });
  };

  const handleUpdateTask = () => {
    if (!editingTask || !newTask.task_name.trim() || !newTask.task_goal.trim()) return;
    
    setCustomTasks(customTasks.map(task => 
      task.id === editingTask.id 
        ? { ...task, ...newTask }
        : task
    ));
    
    setEditingTask(null);
    setNewTask({ task_name: '', task_goal: '', how_to: '', measurable_result: '' });
  };

  const handleDeleteTask = (taskId: string) => {
    setCustomTasks(customTasks.filter(task => task.id !== taskId));
  };

  const handleToggleTaskStatus = (taskId: string) => {
    setCustomTasks(customTasks.map(task => {
      if (task.id === taskId) {
        const newStatus = task.status === 'completed' 
          ? 'pending' 
          : task.status === 'pending' 
          ? 'in_progress' 
          : 'completed';
        return { ...task, status: newStatus };
      }
      return task;
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Выполнено';
      case 'in_progress': return 'В работе';
      default: return 'Ожидает';
    }
  };

  const renderTaskForm = () => (
    <div className="bg-gray-50 rounded-lg p-4">
      <h6 className="font-medium text-gray-900 mb-4">
        {editingTask ? 'Редактировать задачу' : 'Добавить новую задачу'}
      </h6>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название задачи *
          </label>
          <input
            type="text"
            value={newTask.task_name}
            onChange={(e) => setNewTask({...newTask, task_name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Например: Изучить основы Python"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Цель задачи *
          </label>
          <textarea
            value={newTask.task_goal}
            onChange={(e) => setNewTask({...newTask, task_goal: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={2}
            placeholder="Описание цели и ожидаемого результата"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Как выполнить
          </label>
          <textarea
            value={newTask.how_to}
            onChange={(e) => setNewTask({...newTask, how_to: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={2}
            placeholder="Конкретные шаги для выполнения"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Измеримый результат
          </label>
          <input
            type="text"
            value={newTask.measurable_result}
            onChange={(e) => setNewTask({...newTask, measurable_result: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Как измерить выполнение задачи"
          />
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={editingTask ? handleUpdateTask : handleAddTask}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          {editingTask ? 'Сохранить' : 'Добавить'}
        </button>
        <button
          onClick={() => {
            setIsAddingTask(false);
            setEditingTask(null);
            setNewTask({ task_name: '', task_goal: '', how_to: '', measurable_result: '' });
          }}
          className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 transition-colors"
        >
          Отменить
        </button>
      </div>
    </div>
  );

  const renderTask = (task: any, isCustom: boolean = false) => (
    <div key={task.id} className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h6 className="font-medium text-gray-900">{task.task_name}</h6>
            {isCustom && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                Пользовательская
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-2">{task.task_goal}</p>
          
          {task.how_to && (
            <p className="text-gray-500 text-sm mb-1">
              <strong>Как выполнить:</strong> {task.how_to}
            </p>
          )}
          
          {task.measurable_result && (
            <p className="text-gray-500 text-sm">
              <strong>Результат:</strong> {task.measurable_result}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {isCustom && (
            <>
              <button
                onClick={() => handleToggleTaskStatus(task.id)}
                className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(task.status)}`}
              >
                {getStatusText(task.status)}
              </button>
              <button
                onClick={() => handleEditTask(task)}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (tasksLoading || profileLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка задач развития...</p>
        </div>
      </div>
    );
  }

  const hasAutoGeneratedTasks = tasks && (tasks.skills.length > 0 || tasks.qualities.length > 0);

  return (
    <div className="space-y-6">
      {/* Автоматически сгенерированные задачи */}
      {hasAutoGeneratedTasks ? (
        <>
          {tasks.skills.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Развитие Hard Skills (GAP анализ)</h4>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  Автогенерация
                </span>
              </div>
              
              <div className="space-y-4">
                {tasks.skills.map((skill) => (
                  <div key={skill.id} className="border-l-4 border-blue-200 pl-4">
                    <h5 className="font-semibold text-gray-900 mb-2">{skill.name}</h5>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span>Текущий: {skill.current_level}</span>
                      <span>Целевой: {skill.target_level}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                        GAP: {(skill.target_level - skill.current_level).toFixed(1)}
                      </span>
                    </div>
                    
                    {skill.tasks && skill.tasks.length > 0 && (
                      <div className="space-y-2">
                        {skill.tasks.map((task) => renderTask(task))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.qualities.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Развитие Soft Skills (GAP анализ)</h4>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                  Автогенерация
                </span>
              </div>
              
              <div className="space-y-4">
                {tasks.qualities.map((quality) => (
                  <div key={quality.id} className="border-l-4 border-purple-200 pl-4">
                    <h5 className="font-semibold text-gray-900 mb-2">{quality.name}</h5>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span>Текущий: {quality.current_level}</span>
                      <span>Целевой: {quality.target_level}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                        GAP: {(quality.target_level - quality.current_level).toFixed(1)}
                      </span>
                    </div>
                    
                    {quality.tasks && quality.tasks.length > 0 && (
                      <div className="space-y-2">
                        {quality.tasks.map((task) => renderTask(task))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Нет автоматических задач развития</h4>
          <p className="text-gray-600 mb-6">
            Задачи появятся после выбора карьерного трека и прохождения оценок. 
            Пройдите оценки Hard Skills и Soft Skills, чтобы получить персонализированные рекомендации.
          </p>
          
          {onNavigateToSurveys && (
            <button
              onClick={onNavigateToSurveys}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Пройти оценки
            </button>
          )}
        </div>
      )}

      {/* Пользовательские задачи */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Мои задачи развития</h4>
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить задачу
          </button>
        </div>

        {(isAddingTask || editingTask) && renderTaskForm()}

        {customTasks.length > 0 ? (
          <div className="space-y-3 mt-4">
            {customTasks.map((task) => renderTask(task, true))}
          </div>
        ) : !isAddingTask && !editingTask && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-600 text-sm">
              Здесь будут отображаться ваши персональные задачи развития
            </p>
          </div>
        )}
      </div>
    </div>
  );
};