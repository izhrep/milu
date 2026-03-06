import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useParentStages, ParentStage } from '@/hooks/useParentStages';
import { useToast } from '@/hooks/use-toast';

interface EditStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: ParentStage | null;
}

export const EditStageDialog = ({ open, onOpenChange, stage }: EditStageDialogProps) => {
  const { updateStage } = useParentStages();
  const { toast } = useToast();
  
  const [period, setPeriod] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reminderDate, setReminderDate] = useState<Date | undefined>();

  useEffect(() => {
    if (stage) {
      setPeriod(stage.period);
      setStartDate(new Date(stage.start_date));
      setEndDate(new Date(stage.end_date));
      setReminderDate(new Date(stage.reminder_date));
    }
  }, [stage]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSubmit = () => {
    if (!stage) return;
    
    if (!period.trim()) {
      toast({ title: 'Ошибка', description: 'Укажите название периода', variant: 'destructive' });
      return;
    }
    if (!startDate || !endDate || !reminderDate) {
      toast({ title: 'Ошибка', description: 'Заполните все даты', variant: 'destructive' });
      return;
    }
    if (startDate >= endDate) {
      toast({ title: 'Ошибка', description: 'Дата начала должна быть меньше даты окончания', variant: 'destructive' });
      return;
    }

    updateStage({
      id: stage.id,
      period: period.trim(),
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      reminder_date: format(reminderDate, 'yyyy-MM-dd'),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактирование этапа</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="period">Название периода</Label>
            <Input
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Например: Q1 2025"
            />
          </div>

          <div className="grid gap-2">
            <Label>Дата начала</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  disabled={(date) => date < today}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Дата окончания</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => date < today || (startDate && date <= startDate)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Дата напоминания</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !reminderDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reminderDate ? format(reminderDate, 'dd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reminderDate}
                  onSelect={setReminderDate}
                  disabled={(date) => date < today}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
