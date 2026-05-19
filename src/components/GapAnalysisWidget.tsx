import React, { useState } from 'react';
import { CompetencyProfile } from '@/hooks/useCompetencyProfile';
import { useDevelopmentTasks } from '@/hooks/useDevelopmentTasks';
import { ChevronDown, Target, CheckCircle2 } from "@/components/icons";

interface DevelopmentTasksWidgetProps {
  profile: CompetencyProfile;
  loading: boolean;
}

export const DevelopmentTasksWidget: React.FC<DevelopmentTasksWidgetProps> = ({ profile, loading }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('skills');
  const { tasks, loading: tasksLoading } = useDevelopmentTasks(profile);

  if (loading || tasksLoading) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Задачи на развитие</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-caption-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Задачи на развитие</h4>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-caption-sm">Нет данных для анализа</p>
        </div>
      </div>
    );
  }

  const getGapLevel = (gap: number) => {
    if (gap <= 0.5) return { level: 'Готов', color: 'bg-success', textColor: 'text-success' };
    if (gap <= 1.5) return { level: 'Почти готов', color: 'bg-warning', textColor: 'text-warning' };
    if (gap <= 3) return { level: 'Требует развития', color: 'bg-warning', textColor: 'text-warning' };
    return { level: 'Критический пробел', color: 'bg-destructive', textColor: 'text-destructive' };
  };

  const getProgressWidth = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const renderCompetencyWithTasks = (items: any[], title: string, categoryKey: string) => {
    const isExpanded = expandedCategory === categoryKey;
    
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
          className="w-full p-4 bg-muted flex items-center justify-between hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <h5 className="text-foreground text-body-md font-medium">{title}</h5>
            <span className="px-2 py-1 bg-warning text-white text-caption-sm rounded-full">
              {items.length}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        
        {isExpanded && (
          <div className="p-4 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-caption-sm">Нет задач в этой категории</p>
              </div>
            ) : (
              items.map((item) => {
                const gapInfo = getGapLevel(item.gap);
                const progressWidth = getProgressWidth(item.current_level, item.target_level || 4);
                
                return (
                    <div key={item.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="p-3 bg-muted">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-foreground text-body-md font-medium">{item.name}</div>
                          <div className="text-muted-foreground text-caption-sm mt-1">{item.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground text-body-md">
                            {item.current_level}/{item.target_level || 4}
                          </span>
                          <span className={`px-2 py-1 text-caption-sm font-medium rounded ${gapInfo.textColor} bg-opacity-20`}>
                            GAP: {item.gap.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Прогресс-бар */}
                      <div className="mb-2">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${gapInfo.color}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-caption-sm font-medium ${gapInfo.textColor}`}>
                          {gapInfo.level}
                        </span>
                        {item.last_assessed && (
                          <span className="text-muted-foreground text-caption-sm">
                            Оценен: {new Date(item.last_assessed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Задачи развития */}
                    {item.tasks && item.tasks.length > 0 && (
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-warning" />
                          <span className="text-body-md font-medium text-foreground">Задачи развития</span>
                        </div>
                        {item.tasks.map((task: any, index: number) => (
                          <div key={task.id} className="p-3 bg-primary/10 rounded-lg border-l-4 border-primary">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-caption-sm font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-body-md text-foreground mb-1">{task.task_name}</div>
                                <div className="text-caption-sm text-muted-foreground mb-2">{task.task_goal}</div>
                                <div className="text-caption-sm text-muted-foreground mb-2">
                                  <strong>Как выполнить:</strong> {task.how_to}
                                </div>
                                <div className="text-caption-sm text-success bg-success/20 p-2 rounded">
                                  <strong>Измеримый результат:</strong> {task.measurable_result}
                                </div>
                              </div>
                              <button className="flex-shrink-0 p-1 text-success hover:text-success">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {item.tasks && item.tasks.length === 0 && (
                      <div className="p-3 text-center">
                        <p className="text-muted-foreground text-caption-sm">Задачи развития не найдены</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const totalTasks = tasks.skills.reduce((sum, skill) => sum + skill.tasks.length, 0) + 
                    tasks.qualities.reduce((sum, quality) => sum + quality.tasks.length, 0);

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-card">
      <h4 className="text-foreground text-body-base font-semibold mb-4">Задачи на развитие</h4>
      
      {/* Общая статистика */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg text-center">
          <div className="text-primary text-body-lg font-bold">
            {totalTasks}
          </div>
          <div className="text-muted-foreground text-caption-sm">Задач</div>
        </div>
        <div className="p-3 bg-warning/10 rounded-lg text-center">
          <div className="text-warning text-body-lg font-bold">
            {tasks.skills.length + tasks.qualities.length}
          </div>
          <div className="text-muted-foreground text-caption-sm">Компетенций</div>
        </div>
        <div className="p-3 bg-destructive/10 rounded-lg text-center">
          <div className="text-destructive text-body-lg font-bold">
            {profile.total_gap.toFixed(1)}
          </div>
          <div className="text-muted-foreground text-caption-sm">Общий GAP</div>
        </div>
      </div>

      {/* Список задач по категориям */}
      <div className="space-y-3">
        {renderCompetencyWithTasks(tasks.skills, 'Hard Skills', 'skills')}
        {renderCompetencyWithTasks(tasks.qualities, 'Soft Skills', 'qualities')}
      </div>
    </div>
  );
};