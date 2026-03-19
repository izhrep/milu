import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, CheckCircle2, Users, Pencil } from 'lucide-react';
import { CreateStageDialog } from '@/components/stages/CreateStageDialog';
import { AddSubStageDialog } from '@/components/stages/AddSubStageDialog';
import { AddParticipantsDialog } from '@/components/stages/AddParticipantsDialog';
import { EditStageDialog } from '@/components/stages/EditStageDialog';
import { useParentStages, ParentStage } from '@/hooks/useParentStages';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useMeetingStages } from '@/hooks/useMeetingStages';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export const UnifiedStagesManager = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<ParentStage | null>(null);
  const [participantsDialogStage, setParticipantsDialogStage] = useState<{
    parentId: string;
    diagnosticId?: string;
    meetingId?: string;
  } | null>(null);
  const { stages, isLoading } = useParentStages();
  const { stages: diagnosticStages } = useDiagnosticStages();
  const { stages: meetingStages } = useMeetingStages();

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  const activeStages = stages?.filter(s => s.is_active) || [];
  const completedStages = stages?.filter(s => !s.is_active) || [];

  const getSubStages = (parentId: string) => {
    const diagnostic = diagnosticStages?.find(d => d.parent_id === parentId);
    const meeting = meetingStages?.find(m => m.parent_id === parentId);
    return { diagnostic, meeting };
  };

  const renderStageCard = (stage: ParentStage) => {
    const subStages = getSubStages(stage.id);
    const hasSubStages = subStages.diagnostic || subStages.meeting;
    
    return (
      <Card key={stage.id}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {stage.period}
                <Badge variant={stage.is_active ? "default" : "secondary"}>
                  {stage.is_active ? 'Активен' : 'Завершен'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {format(new Date(stage.start_date), 'dd MMMM yyyy', { locale: ru })} -{' '}
                {format(new Date(stage.end_date), 'dd MMMM yyyy', { locale: ru })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {stage.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingStage(stage)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Редактировать
                </Button>
              )}
              {hasSubStages && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setParticipantsDialogStage({
                    parentId: stage.id,
                    diagnosticId: subStages.diagnostic?.id,
                    meetingId: subStages.meeting?.id,
                  })}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Участники
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedParentId(stage.id)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить подэтап
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Напоминание: {format(new Date(stage.reminder_date), 'dd MMMM yyyy', { locale: ru })}
            </div>
            
            {(subStages.diagnostic || subStages.meeting) && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Подэтапы:</p>
                <div className="flex flex-col gap-2">
                  {subStages.diagnostic && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Диагностика
                      </Badge>
                      <Badge variant={subStages.diagnostic.is_active ? "default" : "secondary"} className="text-xs">
                        {subStages.diagnostic.is_active ? subStages.diagnostic.status || 'Активен' : 'Завершен'}
                      </Badge>
                    </div>
                  )}
                  {subStages.meeting && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        Встречи one-to-one
                      </Badge>
                      <Badge variant={stage.is_active ? "default" : "secondary"} className="text-xs">
                        {stage.is_active ? 'Активен' : 'Завершен'}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Управление этапами</h2>
          <p className="text-muted-foreground">
            Создание и управление этапами диагностики и встреч one-to-one
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Создать этап
        </Button>
      </div>

      {activeStages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Активные этапы</h3>
          <div className="grid gap-4">
            {activeStages.map(renderStageCard)}
          </div>
        </div>
      )}

      {completedStages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Завершенные этапы</h3>
          <div className="grid gap-4">
            {completedStages.map(renderStageCard)}
          </div>
        </div>
      )}

      {stages?.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Нет созданных этапов</p>
          </CardContent>
        </Card>
      )}

      <CreateStageDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      
      <AddSubStageDialog
        open={!!selectedParentId}
        onOpenChange={(open) => !open && setSelectedParentId(null)}
        parentStageId={selectedParentId || ''}
        hasDiagnostic={!!selectedParentId && !!getSubStages(selectedParentId).diagnostic}
        hasMeetings={!!selectedParentId && !!getSubStages(selectedParentId).meeting}
      />
      
      <AddParticipantsDialog
        open={!!participantsDialogStage}
        onOpenChange={(open) => !open && setParticipantsDialogStage(null)}
        parentStageId={participantsDialogStage?.parentId || ''}
        diagnosticStageId={participantsDialogStage?.diagnosticId}
        meetingStageId={participantsDialogStage?.meetingId}
      />

      <EditStageDialog
        open={!!editingStage}
        onOpenChange={(open) => !open && setEditingStage(null)}
        stage={editingStage}
      />
    </div>
  );
};
