import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useOneOnOneMeetings, OneOnOneMeeting } from '@/hooks/useOneOnOneMeetings';
import { useMeetingDecisions } from '@/hooks/useMeetingDecisions';
import { useMeetingPrivateNotes } from '@/hooks/useMeetingPrivateNotes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Send, CheckCircle, X, Plus, Trash2, Info, Lock, Loader2, Link as LinkIcon, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MeetingArtifacts } from '@/components/MeetingArtifacts';
import { Meeting360AttachButton } from '@/components/Meeting360AttachButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const meetingSchema = z.object({
  goal_and_agenda: z.string().min(1, 'Обязательное поле'),
  energy_gained: z.string().optional(),
  energy_lost: z.string().optional(),
  previous_decisions_debrief: z.string().optional(),
  stoppers: z.string().optional(),
  ideas_and_suggestions: z.string().optional(),
  meeting_link: z.string().optional(),
  manager_comment: z.string().optional(),
  meeting_date: z.string().min(1, 'Укажите дату и время встречи'),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

interface MeetingFormProps {
  meetingId: string;
  isManager?: boolean;
  onClose?: () => void;
}

export const MeetingForm: React.FC<MeetingFormProps> = ({ meetingId, isManager: isManagerProp = false, onClose }) => {
  const [newDecision, setNewDecision] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const { user } = useAuth();

  const { data: meeting, isLoading: isMeetingLoading } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) throw error;
      return data as OneOnOneMeeting;
    },
  });

  // Auto-detect manager role from meeting data, fallback to prop
  const isManager = meeting ? (user?.id !== meeting.employee_id) : isManagerProp;

  // Detect historical mode: manager viewing a meeting they didn't conduct
  const isHistorical = isManager && !!meeting && meeting.manager_id !== user?.id;

  // Load original manager name for historical meetings
  const { data: originalManager } = useQuery({
    queryKey: ['user-name', meeting?.manager_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', meeting!.manager_id)
        .single();
      return data;
    },
    enabled: isHistorical && !!meeting?.manager_id,
  });

  const originalManagerName = originalManager
    ? [originalManager.last_name, originalManager.first_name].filter(Boolean).join(' ')
    : null;

  const { decisions, previousDecisions, addDecision, updateDecision, deleteDecision } = useMeetingDecisions(meetingId);
  const { updateMeeting, updateMeetingAsync, submitMeeting, approveMeeting, returnMeeting, reopenMeeting } = useOneOnOneMeetings();
  const { privateNote, setPrivateNote, isLoading: isPrivateNoteLoading, isSaving: isPrivateNoteSaving } = useMeetingPrivateNotes(meetingId);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    values: meeting ? {
      goal_and_agenda: meeting.goal_and_agenda || '',
      energy_gained: meeting.energy_gained || '',
      energy_lost: meeting.energy_lost || '',
      previous_decisions_debrief: meeting.previous_decisions_debrief || '',
      stoppers: meeting.stoppers || '',
      ideas_and_suggestions: meeting.ideas_and_suggestions || '',
      meeting_link: meeting.meeting_link || '',
      manager_comment: meeting.manager_comment || '',
      meeting_date: meeting.meeting_date || '',
    } : undefined,
  });

  const isStageLesstExpired = meeting && meeting.status === 'expired' && meeting.stage_id === null;

  // Manager who created the meeting and it's still in draft — they need to fill & hand over
  const isManagerCreatorDraft = isManager && meeting &&
    meeting.status === 'draft' && meeting.created_by && meeting.created_by !== meeting.employee_id && user?.id === meeting.created_by;

  // Employee-only fields are NEVER editable by manager/admin/hr
  // They are editable only by the employee in draft/returned statuses
  const canEditEmployeeFields = !isHistorical && !isManager && meeting && (
    meeting.status === 'draft' || meeting.status === 'returned' || isStageLesstExpired
  );

  // In historical mode, everything is read-only
  const canEdit = !isHistorical && meeting && (
    (!isManager && (meeting.status === 'draft' || meeting.status === 'returned' || isStageLesstExpired)) ||
    (isManager && (meeting.status === 'submitted' || isStageLesstExpired)) ||
    isManagerCreatorDraft
  );

  const canEditDecisions = !isHistorical && meeting && (
    (isManager && (meeting.status === 'submitted' || meeting.status === 'approved' || isStageLesstExpired || isManagerCreatorDraft)) ||
    (!isManager && (meeting.status === 'draft' || meeting.status === 'returned' || meeting.status === 'submitted' || isStageLesstExpired))
  );

  const canReopen = false;

  // Strip employee-only fields when manager saves
  const stripEmployeeFields = (data: MeetingFormData): Partial<MeetingFormData> => {
    if (!isManager) return data;
    const { energy_gained, energy_lost, previous_decisions_debrief, stoppers, ideas_and_suggestions, ...managerFields } = data;
    return managerFields;
  };

  const onSubmit = (data: MeetingFormData) => {
    if (!meeting) return;
    updateMeeting({ id: meeting.id, ...stripEmployeeFields(data) } as any);
  };

  const handleAddDecision = () => {
    if (!newDecision.trim()) return;
    addDecision({ meetingId, decisionText: newDecision });
    setNewDecision('');
  };

  const handleSubmitForApproval = handleSubmit(async (data) => {
    if (!meeting) return;
    await updateMeetingAsync({ id: meeting.id, ...stripEmployeeFields(data) } as any);
    submitMeeting(meetingId);
    onClose?.();
  });

  const handleApprove = () => {
    approveMeeting(meetingId);
    onClose?.();
  };

  const handleReturn = () => {
    if (!returnReason.trim()) {
      alert('Укажите причину возврата');
      return;
    }
    returnMeeting({ meetingId, reason: returnReason });
    onClose?.();
  };

  const handleReopen = () => {
    reopenMeeting(meetingId);
  };

  if (isMeetingLoading || !meeting) {
    return <div className="p-4 text-center">Загрузка...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Historical banner */}
      {isHistorical && (
        <Alert className="border-muted bg-muted/30">
          <History className="h-4 w-4" />
          <AlertDescription>
            Историческая встреча (провёл {originalManagerName ? `unit-лид ${originalManagerName}` : 'другой unit-лид'}). Только просмотр.
          </AlertDescription>
        </Alert>
      )}

      {/* Статус и даты */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={meeting.status === 'approved' ? 'default' : 'secondary'}>
            {meeting.status === 'draft' && (
              meeting.created_by && meeting.created_by !== meeting.employee_id
                ? 'Ожидает заполнения сотрудником'
                : 'Черновик'
            )}
            {meeting.status === 'submitted' && 'На утверждении'}
            {meeting.status === 'returned' && 'Возврат на доработку'}
            {meeting.status === 'approved' && 'Утверждено'}
            {meeting.status === 'expired' && 'Просрочено'}
          </Badge>
          {meeting.approved_at && (
            <span className="text-sm text-text-secondary">
              Утверждено: {new Date(meeting.approved_at).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canReopen && (
            <Button type="button" size="sm" variant="outline" onClick={handleReopen}>
              Возобновить
            </Button>
          )}
          {canEdit && (
            <Button type="submit" size="sm" variant="outline">
              Сохранить изменения
            </Button>
          )}
        </div>
      </div>

      {/* Возврат на доработку */}
      {meeting.status === 'returned' && meeting.return_reason && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2">
          <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <span className="text-sm font-medium">Комментарий unit-лида: </span>
            <span className="text-sm">{meeting.return_reason}</span>
          </div>
        </div>
      )}

      {/* Дата и время встречи */}
      <div className="space-y-2">
        <Label htmlFor="meeting_date">Дата и время встречи *</Label>
        <div className="flex gap-2">
          <Input
            id="meeting_date_date"
            type="date"
            className="bg-white dark:bg-background flex-1"
            value={watch('meeting_date')?.slice(0, 10) || ''}
            onChange={(e) => {
              const currentTime = watch('meeting_date')?.slice(11, 16) || '10:00';
              setValue('meeting_date', `${e.target.value}T${currentTime}`, { shouldDirty: true });
            }}
            disabled={!canEdit}
          />
          <Input
            id="meeting_date_time"
            type="time"
            className="bg-white dark:bg-background w-32"
            value={watch('meeting_date')?.slice(11, 16) || ''}
            onChange={(e) => {
              const currentDate = watch('meeting_date')?.slice(0, 10) || '';
              if (currentDate) {
                setValue('meeting_date', `${currentDate}T${e.target.value}`, { shouldDirty: true });
              }
            }}
            disabled={!canEdit}
          />
        </div>
        {errors.meeting_date && (
          <p className="text-sm text-destructive">{errors.meeting_date.message}</p>
        )}
      </div>

      {/* Ссылка на видеовстречу */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="meeting_link" className="text-xs text-muted-foreground font-normal">Ссылка на видеовстречу</Label>
        </div>
        {canEdit ? (
          <Input
            id="meeting_link"
            type="url"
            {...register('meeting_link')}
            placeholder="https://meet.google.com/..."
            className="h-8 text-sm"
          />
        ) : watch('meeting_link') ? (
          <a
            href={watch('meeting_link')!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline truncate max-w-full"
          >
            {watch('meeting_link')}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      <Separator />

      {/* Цель и повестка — manager-editable field */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="goal_and_agenda">Цель + Повестка встречи *</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-text-secondary" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Опишите цель встречи и основные темы для обсуждения</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ExpandableTextarea
          id="goal_and_agenda"
          className="bg-white dark:bg-background"
          {...register('goal_and_agenda')}
          value={watch('goal_and_agenda') || ''}
          disabled={!canEdit}
          placeholder="Что хотите обсудить на встрече?"
          maxCollapsedRows={4}
        />
        {errors.goal_and_agenda && (
          <p className="text-sm text-destructive">{errors.goal_and_agenda.message}</p>
        )}
      </div>

      {/* Employee self-report section */}
      {isManagerCreatorDraft && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
          <Alert className="border-amber-300 dark:border-amber-700 bg-amber-100/60 dark:bg-amber-900/30">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
              Поля ниже заполняет сотрудник. Они недоступны для редактирования unit-лидом.
            </AlertDescription>
          </Alert>

          {/* Энергия */}
          <div className="grid md:grid-cols-2 gap-4 opacity-60">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="energy_gained">Где получил энергию</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-text-secondary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Опишите действия или события, которые дали вам ресурс</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExpandableTextarea
                id="energy_gained"
                className="bg-white dark:bg-background"
                {...register('energy_gained')}
                value={watch('energy_gained') || ''}
                disabled
                placeholder="Что вас вдохновило?"
                maxCollapsedRows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="energy_lost">Где потерял энергию</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-text-secondary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Опишите факторы, которые забрали силы</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExpandableTextarea
                id="energy_lost"
                className="bg-white dark:bg-background"
                {...register('energy_lost')}
                value={watch('energy_lost') || ''}
                disabled
                placeholder="Что отнимало энергию?"
                maxCollapsedRows={3}
              />
            </div>
          </div>

          {/* Прошлые решения */}
          {previousDecisions && previousDecisions.length > 0 && (
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="text-sm">Прошлые решения</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {previousDecisions.map((decision) => (
                  <div key={decision.id} className="flex items-start gap-2 p-2 bg-muted rounded">
                    <Checkbox
                      checked={decision.is_completed}
                      disabled
                    />
                    <span className={`text-sm flex-1 ${decision.is_completed ? 'line-through text-text-secondary' : ''}`}>
                      {decision.decision_text}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Дебриф */}
          <div className="space-y-2 opacity-60">
            <Label htmlFor="previous_decisions_debrief">Дебриф по прошлым решениям</Label>
            <ExpandableTextarea
              id="previous_decisions_debrief"
              className="bg-white dark:bg-background"
              {...register('previous_decisions_debrief')}
              value={watch('previous_decisions_debrief') || ''}
              disabled
              placeholder="Что удалось выполнить? Что не получилось и почему?"
              maxCollapsedRows={3}
            />
          </div>

          {/* Проблемы/барьеры */}
          <div className="space-y-2 opacity-60">
            <div className="flex items-center gap-2">
              <Label htmlFor="stoppers">Текущие проблемы/барьеры</Label>
            </div>
            <ExpandableTextarea
              id="stoppers"
              className="bg-white dark:bg-background"
              {...register('stoppers')}
              value={watch('stoppers') || ''}
              disabled
              placeholder="Какие препятствия возникли?"
              maxCollapsedRows={3}
            />
          </div>

          {/* Идеи */}
          <div className="space-y-2 opacity-60">
            <div className="flex items-center gap-2">
              <Label htmlFor="ideas_and_suggestions">Идеи и предложения</Label>
            </div>
            <ExpandableTextarea
              id="ideas_and_suggestions"
              className="bg-white dark:bg-background"
              {...register('ideas_and_suggestions')}
              value={watch('ideas_and_suggestions') || ''}
              disabled
              placeholder="Ваши идеи и предложения..."
              maxCollapsedRows={3}
            />
          </div>
        </div>
      )}

      {/* Normal employee fields when NOT manager-creator draft */}
      {!isManagerCreatorDraft && (
        <>
          {/* Энергия */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="energy_gained">Где получил энергию</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-text-secondary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Опишите действия или события, которые дали вам ресурс</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExpandableTextarea
                id="energy_gained"
                className="bg-white dark:bg-background"
                {...register('energy_gained')}
                value={watch('energy_gained') || ''}
                disabled={!canEditEmployeeFields}
                placeholder="Что вас вдохновило?"
                maxCollapsedRows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="energy_lost">Где потерял энергию</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-text-secondary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Опишите факторы, которые забрали силы</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExpandableTextarea
                id="energy_lost"
                className="bg-white dark:bg-background"
                {...register('energy_lost')}
                value={watch('energy_lost') || ''}
                disabled={!canEditEmployeeFields}
                placeholder="Что отнимало энергию?"
                maxCollapsedRows={3}
              />
            </div>
          </div>

          {/* Прошлые решения */}
          {previousDecisions && previousDecisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Прошлые решения</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {previousDecisions.map((decision) => (
                  <div key={decision.id} className="flex items-start gap-2 p-2 bg-muted rounded">
                    <Checkbox
                      checked={decision.is_completed}
                      onCheckedChange={(checked) =>
                        updateDecision({ id: decision.id, is_completed: !!checked })
                      }
                      disabled={isHistorical || isManager}
                    />
                    <span className={`text-sm flex-1 ${decision.is_completed ? 'line-through text-text-secondary' : ''}`}>
                      {decision.decision_text}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Дебриф по прошлым решениям */}
          <div className="space-y-2">
            <Label htmlFor="previous_decisions_debrief">Дебриф по прошлым решениям</Label>
            <ExpandableTextarea
              id="previous_decisions_debrief"
              className="bg-white dark:bg-background"
              {...register('previous_decisions_debrief')}
              value={watch('previous_decisions_debrief') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Что удалось выполнить? Что не получилось и почему?"
              maxCollapsedRows={3}
            />
          </div>

          {/* Текущие проблемы/барьеры */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="stoppers">Текущие проблемы/барьеры</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-text-secondary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Опишите риски и препятствия на пути реализации решений</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ExpandableTextarea
              id="stoppers"
              className="bg-white dark:bg-background"
              {...register('stoppers')}
              value={watch('stoppers') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Какие препятствия возникли?"
              maxCollapsedRows={3}
            />
          </div>

          {/* Идеи и предложения */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="ideas_and_suggestions">Идеи и предложения</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-text-secondary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Опишите ваши идеи и предложения для обсуждения</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ExpandableTextarea
              id="ideas_and_suggestions"
              className="bg-white dark:bg-background"
              {...register('ideas_and_suggestions')}
              value={watch('ideas_and_suggestions') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Ваши идеи и предложения..."
              maxCollapsedRows={3}
            />
          </div>
        </>
      )}

      <Separator />

      {/* Решения после встречи */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Решения после встречи</Label>
        </div>

        {decisions && decisions.length > 0 && (
          <div className="space-y-2">
            {decisions.map((decision) => (
              <Card key={decision.id}>
                <CardContent className="pt-4 flex items-start justify-between gap-2">
                  <p className="flex-1">{decision.decision_text}</p>
                  {canEditDecisions && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDecision(decision.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {canEditDecisions && (
          <div className="flex gap-2">
            <Input
              value={newDecision}
              onChange={(e) => setNewDecision(e.target.value)}
              placeholder="Введите решение..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDecision();
                }
              }}
            />
            <Button type="button" onClick={handleAddDecision} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Материалы встречи */}
      {meeting && (
        <MeetingArtifacts
          meetingId={meetingId}
          meeting={meeting}
          isManager={isHistorical ? false : isManager}
        />
      )}

      {/* Данные ОС 360 */}
      {meeting && (
        <Meeting360AttachButton
          meetingId={meetingId}
          employeeId={meeting.employee_id}
          meetingStatus={meeting.status}
          isManager={isManager}
          isHistorical={isHistorical}
        />
      )}

      {/* Комментарий unit-лида */}
      {isManager && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="manager_comment">Комментарий unit-лида</Label>
            <ExpandableTextarea
              id="manager_comment"
              {...register('manager_comment')}
              value={watch('manager_comment') || ''}
              disabled={isHistorical || !(meeting.status === 'submitted' || isStageLesstExpired)}
              placeholder="Ваш комментарий после встречи..."
              maxCollapsedRows={4}
            />
          </div>
        </>
      )}

      {/* Приватные заметки unit-лида — hidden for historical */}
      {isManager && !isHistorical && (
        <>
          <Separator />
          <Card className="border-muted bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Приватные заметки
                {isPrivateNoteSaving && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Эти заметки видите только вы. Сотрудник их не увидит.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isPrivateNoteLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  placeholder="Ваши личные заметки о встрече (видны только вам)..."
                  rows={4}
                  className="bg-background"
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Действия — hidden for historical */}
      {!isHistorical && (() => {
        const isCreatorNotEmployee = meeting.created_by && meeting.created_by !== meeting.employee_id;
        const isCurrentUserEmployee = user?.id === meeting.employee_id;
        return (
        <div className="flex justify-between gap-2 pt-4">
          {/* Employee in draft or stage-less expired: submit for approval */}
          {!isManager && (meeting.status === 'draft' || isStageLesstExpired) && (
            <Button type="button" onClick={handleSubmitForApproval} className="gap-2">
              <Send className="h-4 w-4" />
              Отправить на утверждение
            </Button>
          )}

          {!isManager && meeting.status === 'returned' && (
            <Button type="button" onClick={handleSubmitForApproval} className="gap-2">
              <Send className="h-4 w-4" />
              Повторно отправить
            </Button>
          )}

          {isManager && !isManagerCreatorDraft && (meeting.status === 'submitted' || isStageLesstExpired) && (
            <div className="flex gap-2 w-full">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    Вернуть на доработку
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Вернуть на доработку</AlertDialogTitle>
                    <AlertDialogDescription>
                      Укажите причину возврата
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Причина возврата..."
                    rows={3}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReturn}>
                      Вернуть
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button onClick={handleApprove} className="flex-1 gap-2">
                <CheckCircle className="h-4 w-4" />
                Утвердить
              </Button>
            </div>
          )}
        </div>
        );
      })()}
    </form>
  );
};
