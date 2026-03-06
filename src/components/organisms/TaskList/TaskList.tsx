import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/molecules/Card/Card';
import { TaskItem } from '@/components/molecules/TaskItem/TaskItem';
import { Button } from '@/components/atoms/Button/Button';
import { Text, Heading } from '@/components/atoms/Text/Text';
import { Plus, MoreHorizontal, Filter, Search } from 'lucide-react';
import { Task } from '@/types';
import { mockTasks } from '@/lib/api';

interface TaskListProps {
  tasks?: Task[];
  onTaskToggle?: (id: string) => void;
  onTaskCreate?: () => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (id: string) => void;
  className?: string;
}

const TaskList = React.forwardRef<HTMLDivElement, TaskListProps>(
  ({ 
    tasks = mockTasks, 
    onTaskToggle,
    onTaskCreate,
    onTaskEdit,
    onTaskDelete,
    className 
  }, ref) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const handleTaskToggle = (id: string) => {
      onTaskToggle?.(id);
      // Optimistic update would be handled by parent component
    };

    const filteredTasks = tasks.filter(task => {
      const matchesFilter = 
        filter === 'all' ||
        (filter === 'pending' && !task.completed) ||
        (filter === 'completed' && task.completed);
      
      const matchesSearch = 
        searchQuery === '' ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });

    const pendingCount = tasks.filter(t => !t.completed).length;
    const completedCount = tasks.filter(t => t.completed).length;

    return (
      <Card ref={ref} className={cn('w-full', className)} variant="elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heading level={4} className="font-medium">
                Мои задачи
              </Heading>
              {pendingCount > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-xs text-white font-medium">
                  {pendingCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {onTaskCreate && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={onTaskCreate}
                  aria-label="Создать задачу"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Дополнительные действия"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="space-y-3 pt-2">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 bg-surface-secondary rounded-lg">
              {[
                { key: 'all', label: 'Все', count: tasks.length },
                { key: 'pending', label: 'Активные', count: pendingCount },
                { key: 'completed', label: 'Выполненные', count: completedCount }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all',
                    filter === key
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-text-secondary hover:text-foreground hover:bg-surface/50'
                  )}
                >
                  {label} {count > 0 && `(${count})`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Поиск задач..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-surface-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <TaskItem
                    task={task}
                    onToggle={handleTaskToggle}
                    onEdit={onTaskEdit}
                    onDelete={onTaskDelete}
                  />
                  {index < filteredTasks.length - 1 && (
                    <div className="h-px bg-border opacity-50" />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-secondary flex items-center justify-center">
                <Search className="h-6 w-6 text-text-secondary" />
              </div>
              <Text variant="body-sm" color="secondary">
                {searchQuery 
                  ? 'Задачи не найдены' 
                  : filter === 'completed' 
                    ? 'Нет выполненных задач'
                    : 'Нет активных задач'
                }
              </Text>
              {filter === 'pending' && onTaskCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onTaskCreate}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Создать задачу
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

TaskList.displayName = 'TaskList';

export { TaskList };