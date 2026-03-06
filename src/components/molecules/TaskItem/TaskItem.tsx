import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/Button/Button';
import { Text } from '@/components/atoms/Text/Text';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { Task, TaskPriority } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const priorityConfig = {
  low: { color: 'text-text-secondary', icon: Clock },
  medium: { color: 'text-brand-orange', icon: Clock },
  high: { color: 'text-warning', icon: AlertCircle },
  urgent: { color: 'text-error', icon: AlertCircle }
};

const TaskItem = React.forwardRef<HTMLDivElement, TaskItemProps>(
  ({ task, onToggle, onEdit, onDelete, className }, ref) => {
    const PriorityIcon = priorityConfig[task.priority].icon;
    
    const formatDueDate = (date: Date) => {
      const now = new Date();
      const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'Просрочено';
      if (diffDays === 0) return 'Сегодня';
      if (diffDays === 1) return 'Завтра';
      if (diffDays <= 7) return `Через ${diffDays} дн.`;
      
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      });
    };

    const getDueBadgeVariant = (dueDate: Date) => {
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'error';
      if (diffDays === 0) return 'warning';
      if (diffDays <= 3) return 'warning';
      return 'secondary';
    };

    return (
      <div
        ref={ref}
        className={cn(
          'group relative p-4 rounded-lg border border-border bg-surface hover:shadow-sm transition-all',
          task.completed && 'opacity-60',
          className
        )}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <Button
            size="icon-sm"
            variant={task.completed ? 'success' : 'secondary'}
            className={cn(
              'shrink-0 mt-1',
              !task.completed && 'border-border'
            )}
            onClick={() => onToggle(task.id)}
            aria-label={task.completed ? 'Отметить как невыполненное' : 'Отметить как выполненное'}
          >
            {task.completed ? (
              <Check className="h-3 w-3" />
            ) : (
              <div className="h-3 w-3" />
            )}
          </Button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Text
                variant="h6"
                className={cn(
                  'flex-1 transition-all',
                  task.completed && 'line-through text-text-secondary'
                )}
              >
                {task.title}
              </Text>
              
              {/* Priority indicator */}
              <div className="flex items-center gap-1 shrink-0">
                <PriorityIcon 
                  className={cn(
                    'h-4 w-4',
                    priorityConfig[task.priority].color
                  )} 
                />
              </div>
            </div>

            <Text
              variant="body-sm"
              color="secondary"
              className={cn(
                'mb-3 leading-relaxed',
                task.completed && 'text-text-tertiary'
              )}
            >
              {task.description}
            </Text>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Due date badge */}
                {task.dueDate && (
                  <Badge
                    variant={getDueBadgeVariant(task.dueDate)}
                    size="sm"
                    icon={<Clock className="h-3 w-3" />}
                  >
                    {formatDueDate(task.dueDate)}
                  </Badge>
                )}

                {/* Category badge */}
                <Badge variant="outline" size="sm">
                  {task.category === 'training' && 'Обучение'}
                  {task.category === 'assessment' && 'Оценка'}
                  {task.category === 'project' && 'Проект'}
                  {task.category === 'administrative' && 'Админ.'}
                  {task.category === 'development' && 'Развитие'}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onEdit(task)}
                    aria-label="Редактировать задачу"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                )}
                
                {onDelete && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onDelete(task.id)}
                    aria-label="Удалить задачу"
                    className="text-error hover:text-error hover:bg-error/10"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TaskItem.displayName = 'TaskItem';

export { TaskItem };