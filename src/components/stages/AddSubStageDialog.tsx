import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useMeetingStages } from '@/hooks/useMeetingStages';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AddSubStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentStageId: string;
  hasDiagnostic?: boolean;
  hasMeetings?: boolean;
}

export const AddSubStageDialog = ({ open, onOpenChange, parentStageId, hasDiagnostic, hasMeetings }: AddSubStageDialogProps) => {
  const [createDiagnostic, setCreateDiagnostic] = useState(false);
  const [createMeetings, setCreateMeetings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { createStage: createDiagnosticStage } = useDiagnosticStages();
  const { createStage: createMeetingStage } = useMeetingStages();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: 'Ошибка',
        description: 'Необходима авторизация',
        variant: 'destructive',
      });
      return;
    }

    if (!createDiagnostic && !createMeetings) {
      toast({
        title: 'Ошибка',
        description: 'Выберите хотя бы один тип подэтапа',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (createDiagnostic) {
        await createDiagnosticStage({
          parent_id: parentStageId,
        });
      }

      if (createMeetings) {
        await createMeetingStage({
          parent_id: parentStageId,
        });
      }

      toast({
        title: 'Успех',
        description: 'Подэтапы успешно созданы',
      });
      onOpenChange(false);
      setCreateDiagnostic(false);
      setCreateMeetings(false);
    } catch (error) {
      console.error('Error creating sub-stages:', error);
      toast({
        title: 'Ошибка',
        description: 'Ошибка при создании подэтапов',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить подэтапы</DialogTitle>
        </DialogHeader>
        <DialogHeader>
          <DialogTitle>Добавить подэтапы</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {!hasDiagnostic && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="diagnostic"
                  checked={createDiagnostic}
                  onCheckedChange={(checked) => setCreateDiagnostic(checked as boolean)}
                />
                <Label htmlFor="diagnostic" className="cursor-pointer">
                  Создать этап диагностики
                </Label>
              </div>
            )}

            {!hasMeetings && import.meta.env.VITE_MEETINGS_STAGE_UI_ENABLED === 'true' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="meetings"
                  checked={createMeetings}
                  onCheckedChange={(checked) => setCreateMeetings(checked as boolean)}
                />
                <Label htmlFor="meetings" className="cursor-pointer">
                  Создать этап встреч one-to-one
                </Label>
              </div>
            )}

            {hasDiagnostic && hasMeetings && (
              <p className="text-sm text-muted-foreground">
                Все подэтапы уже созданы для этого этапа
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
