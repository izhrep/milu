import React, { useState, useMemo, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOneOnOneMeetings, OneOnOneMeeting } from '@/hooks/useOneOnOneMeetings';
import { useMeetingManagerFields } from '@/hooks/useMeetingManagerFields';
import { useMeetingTasks } from '@/hooks/useMeetingTasks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Info, Lock, Loader2, Link as LinkIcon, History, Save, User, Briefcase, FileText, CalendarIcon, Pencil, CalendarClock, ArrowRight, Trash2 } from 'lucide-react';
import { DeleteMeetingDialog } from '@/components/DeleteMeetingDialog';
import { MeetingSummaryHistory } from '@/components/MeetingSummaryHistory';
import { RescheduleMeetingDialog } from '@/components/RescheduleMeetingDialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  buildLocalDateTimeString,
  formatLocalDateInputValue,
  formatLocalTimeInputValue,
  parseMeetingDateTime,
} from '@/lib/meetingDateTime';
import { validateMeetingDateTime, getFieldError } from '@/lib/meetingValidation';

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
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { user } = useAuth();
  const { hasPermission: canViewAllMeetings } = usePermission('meetings.view_all');
  const { hasPermission: canDeleteMeetings } = usePermission('meetings.delete');

  const { deleteMeeting, isDeletingMeeting } = useOneOnOneMeetings();

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

  const { updateMeeting, saveSummary, updateMeetingAsync, saveSummaryAsync, rescheduleMeeting } = useOneOnOneMeetings();
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

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty: isFormDirty }, reset: resetForm } = useForm<MeetingFormData>({
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

  // Computed dirty states (comparison-based)
  const managerDirty = useMemo(() => {
    const orig = managerFields;
    return (mgrPraise !== (orig?.mgr_praise || '')) ||
           (mgrDevComment !== (orig?.mgr_development_comment || '')) ||
           (mgrNews !== (orig?.mgr_news || ''));
  }, [mgrPraise, mgrDevComment, mgrNews, managerFields]);

  const summaryDirty = useMemo(() => {
    if (!meeting) return false;
    return summaryDraft !== (meeting.meeting_summary || '');
  }, [summaryDraft, meeting?.meeting_summary]);

  // Employee/shared fields dirty (excludes meeting_summary which has its own save)
  const employeeDirty = useMemo(() => {
    if (!meeting) return false;
    const fields: (keyof MeetingFormData)[] = ['emp_mood', 'emp_successes', 'emp_problems', 'emp_news', 'emp_questions', 'meeting_link', 'meeting_date'];
    return fields.some(f => (watch(f) || '') !== (meeting[f as keyof OneOnOneMeeting] || ''));
  }, [
    watch('emp_mood'), watch('emp_successes'), watch('emp_problems'),
    watch('emp_news'), watch('emp_questions'), watch('meeting_link'),
    watch('meeting_date'), meeting,
  ]);

  // Any save in progress — used to block concurrent actions
  const isAnySaving = isSavingMain || isSavingSummary || isUpsertingManagerFields;

  // Permissions
  const canEditEmployeeFields = !isHistorical && !isManager && !!meeting && meeting.status !== 'recorded';
  const canEditManagerFields = !isHistorical && isManager && !!meeting && meeting.manager_id === user?.id;

  // Time-based lock: summary editable only after meeting date/time
  // Live clock tick: re-evaluate time-based lock every 30s
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const isMeetingStarted = useMemo(() => {
    if (!meeting?.meeting_date) return false;
    const meetingDt = parseMeetingDateTime(meeting.meeting_date);
    if (!meetingDt) return false;
    return now >= meetingDt;
  }, [meeting?.meeting_date, now]);

  // Overdue = date passed, no summary saved yet
  const isOverdue = isMeetingStarted && !!meeting && meeting.status !== 'recorded';
  const canEditSharedFields = !isHistorical && !isOverdue && !!meeting && meeting.status !== 'recorded';
  const canReschedule = isOverdue && !meeting?.meeting_summary && !isHistorical;

  const canEditSummary = !isHistorical && !!meeting && isMeetingStarted;

  // Date/time validation errors for save button (Bug 8)
  const hasDateTimeErrors = useMemo(() => {
    if (!canEditSharedFields) return false; // Only validate when user can edit
    const raw = watch('meeting_date') || '';
    const dt = parseMeetingDateTime(raw);
    if (!dt) return true; // No date = invalid
    const dateValue = formatLocalDateInputValue(dt);
    const timeValue = formatLocalTimeInputValue(dt);
    const errs = validateMeetingDateTime(dateValue, timeValue);
    return errs.length > 0;
  }, [watch('meeting_date'), canEditSharedFields, now]);

  // Reschedule history (visible to manager and HR only)
  const showRescheduleHistory = isManager || canViewAllMeetings;
  const { data: rescheduleHistory } = useQuery({
    queryKey: ['meeting-reschedules', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_reschedules')
        .select('id, previous_date, new_date, rescheduled_by, rescheduled_at')
        .eq('meeting_id', meetingId)
        .order('rescheduled_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: showRescheduleHistory,
  });

  const rescheduleAuthorIds = [...new Set((rescheduleHistory || []).map(r => r.rescheduled_by).filter(Boolean))];
  const { data: rescheduleAuthors } = useQuery({
    queryKey: ['reschedule-authors', rescheduleAuthorIds.join(',')],
    queryFn: async () => {
      if (!rescheduleAuthorIds.length) return {};
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', rescheduleAuthorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => {
        map[u.id] = [u.last_name, u.first_name].filter(Boolean).join(' ');
      });
      return map;
    },
    enabled: rescheduleAuthorIds.length > 0,
  });


  const onSubmit = async (data: MeetingFormData) => {
    if (!meeting || !employeeDirty) return;
    setIsSavingMain(true);
    try {
      const { meeting_summary, emp_mood, emp_successes, emp_problems, emp_news, emp_questions, ...sharedFields } = data;
      if (isManager) {
        await updateMeetingAsync({ id: meeting.id, ...sharedFields } as any);
      } else {
        const { meeting_summary: _, ...fields } = data;
        await updateMeetingAsync({ id: meeting.id, ...fields } as any);
      }
    } catch {
      // error handled by mutation toast
    } finally {
      setIsSavingMain(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!summaryDirty) return;
    setIsSavingSummary(true);
    try {
      // Bug 5: always use meetingId from props, not from query result
      await saveSummaryAsync({ meetingId, summary: summaryDraft });
      setIsEditingSummary(false);
    } catch {
      // error handled by mutation toast
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSaveManagerBlock = async () => {
    if (!meeting || !managerDirty) return;
    upsertManagerFields({
      meeting_id: meeting.id,
      mgr_praise: mgrPraise,
      mgr_development_comment: mgrDevComment,
      mgr_news: mgrNews,
    });
  };


  if (isMeetingLoading || !meeting) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    );
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
          <Button type="submit" size="sm" variant={employeeDirty ? 'default' : 'outline'} disabled={!employeeDirty || isSavingMain || isAnySaving || hasDateTimeErrors}>
            {isSavingMain ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Сохранение...</> : 'Сохранить'}
          </Button>
        )}
      </div>

      {/* Date/time + link — compact row */}
      <Card className={cn("border-border/50", isOverdue && "border-destructive/30 bg-destructive/[0.03]")}>
        <CardContent className="pt-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
            <div className="space-y-1.5">
              <Label htmlFor="meeting_date" className="text-xs text-muted-foreground flex items-center gap-1 h-4">
                {isOverdue && <Lock className="h-3 w-3 text-destructive/60" />}
                Дата и время *
              </Label>
              <div className="flex gap-2">
                {(() => {
                  const raw = watch('meeting_date') || '';
                  const dt = parseMeetingDateTime(raw);
                  const dateValue = dt ? formatLocalDateInputValue(dt) : '';
                  const timeValue = dt ? formatLocalTimeInputValue(dt) : '';

                  const parsedDate = dateValue ? parse(dateValue, 'yyyy-MM-dd', new Date()) : undefined;
                  const dtErrors = validateMeetingDateTime(dateValue, timeValue, { skipPastCheck: !canEditSharedFields });
                  const dtDateError = getFieldError(dtErrors, 'date');

                  return (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!canEditSharedFields}
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !dateValue && "text-muted-foreground",
                              dtDateError && "border-destructive",
                              isOverdue && "opacity-60",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {parsedDate
                              ? format(parsedDate, 'd MMMM yyyy', { locale: ru })
                              : 'Выберите дату'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parsedDate}
                            onSelect={(d) => {
                              if (d) {
                                const nextDate = format(d, 'yyyy-MM-dd');
                                const nextTime = timeValue || '10:00';
                                setValue('meeting_date', buildLocalDateTimeString(nextDate, nextTime), { shouldDirty: true });
                              }
                            }}
                            disabled={(d) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return d < today;
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <TimePicker
                        value={timeValue}
                        onChange={(nextTime) => {
                          const nextDate = dateValue;
                          if (nextDate) {
                            setValue('meeting_date', buildLocalDateTimeString(nextDate, nextTime), { shouldDirty: true });
                          }
                        }}
                        disabled={!canEditSharedFields}
                        placeholder="Время"
                      />
                    </>
                  );
                })()}
              </div>
              {isOverdue && (
                <p className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Дата встречи прошла. Чтобы назначить новое время, используйте «Перенести».
                </p>
              )}
              <p className="text-xs text-destructive min-h-[1rem]">
                {(() => {
                  const skipPast = !canEditSharedFields;
                  const raw = watch('meeting_date') || '';
                  const dt = parseMeetingDateTime(raw);
                  const dateValue = dt ? formatLocalDateInputValue(dt) : '';
                  const timeValue = dt ? formatLocalTimeInputValue(dt) : '';
                  const dtErrors = validateMeetingDateTime(dateValue, timeValue, { skipPastCheck: skipPast });
                  const errMsg = getFieldError(dtErrors, 'date') || getFieldError(dtErrors, 'time');
                  return errMsg || errors.meeting_date?.message || '\u00A0';
                })()}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1 h-4">
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
              <p className="text-xs min-h-[1rem]">{'\u00A0'}</p>
            </div>
          </div>

          {/* Reschedule button for overdue meetings */}
          {canReschedule && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => setIsRescheduleOpen(true)}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Перенести встречу
            </Button>
          )}

          {/* Reschedule history (manager/HR only) */}
          {showRescheduleHistory && rescheduleHistory && rescheduleHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wide flex items-center gap-1">
                <History className="h-3 w-3" />
                История переносов
              </p>
              <div className="space-y-1">
                {rescheduleHistory.map((r) => {
                  const prevDt = new Date(r.previous_date);
                  const newDt = new Date(r.new_date);
                  const authorName = rescheduleAuthors?.[r.rescheduled_by] || '';
                  const reschedAt = new Date(r.rescheduled_at);
                  return (
                    <p key={r.id} className="text-xs text-muted-foreground leading-relaxed flex items-center gap-1 flex-wrap">
                      <span>{format(prevDt, 'd MMM HH:mm', { locale: ru })}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">{format(newDt, 'd MMM HH:mm', { locale: ru })}</span>
                      {authorName && <span>· {authorName}</span>}
                      <span>· {format(reschedAt, 'd MMM', { locale: ru })}</span>
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reschedule dialog */}
      {meeting && (
        <RescheduleMeetingDialog
          open={isRescheduleOpen}
          onOpenChange={setIsRescheduleOpen}
          meetingId={meeting.id}
          currentMeetingDate={meeting.meeting_date || ''}
          onReschedule={rescheduleMeeting}
        />
      )}


      {/* Employee block */}
      <Card className="border-[hsl(var(--zone-employee-border))] bg-[hsl(var(--zone-employee))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary/60" />
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
              className={canEditEmployeeFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', watch('emp_mood') ? 'text-foreground' : 'text-muted-foreground')}
              {...register('emp_mood')}
              value={watch('emp_mood') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Как вы себя чувствуете?"
              maxCollapsedRows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Успехи и достижения</Label>
            <ExpandableTextarea
              className={canEditEmployeeFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', watch('emp_successes') ? 'text-foreground' : 'text-muted-foreground')}
              {...register('emp_successes')}
              value={watch('emp_successes') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Чего удалось достичь?"
              maxCollapsedRows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Текущие сложности</Label>
            <ExpandableTextarea
              className={canEditEmployeeFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', watch('emp_problems') ? 'text-foreground' : 'text-muted-foreground')}
              {...register('emp_problems')}
              value={watch('emp_problems') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Какие препятствия возникли?"
              maxCollapsedRows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Новости</Label>
            <ExpandableTextarea
              className={canEditEmployeeFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', watch('emp_news') ? 'text-foreground' : 'text-muted-foreground')}
              {...register('emp_news')}
              value={watch('emp_news') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Новости и обновления..."
              maxCollapsedRows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Вопросы к руководителю</Label>
            <ExpandableTextarea
              className={canEditEmployeeFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', watch('emp_questions') ? 'text-foreground' : 'text-muted-foreground')}
              {...register('emp_questions')}
              value={watch('emp_questions') || ''}
              disabled={!canEditEmployeeFields}
              placeholder="Что хотите обсудить с руководителем?"
              maxCollapsedRows={5}
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
                className={canEditManagerFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', mgrPraise ? 'text-foreground' : 'text-muted-foreground')}
                value={mgrPraise}
                onChange={(e) => { setMgrPraise(e.target.value); }}
                disabled={!canEditManagerFields}
                placeholder="Что хорошо получается у сотрудника?"
                maxCollapsedRows={5}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Комментарий по развитию</Label>
              <ExpandableTextarea
                className={canEditManagerFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', mgrDevComment ? 'text-foreground' : 'text-muted-foreground')}
                value={mgrDevComment}
                onChange={(e) => { setMgrDevComment(e.target.value); }}
                disabled={!canEditManagerFields}
                placeholder="Что можно улучшить?"
                maxCollapsedRows={5}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Новости руководителя</Label>
              <ExpandableTextarea
                className={canEditManagerFields ? 'bg-white border-[hsl(var(--field-border))] shadow-sm' : cn('bg-muted/30 border-border/50', mgrNews ? 'text-foreground' : 'text-muted-foreground')}
                value={mgrNews}
                onChange={(e) => { setMgrNews(e.target.value); }}
                disabled={!canEditManagerFields}
                placeholder="Новости для сотрудника..."
                maxCollapsedRows={4}
              />
            </div>

            {canEditManagerFields && (
              <Button type="button" variant={managerDirty ? 'default' : 'outline'} size="sm" onClick={handleSaveManagerBlock} disabled={!managerDirty || isUpsertingManagerFields || isAnySaving}>
                {isUpsertingManagerFields ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isUpsertingManagerFields ? 'Сохранение...' : 'Сохранить'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meeting summary */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Итоги встречи — резюме
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary CTA when meeting started, no summary, not editing */}
          {isMeetingStarted && !meeting.meeting_summary && !isEditingSummary && canEditSummary && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 flex items-center justify-between gap-3">
              <p className="text-sm text-foreground/80">Зафиксируйте ключевые итоги встречи</p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="shrink-0"
                onClick={() => { setSummaryDraft(''); setIsEditingSummary(true); }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Добавить итоги
              </Button>
            </div>
          )}

          {/* Inline editing textarea — single source for both new and existing summary edits */}
          {isMeetingStarted && isEditingSummary && canEditSummary && (
            <div className="space-y-2">
              <ExpandableTextarea
                className="bg-white border-[hsl(var(--field-border))] shadow-sm"
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                placeholder="Зафиксируйте ключевые итоги встречи..."
                maxCollapsedRows={6}
                maxExpandedRows={20}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant={summaryDirty ? 'default' : 'outline'} size="sm" onClick={handleSaveSummary} disabled={!summaryDirty || isSavingSummary}>
                  {isSavingSummary ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSavingSummary ? 'Сохранение...' : 'Сохранить итоги'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSummaryDraft(''); setIsEditingSummary(false); }} disabled={isSavingSummary}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {isMeetingStarted && !meeting.meeting_summary && !isEditingSummary && !canEditSummary && (
            <p className="text-sm text-muted-foreground italic">Итоги не заполнены</p>
          )}

          {/* History block — separated visually */}
          {meeting && (
            <MeetingSummaryHistory
              employeeId={meeting.employee_id}
              currentMeetingId={meetingId}
              currentMeetingCreatedAt={meeting.created_at}
              currentMeetingSummary={meeting.meeting_summary || ''}
              currentMeetingDate={meeting.meeting_date}
              currentSummarySavedBy={meeting.summary_saved_by}
              canEditCurrent={canEditSummary && isMeetingStarted && !isEditingSummary}
              isEditingCurrent={false}
              editValue=""
              onEditValueChange={() => {}}
              onStartEdit={() => { setSummaryDraft(meeting.meeting_summary || ''); setIsEditingSummary(true); }}
              onSave={handleSaveSummary}
              onCancel={() => {
                setSummaryDraft('');
                setIsEditingSummary(false);
              }}
              isSaving={isSavingSummary}
              isSaveDirty={summaryDirty}
            />
          )}

          {!isMeetingStarted && !isHistorical && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground py-2">
              <Lock className="h-4 w-4 shrink-0" />
              Итоги встречи можно заполнить только после начала встречи
            </p>
          )}
        </CardContent>
      </Card>

      {/* MVP: Artifacts, 360 snapshots, and Private notes are hidden from UI */}

      {canDeleteMeetings && (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive gap-1.5"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Удалить встречу
          </Button>
        </div>
      )}

      <DeleteMeetingDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={async () => {
          try {
            await deleteMeeting(meetingId);
            setIsDeleteOpen(false);
            onClose?.();
          } catch {
            // error handled by mutation toast
          }
        }}
        isDeleting={isDeletingMeeting}
      />
    </form>
  );
};
