import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DevelopmentPlanCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackName: string;
  stepName: string;
  trackId?: string;
  stepId?: string;
  skills: Array<{ name: string; current_level: number; target_level: number; id: string }>;
  qualities: Array<{ name: string; current_level: number; target_level: number; id: string }>;
  onPlanCreated: () => void;
}

interface GeneratedTask {
  title: string;
  goal: string;
  how_to: string;
  measurable_result: string;
  priority: 'low' | 'medium' | 'high';
  competency_type: 'skill' | 'quality';
  competency_name: string;
}

export const DevelopmentPlanCreator: React.FC<DevelopmentPlanCreatorProps> = ({
  open,
  onOpenChange,
  trackName,
  stepName,
  trackId,
  stepId,
  skills,
  qualities,
  onPlanCreated,
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-development-tasks', {
        body: {
          skills,
          qualities,
          trackName,
          stepName,
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes('лимит')) {
          toast.error(data.error);
        } else if (data.error.includes('баланс')) {
          toast.error(data.error);
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setGeneratedTasks(data.tasks || []);
      setSelectedTasks(new Set(data.tasks.map((_: any, i: number) => i)));
      toast.success('Задачи успешно сгенерированы!');
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast.error('Ошибка при генерации задач');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTasks = async () => {
    if (!currentUser || selectedTasks.size === 0) return;

    setLoading(true);
    try {
      // Get authenticated user ID
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Пользователь не авторизован');

      // Map priority from generator to database values
      const mapPriority = (generatorPriority: string): string => {
        if (generatorPriority === 'high') return 'urgent';
        return 'normal'; // low и medium -> normal
      };

      // Prepare development plan tasks and regular tasks
      const developmentPlanTasks = [];
      const regularTasks = [];

      for (const index of Array.from(selectedTasks)) {
        const task = generatedTasks[index];
        const isSkill = task.competency_type === 'skill';
        const competency = isSkill
          ? skills.find(s => s.name === task.competency_name)
          : qualities.find(q => q.name === task.competency_name);

        const mappedPriority = mapPriority(task.priority);

        // Create regular task
        const regularTask = {
          user_id: user.id,
          title: task.title,
          description: `**Цель:** ${task.goal}\n\n**Как выполнить:** ${task.how_to}\n\n**Измеримый результат:** ${task.measurable_result}`,
          status: 'pending',
          priority: mappedPriority,
          category: 'Развитие',
          task_type: 'development',
          competency_ref: competency?.id,
        };
        regularTasks.push(regularTask);

        // Prepare development plan task (will link after tasks are created)
        developmentPlanTasks.push({
          user_id: user.id,
          title: task.title,
          priority: task.priority,
          goal: task.goal,
          how_to: task.how_to,
          measurable_result: task.measurable_result,
          hard_skill_id: isSkill ? competency?.id : null,
          soft_skill_id: !isSkill ? competency?.id : null,
          career_track_id: trackId || null,
          career_track_step_id: stepId || null,
        });
      }

      // Insert regular tasks first
      const { data: insertedTasks, error: tasksError } = await supabase
        .from('tasks')
        .insert(regularTasks)
        .select('id');

      if (tasksError) throw tasksError;

      // Link development plan tasks with created tasks
      const developmentPlanTasksWithLinks = developmentPlanTasks.map((dpt, index) => ({
        ...dpt,
        task_id: insertedTasks?.[index]?.id || null,
      }));

      // Insert development plan tasks
      const { error: devPlanError } = await supabase
        .from('development_plan_tasks')
        .insert(developmentPlanTasksWithLinks);

      if (devPlanError) throw devPlanError;

      toast.success(`Сохранено задач: ${regularTasks.length}`);
      onPlanCreated();
      onOpenChange(false);
      setGeneratedTasks([]);
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error saving tasks:', error);
      toast.error('Ошибка при сохранении задач');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Создание плана развития
          </DialogTitle>
          <DialogDescription>
            Трек: {trackName} → {stepName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {generatedTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary mb-4">
                Нажмите кнопку для генерации задач развития с помощью ИИ
              </p>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Генерация задач...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Сгенерировать задачи
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {generatedTasks.map((task, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedTasks.has(index)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleTask(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {selectedTasks.has(index) ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <XCircle className="w-5 h-5 text-text-tertiary" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-text-primary">{task.title}</h4>
                          <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityText(task.priority)}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          <p className="text-text-secondary">
                            <span className="font-medium">Цель:</span> {task.goal}
                          </p>
                          <p className="text-text-secondary">
                            <span className="font-medium">Как выполнить:</span> {task.how_to}
                          </p>
                          <p className="text-text-secondary">
                            <span className="font-medium">Результат:</span> {task.measurable_result}
                          </p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-surface-secondary rounded">
                            {task.competency_type === 'skill' ? 'Hard Skill' : 'Soft Skill'}: {task.competency_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => handleGenerate()} disabled={loading}>
                  Перегенерировать
                </Button>
                <Button
                  onClick={handleSaveTasks}
                  disabled={loading || selectedTasks.size === 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    `Сохранить (${selectedTasks.size})`
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
