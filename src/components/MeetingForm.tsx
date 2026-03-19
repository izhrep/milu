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
import { useOneOnOneMeetings, OneOnOneMeeting } from '@/hooks/useOneOnOneMeetings';
import { useMeetingDecisions } from '@/hooks/useMeetingDecisions';
import { useMeetingPrivateNotes } from '@/hooks/useMeetingPrivateNotes';
import { useMeetingManagerFields } from '@/hooks/useMeetingManagerFields';
import { useMeetingTasks } from '@/hooks/useMeetingTasks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Info, Lock, Loader2, Link as LinkIcon, History, Save, User, Briefcase, ListChecks, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MeetingArtifacts } from '@/components/MeetingArtifacts';
import { Meeting360AttachButton } from '@/components/Meeting360AttachButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const meetingSchema = z.object({
  meeting_link: z.string().optional(),
  meeting_date: z.string().min(1, 'Укажите дату и время встречи'),
  emp_mood: z.string().optional(),
  emp_successes: z.string().optional(),
  emp_problems: z.string().optional(),
  emp_news: z.string().optional(),
  emp_questions: z.string().optional(),
  meeting_summary: z.string().optional(),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

interface MeetingFormProps {
  meetingId: string;
  isManager?: boolean;
  onClose?: () => void;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'scheduled': return 'Запланирована';
    case 'awaiting_summary': return 'Ожидает итогов';
    case 'recorded': return 'Зафиксирована';
    default: return status;
  }
};

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'recorded': return 'default';
    case 'awaiting_summary': return 'destructive';
    default: return 'secondary';
  }
};

export const MeetingForm: React.FC<MeetingFormProps> = ({ meetingId, isManager: isManagerProp = false, onClose }) => {
  const [newDecision, setNewDecision] = useState('');
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

  const isManager = meeting ? (user?.id !== meeting.employee_id) : isManagerProp;
  const isHistorical = isManager && !!meeting && meeting.manager_id !== user?.id;

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
  const { updateMeeting, saveSummary } = useOneOnOneMeetings();
  const { privateNote, setPrivateNote, isLoading: isPrivateNoteLoading, isSaving: isPrivateNoteSaving } = useMeetingPrivateNotes(meetingId);
  const { managerFields, upsertManagerFields, isUpsertingManagerFields } = useMeetingManagerFields(meetingId);
  const { acknowledgeMeetingReview } = useMeetingTasks();

  const [mgrPraise, setMgrPraise] = useState('');
  const [mgrDevComment, setMgrDevComment] = useState('');
  const [mgrNews, setMgrNews] = useState('');

  React.useEffect(() => {
    if (managerFields) {
      setMgrPraise(managerFields.mgr_praise || '');
      setMgrDevComment(managerFields.mgr_development_comment || '');
      setMgrNews(managerFields.mgr_news || '');
    }
  }, [managerFields]);

  React.useEffect(() => {
    if (meetingId && user) {
      acknowledgeMeetingReview(meetingId);
    }
  }, [meetingId, user]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    values: meeting ? {
      meeting_link: meeting.meeting_link || '',
      meeting_date: meeting.meeting_date || '',
      emp_mood: meeting.emp_mood || '',
      emp_successes: meeting.emp_successes || '',
      emp_problems: meeting.emp_problems || '',
      emp_news: meeting.emp_news || '',
      emp_questions: meeting.emp_questions || '',
      meeting_summary: meeting.meeting_summary || '',
    } : undefined,
  });

  // Permissions
  const canEditEmployeeFields = !isHistorical && !isManager && !!meeting && meeting.status !== 'recorded';
  const canEditManagerFields = !isHistorical && isManager && !!meeting && meeting.manager_id === user?.id;
  const canEditSharedFields = !isHistorical && !!meeting && meeting.status !== 'recorded';
  const canEditDecisions = !isHistorical && !!meeting;
  const canEditSummary = !isHistorical && !!meeting;

  const onSubmit = (data: MeetingFormData) => {
    if (!meeting) return;
    const { meeting_summary, emp_mood, emp_successes, emp_problems, emp_news, emp_questions, ...sharedFields } = data;
    if (isManager) {
      // Manager can only save shared fields (date, link)
      updateMeeting({ id: meeting.id, ...sharedFields } as any);
    } else {
      // Employee saves shared + employee fields
      const { meeting_summary: _, ...fields } = data;
      updateMeeting({ id: meeting.id, ...fields } as any);
    }
  };

  const handleSaveSummary = () => {
    if (!meeting) return;
    const summaryText = watch('meeting_summary') || '';
    saveSummary({ meetingId: meeting.id, summary: summaryText });
  };

  const handleSaveManagerBlock = () => {
    if (!meeting) return;
    upsertManagerFields({
      meeting_id: meeting.id,
      mgr_praise: mgrPraise,
      mgr_development_comment: mgrDevComment,
      mgr_news: mgrNews,
    });
  };

  const handleAddDecision = () => {
    if (!newDecision.trim()) return;
    addDecision({ meetingId, decisionText: newDecision });
    setNewDecision('');
  };

  if (isMeetingLoading || !meeting) {
    return <div className="p-4 text-center text-muted-foreground">Загрузка...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Historical banner */}
      {isHistorical && (
        <Alert className="border-muted bg-muted/30">
          <History className="h-4 w-4" />
          <AlertDescription>
            Историческая встреча (провёл {originalManagerName ? `${originalManagerName}` : 'другой руководитель'}). Только просмотр.
          </AlertDescription>
        </Alert>
      )}

      {/* Header: status + date + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(meeting.status)}>
            {getStatusLabel(meeting.status)}
          </Badge>
          {meeting.meeting_date && (
            <span className="text-sm text-muted-foreground">
              {new Date(meeting.meeting_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {canEditSharedFields && (
          <Button type="submit" size="sm" variant="outline">
            Сохранить
          </Button>
        )}
      </div>

      {/* Date/time + link — compact row */}
      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="meeting_date" className="text-xs text-muted-foreground">Дата и время *</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="bg-background flex-1"
                  value={watch('meeting_date')?.slice(0, 10) || ''}
                  onChange={(e) => {
                    const currentTime = watch('meeting_date')?.slice(11, 16) || '10:00';
                    setValue('meeting_date', `${e.target.value}T${currentTime}`, { shouldDirty: true });
                  }}
                  disabled={!canEditSharedFields}
                />
                <Input
                  type="time"
                  className="bg-background w-28"
                  value={watch('meeting_date')?.slice(11, 16) || ''}
                  onChange={(e) => {
                    const currentDate = watch('meeting_date')?.slice(0, 10) || '';
                    if (currentDate) {
                      setValue('meeting_date', `${currentDate}T${e.target.value}`, { shouldDirty: true });
                    }
                  }}
                  disabled={!canEditSharedFields}
                />
              </div>
              {errors.meeting_date && (
                <p className="text-xs text-destructive">{errors.meeting_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> Ссылка
              </Label>
              {canEditSharedFields ? (
                <Input
                  type="url"
                  {...register('meeting_link')}
                  placeholder="https://meet.google.com/..."
                  className="bg-background h-9"
                />
              ) : watch('meeting_link') ? (
                <a href={watch('meeting_link')!} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline truncate max-w-[200px]">
                  {watch('meeting_link')}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous decisions review */}
      {previousDecisions && previousDecisions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Решения прошлой встречи
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {previousDecisions.map((decision) => (
              <div key={decision.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                <Checkbox
                  checked={decision.is_completed}
                  onCheckedChange={(checked) =>
                    updateDecision({ id: decision.id, is_completed: !!checked })
                  }
                  disabled={isHistorical}
                />
                <span className={`text-sm flex-1 ${decision.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {decision.decision_text}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Employee block */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Блок сотрудника
          </CardTitle>
          {isManager && !isHistorical && (
            <p className="text-xs text-muted-foreground mt-1">
              Эти поля заполняет сотрудник. Доступны только для чтения.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Настроение / самочувствие</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('emp_mood')}
              value={watch('emp_mood') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Как вы себя чувствуете?"
              maxCollapsedRows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Успехи и достижения</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('emp_successes')}
              value={watch('emp_successes') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Чего удалось достичь?"
              maxCollapsedRows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Текущие сложности</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('emp_problems')}
              value={watch('emp_problems') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Какие препятствия возникли?"
              maxCollapsedRows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Новости</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('emp_news')}
              value={watch('emp_news') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Новости и обновления..."
              maxCollapsedRows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Вопросы к руководителю</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('emp_questions')}
              value={watch('emp_questions') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Что хотите обсудить с руководителем?"
              maxCollapsedRows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Manager block */}
      {isManager && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Блок руководителя
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Похвала / позитивная обратная связь</Label>
              <ExpandableTextarea
                className="bg-background"
                value={mgrPraise}
                onChange={(e) => setMgrPraise(e.target.value)}
                disabled={!canEditManagerFields}
                placeholder="Что хорошо получается у сотрудника?"
                maxCollapsedRows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Комментарий по развитию</Label>
              <ExpandableTextarea
                className="bg-background"
                value={mgrDevComment}
                onChange={(e) => setMgrDevComment(e.target.value)}
                disabled={!canEditManagerFields}
                placeholder="Что можно улучшить?"
                maxCollapsedRows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Новости руководителя</Label>
              <ExpandableTextarea
                className="bg-background"
                value={mgrNews}
                onChange={(e) => setMgrNews(e.target.value)}
                disabled={!canEditManagerFields}
                placeholder="Новости для сотрудника..."
                maxCollapsedRows={2}
              />
            </div>

            {canEditManagerFields && (
              <Button type="button" variant="outline" size="sm" onClick={handleSaveManagerBlock} disabled={isUpsertingManagerFields}>
                {isUpsertingManagerFields ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Сохранить блок руководителя
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meeting summary + action items */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Итоги встречи
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Резюме</Label>
            <ExpandableTextarea
              className="bg-background"
              {...register('meeting_summary')}
              value={watch('meeting_summary') || ''}
              disabled={!canEditSummary}
              placeholder="Зафиксируйте ключевые итоги встречи..."
              maxCollapsedRows={6}
            />
          </div>

          {/* Action items (stored in meeting_decisions) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Договорённости</Label>
            {decisions && decisions.length > 0 && (
              <div className="space-y-1.5">
                {decisions.map((decision) => (
                  <div key={decision.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/30">
                    <p className="flex-1 text-sm">{decision.decision_text}</p>
                    {canEditDecisions && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteDecision(decision.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEditDecisions && (
              <div className="flex gap-2">
                <Input
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  placeholder="Добавить договорённость..."
                  className="bg-background"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDecision(); } }}
                />
                <Button type="button" onClick={handleAddDecision} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {canEditSummary && (
            <Button type="button" variant="outline" size="sm" onClick={handleSaveSummary}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить итоги
            </Button>
          )}
        </CardContent>
      </Card>

      {/* MVP: Artifacts, 360 snapshots, and Private notes are hidden from UI */}
    </form>
  );
};
