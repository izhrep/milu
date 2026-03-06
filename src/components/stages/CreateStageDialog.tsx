import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParentStages } from '@/hooks/useParentStages';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useMeetingStages } from '@/hooks/useMeetingStages';
import { useDiagnosticConfigTemplates } from '@/hooks/useDiagnosticConfigTemplates';
import { useAuth } from '@/contexts/AuthContext';

interface CreateStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateStageDialog: React.FC<CreateStageDialogProps> = ({ open, onOpenChange }) => {
  const { createStage: createParentStage } = useParentStages();
  const { createStage: createDiagnosticStage } = useDiagnosticStages();
  const { createStage: createMeetingStage } = useMeetingStages();
  const { templates, fetchTemplates } = useDiagnosticConfigTemplates();
  const { user } = useAuth();
  const [parentPeriod, setParentPeriod] = useState('');
  const [parentStartDate, setParentStartDate] = useState('');
  const [parentEndDate, setParentEndDate] = useState('');
  const [parentReminderDate, setParentReminderDate] = useState('');
  const [createDiagnostic, setCreateDiagnostic] = useState(false);
  const [createMeetings, setCreateMeetings] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Fetch approved templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  // Auto-select latest approved template
  const approvedTemplates = templates.filter(t => t.status === 'approved');
  useEffect(() => {
    if (approvedTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(approvedTemplates[0].id);
    }
  }, [approvedTemplates, selectedTemplateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }
    
    // Создаем родительский этап
    createParentStage({
      period: parentPeriod,
      start_date: parentStartDate,
      end_date: parentEndDate,
      reminder_date: parentReminderDate,
      is_active: true,
    }, {
      onSuccess: (parentStage) => {
        // Создаем подэтапы, если они выбраны
        if (createDiagnostic) {
          createDiagnosticStage({
            parent_id: parentStage.id,
            evaluation_period: null,
            ...(selectedTemplateId ? { config_template_id: selectedTemplateId } : {}),
          });
        }
        
        if (createMeetings) {
          createMeetingStage({
            parent_id: parentStage.id,
          });
        }
        
        // Сбрасываем форму и закрываем диалог
        setParentPeriod('');
        setParentStartDate('');
        setParentEndDate('');
        setParentReminderDate('');
        setCreateDiagnostic(false);
        setCreateMeetings(false);
        setSelectedTemplateId('');
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать новый этап</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period">Период</Label>
            <Input
              id="period"
              placeholder="Например: Q1 2025"
              value={parentPeriod}
              onChange={(e) => setParentPeriod(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Дата начала</Label>
              <Input
                id="start_date"
                type="date"
                value={parentStartDate}
                onChange={(e) => setParentStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Дата окончания</Label>
              <Input
                id="end_date"
                type="date"
                value={parentEndDate}
                onChange={(e) => setParentEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder_date">Дата напоминания</Label>
            <Input
              id="reminder_date"
              type="date"
              value={parentReminderDate}
              onChange={(e) => setParentReminderDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Подэтапы (опционально)</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="diagnostic"
                  checked={createDiagnostic}
                  onCheckedChange={(checked) => setCreateDiagnostic(checked as boolean)}
                />
                <Label htmlFor="diagnostic" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Создать подэтап "Диагностика"
                </Label>
              </div>

              {createDiagnostic && (
                <div className="ml-6 space-y-3 border-l pl-4">
                  <p className="text-xs text-muted-foreground">
                    Будут использованы даты и период родительского этапа
                  </p>
                  {approvedTemplates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Шаблон конфигурации</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите шаблон" />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedTemplates.map(tpl => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name} (v{tpl.version})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {approvedTemplates.length === 0 && (
                    <p className="text-xs text-destructive">
                      Нет утверждённых шаблонов. Будет использован legacy-режим.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="meetings"
                  checked={createMeetings}
                  onCheckedChange={(checked) => setCreateMeetings(checked as boolean)}
                />
                <Label htmlFor="meetings" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Создать подэтап "Встречи 1:1"
                </Label>
              </div>

              {createMeetings && (
                <div className="ml-6 space-y-3 border-l pl-4">
                  <p className="text-xs text-muted-foreground">
                    Будут использованы даты и период родительского этапа
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
