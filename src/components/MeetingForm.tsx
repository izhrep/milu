import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { useMeetingFormAutoSave } from '@/hooks/useMeetingFormAutoSave';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Info, Lock, Loader2, Link as LinkIcon, History, Save, User, Briefcase, FileText, CalendarIcon, Pencil, CalendarClock, ArrowRight, Trash2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { DeleteMeetingDialog } from '@/components/DeleteMeetingDialog';
import { MeetingSummaryHistory } from '@/components/MeetingSummaryHistory';
import { MeetingSummaryThread } from '@/components/MeetingSummaryThread';
import { useMeetingSummaryViews, useAutoRecordSummaryView } from '@/hooks/useMeetingSummaryView';
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
  parseMeetingDateTime,
  getEffectiveTimezone,
  getTimezoneOffsetLabel,
  formatDateInTimezone,
  formatTimeInTimezone,
  localDateTimeToUtcIso,
  getNowInTimezone,
} from '@/lib/meetingDateTime';
import { formatMeetingDateFull, formatMeetingDateTimeShort } from '@/lib/meetingDateFormat';
import { validateMeetingDateTime, getFieldError } from '@/lib/meetingValidation';
import { toast } from 'sonner';

const meetingLinkSchema = z.string().optional().refine(
  (val) => {
    if (!val || val.trim() === '') return true;
    try {
      const url = new URL(val);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Укажите корректную ссылку (https://...)' }
);

const meetingSchema = z.object({
  meeting_link: meetingLinkSchema,
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

import { getMeetingStatusLabel as getStatusLabel, getMeetingStatusVariant as getStatusVariant } from '@/lib/meetingStatus';

export const MeetingForm: React.FC<MeetingFormProps> = ({ meetingId, isManager: isManagerProp = false, onClose }) => {
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [draftRecoveryBanner, setDraftRecoveryBanner] = useState<string | null>(null);
  const { user } = useAuth();
  const { hasPermission: canViewAllMeetings } = usePermission('meetings.view_all');
  const { hasPermission: canDeleteMeetings } = usePermission('meetings.delete');
  const { hasPermission: canEditSummaryDate } = usePermission('meetings.edit_summary_date');

  const { deleteMeeting, isDeletingMeeting, silentUpdateMeetingAsync, rescheduleSilentAsync } = useOneOnOneMeetings();

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
  const isHistoricalRaw = isManager && !!meeting && meeting.manager_id !== user?.id;
  const isParticipant = !!meeting && (user?.id === meeting.employee_id || user?.id === meeting.manager_id);
  const isHrbpEdit = canEditSummaryDate && !isParticipant && !!meeting;
  const isHistorical = isHistoricalRaw && !isHrbpEdit;

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
    enabled: !!meeting?.manager_id,
  });

  const originalManagerName = originalManager
    ? [originalManager.last_name, originalManager.first_name].filter(Boolean).join(' ')
    : null;

  // Fetch summary author name (could be employee, manager, or HRBP)
  const summaryAuthorId = meeting?.summary_saved_by;
  const { data: summaryAuthorUser } = useQuery({
    queryKey: ['user-name', summaryAuthorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', summaryAuthorId!)
        .single();
      return data;
    },
    enabled: !!summaryAuthorId && summaryAuthorId !== meeting?.manager_id,
  });

  // Resolve summary author display name
  const summaryAuthorName = useMemo(() => {
    if (!summaryAuthorId) return null;
    // If author is the manager, reuse already-fetched originalManager
    if (summaryAuthorId === meeting?.manager_id) {
      return originalManagerName || null;
    }
    if (summaryAuthorUser) {
      return [summaryAuthorUser.last_name, summaryAuthorUser.first_name].filter(Boolean).join(' ');
    }
    return null;
  }, [summaryAuthorId, meeting?.manager_id, originalManagerName, summaryAuthorUser]);

  // Fetch employee name for view status display
  const { data: employeeUser } = useQuery({
    queryKey: ['user-name', meeting?.employee_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', meeting!.employee_id)
        .single();
      return data;
    },
    enabled: !!meeting?.employee_id && meeting?.employee_id !== meeting?.manager_id,
  });

  const employeeName = employeeUser
    ? [employeeUser.last_name, employeeUser.first_name].filter(Boolean).join(' ')
    : null;

  /** Resolve participant name by ID */
  const getParticipantName = (pid: string) => {
    if (pid === meeting?.manager_id) return originalManagerName || 'Участник';
    if (pid === meeting?.employee_id) return employeeName || 'Участник';
    return 'Участник';
  };

  const { updateMeetingAsync, saveSummaryAsync } = useOneOnOneMeetings();
  const { managerFields, isLoading: isMgrLoading, silentUpsertManagerFieldsAsync } = useMeetingManagerFields(meetingId);
  const { acknowledgeMeetingReview } = useMeetingTasks();

  const [mgrPraise, setMgrPraise] = useState('');
  const [mgrDevComment, setMgrDevComment] = useState('');
  const [mgrNews, setMgrNews] = useState('');

  // --- Anti-clobber: hydrate mgr fields only on meetingId change ---
  const mgrInitializedRef = useRef<string | null>(null);
  useEffect(() => {
    // Wait until the query has settled (not loading) before marking as initialized.
    // This handles both cases: managerFields exists (hydrate) and managerFields is null (new meeting).
    if (isMgrLoading || mgrInitializedRef.current === meetingId) return;
    if (managerFields) {
      setMgrPraise(managerFields.mgr_praise || '');
      setMgrDevComment(managerFields.mgr_development_comment || '');
      setMgrNews(managerFields.mgr_news || '');
    }
    mgrInitializedRef.current = meetingId;
  }, [managerFields, isMgrLoading, meetingId]);

  useEffect(() => {
    if (meetingId && user) {
      acknowledgeMeetingReview(meetingId);
    }
  }, [meetingId, user]);

  // Auto-record summary view
  useAutoRecordSummaryView(
    meetingId,
    !!meeting?.meeting_summary?.trim(),
    isParticipant,
    meeting?.summary_saved_by,
  );

  // Summary views for display
  const { views: summaryViews } = useMeetingSummaryViews(meetingId);

  // --- Anti-clobber: useForm with defaultValues + controlled reset ---
  const { register, watch, setValue, formState: { errors }, reset: resetForm } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      meeting_link: '',
      meeting_date: '',
      emp_mood: '',
      emp_successes: '',
      emp_problems: '',
      emp_news: '',
      emp_questions: '',
      meeting_summary: '',
    },
  });

  const initializedRef = useRef<string | null>(null);
  useEffect(() => {
    if (meeting && initializedRef.current !== meetingId) {
      resetForm({
        meeting_link: meeting.meeting_link || '',
        meeting_date: meeting.meeting_date || '',
        emp_mood: meeting.emp_mood || '',
        emp_successes: meeting.emp_successes || '',
        emp_problems: meeting.emp_problems || '',
        emp_news: meeting.emp_news || '',
        emp_questions: meeting.emp_questions || '',
        meeting_summary: meeting.meeting_summary || '',
      });
      initializedRef.current = meetingId;
    }
  }, [meeting, meetingId, resetForm]);

  // Permissions
  const canEditEmployeeFields = !isHistorical && !isManager && !!meeting && meeting.status !== 'recorded';
  const canEditManagerFields = !isHistorical && isManager && !!meeting && meeting.manager_id === user?.id;

  // Time-based lock
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

  const isOverdue = isMeetingStarted && !!meeting && meeting.status !== 'recorded';
  const canEditSharedFields = !isHistorical && !isOverdue && !!meeting && meeting.status !== 'recorded';
  const canEditDateTime = isHrbpEdit || canEditSharedFields;
  const canReschedule = isOverdue && !meeting?.meeting_summary && !isHistorical;
  // Summary is editable only if not yet saved OR user has HRBP override
  const hasSavedSummary = !!meeting?.meeting_summary?.trim();
  const canEditSummary = isHrbpEdit
    ? true
    : (!isHistorical && !!meeting && isMeetingStarted && !hasSavedSummary);

  // Autosave enabled only for editable forms
  const autosaveEnabled = !!meeting && !isHistorical && (canEditEmployeeFields || canEditManagerFields || canEditDateTime);

  // --- Autosave hook ---
  const autoSave = useMeetingFormAutoSave({
    meetingId,
    userId: user?.id,
    callbacks: {
      silentUpdateMeetingAsync,
      silentUpsertManagerFieldsAsync,
      rescheduleSilentAsync,
    },
    enabled: autosaveEnabled,
  });

  // Initialize autosave refs from server data
  useEffect(() => {
    if (meeting && initializedRef.current === meetingId) {
      autoSave.initializeFromServer(meeting, managerFields);
    }
  }, [meeting, managerFields, meetingId]);

  // Draft recovery on mount
  useEffect(() => {
    if (!meeting || initializedRef.current !== meetingId) return;
    const mgrUpdatedAt = managerFields?.updated_at;
    const { hasDraft, drafts } = autoSave.recoverDrafts(meeting.updated_at, mgrUpdatedAt);
    if (!hasDraft) return;

    const recoveredParts: string[] = [];

    // Safe fields — skip if draft data matches server
    if (drafts.safe) {
      const sf = drafts.safe as unknown as Record<string, string>;
      const serverSafe: Record<string, string> = {
        emp_mood: meeting.emp_mood || '',
        emp_successes: meeting.emp_successes || '',
        emp_problems: meeting.emp_problems || '',
        emp_news: meeting.emp_news || '',
        emp_questions: meeting.emp_questions || '',
        meeting_link: meeting.meeting_link || '',
      };
      const isDifferent = Object.keys(sf).some(k => (sf[k] || '') !== (serverSafe[k] || ''));
      if (isDifferent) {
        Object.entries(sf).forEach(([key, val]) => {
          if (val !== undefined) setValue(key as keyof MeetingFormData, val);
        });
        recoveredParts.push('поля сотрудника');
      } else {
        autoSave.clearAllDrafts(); // stale draft — clean up silently
      }
    }

    // Mgr fields — skip if draft data matches server
    if (drafts.mgr) {
      const mf = drafts.mgr as { mgr_praise?: string; mgr_development_comment?: string; mgr_news?: string };
      const serverMgr = {
        mgr_praise: managerFields?.mgr_praise || '',
        mgr_development_comment: managerFields?.mgr_development_comment || '',
        mgr_news: managerFields?.mgr_news || '',
      };
      const isDifferent =
        (mf.mgr_praise ?? '') !== serverMgr.mgr_praise ||
        (mf.mgr_development_comment ?? '') !== serverMgr.mgr_development_comment ||
        (mf.mgr_news ?? '') !== serverMgr.mgr_news;
      if (isDifferent) {
        if (mf.mgr_praise !== undefined) setMgrPraise(mf.mgr_praise);
        if (mf.mgr_development_comment !== undefined) setMgrDevComment(mf.mgr_development_comment);
        if (mf.mgr_news !== undefined) setMgrNews(mf.mgr_news);
        recoveredParts.push('блок руководителя');
      }
    }

    // Date — skip if draft matches server meeting_date
    if (drafts.date) {
      const draftDate = drafts.date as string;
      if (draftDate !== (meeting.meeting_date || '')) {
        setValue('meeting_date', draftDate);
        recoveredParts.push('дата/время');
      }
    }

    if (drafts.summary) {
      const draftSummary = drafts.summary as string;
      if (draftSummary !== (meeting.meeting_summary || '')) {
        setSummaryDraft(draftSummary);
        setIsEditingSummary(true); // Fix: show textarea so recovered text is visible
        recoveredParts.push('итоги');
      }
    }

    if (recoveredParts.length > 0) {
      setDraftRecoveryBanner(`Восстановлен черновик: ${recoveredParts.join(', ')}`);
    }
  }, [meetingId, meeting?.updated_at]);

  // --- Trigger autosave on field changes ---
  const watchedSafeFields = {
    emp_mood: watch('emp_mood') || '',
    emp_successes: watch('emp_successes') || '',
    emp_problems: watch('emp_problems') || '',
    emp_news: watch('emp_news') || '',
    emp_questions: watch('emp_questions') || '',
    meeting_link: watch('meeting_link') || '',
  };

  const safeFieldsJson = JSON.stringify(watchedSafeFields);
  useEffect(() => {
    if (canEditEmployeeFields && initializedRef.current === meetingId) {
      autoSave.debounceSafeFields(watchedSafeFields);
    }
  }, [safeFieldsJson, canEditEmployeeFields, meetingId]);

  // Mgr fields autosave
  const mgrFieldsObj = useMemo(() => ({
    mgr_praise: mgrPraise,
    mgr_development_comment: mgrDevComment,
    mgr_news: mgrNews,
  }), [mgrPraise, mgrDevComment, mgrNews]);

  const mgrFieldsJson = JSON.stringify(mgrFieldsObj);
  useEffect(() => {
    if (canEditManagerFields && mgrInitializedRef.current === meetingId) {
      autoSave.debounceMgrFields(mgrFieldsObj);
    }
  }, [mgrFieldsJson, canEditManagerFields, meetingId]);

  // Date autosave — debounce final meeting_date value
  const watchedDate = watch('meeting_date') || '';
  useEffect(() => {
    if (canEditDateTime && initializedRef.current === meetingId && watchedDate && watchedDate !== meeting?.meeting_date) {
      autoSave.debounceDateField(watchedDate);
    }
  }, [watchedDate, canEditDateTime, meetingId]);

  // Summary draft to localStorage — save whenever editing, even if text is empty
  // (empty draft is valid: user may have cleared text intentionally)
  useEffect(() => {
    if (isEditingSummary) {
      if (summaryDraft) {
        autoSave.saveSummaryDraft(summaryDraft);
      } else {
        autoSave.clearSummaryDraft();
      }
    }
  }, [summaryDraft, isEditingSummary]);

  // Date/time validation errors
  const hasDateTimeErrors = useMemo(() => {
    if (!canEditDateTime) return false;
    const raw = watch('meeting_date') || '';
    const dt = parseMeetingDateTime(raw);
    if (!dt) return true;
    const tz = getEffectiveTimezone(user?.timezone);
    const dateValue = formatDateInTimezone(dt, tz);
    const timeValue = formatTimeInTimezone(dt, tz);
    const errs = validateMeetingDateTime(dateValue, timeValue, { timezone: tz });
    return errs.length > 0;
  }, [watch('meeting_date'), canEditDateTime, now, user?.timezone]);

  // Reschedule history
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

  const summaryDirty = useMemo(() => {
    if (!meeting) return false;
    return summaryDraft !== (meeting.meeting_summary || '');
  }, [summaryDraft, meeting?.meeting_summary]);

  const isAnySaving = isSavingSummary || autoSave.aggregatedStatus === 'saving';

  const isSummaryValid = summaryDraft.trim().length > 0;

  const handleSaveSummary = async () => {
    if (!summaryDirty || !isSummaryValid) return;
    setIsSavingSummary(true);
    try {
      await saveSummaryAsync({ meetingId, summary: summaryDraft.trim() });
      setIsEditingSummary(false);
      autoSave.clearSummaryDraft();
    } catch {
      // error handled by mutation toast
    } finally {
      setIsSavingSummary(false);
    }
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
    <div className="space-y-6">
      {/* Draft recovery banner */}
      {draftRecoveryBanner && (
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{draftRecoveryBanner}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2 h-6 text-xs"
              onClick={() => {
                autoSave.clearAllDrafts();
                setDraftRecoveryBanner(null);
                // Re-hydrate from server
                if (meeting) {
                  resetForm({
                    meeting_link: meeting.meeting_link || '',
                    meeting_date: meeting.meeting_date || '',
                    emp_mood: meeting.emp_mood || '',
                    emp_successes: meeting.emp_successes || '',
                    emp_problems: meeting.emp_problems || '',
                    emp_news: meeting.emp_news || '',
                    emp_questions: meeting.emp_questions || '',
                    meeting_summary: meeting.meeting_summary || '',
                  });
                  if (managerFields) {
                    setMgrPraise(managerFields.mgr_praise || '');
                    setMgrDevComment(managerFields.mgr_development_comment || '');
                    setMgrNews(managerFields.mgr_news || '');
                  }
                }
              }}
            >
              Отменить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Historical banner */}
      {isHistorical && (
        <Alert className="border-muted bg-muted/30">
          <History className="h-4 w-4" />
          <AlertDescription>
            Историческая встреча (провёл {originalManagerName || 'другой руководитель'}). Только просмотр.
          </AlertDescription>
        </Alert>
      )}

      {/* HRBP banner */}
      {isHrbpEdit && (
        <Alert className="border-primary/30 bg-primary/5">
          <Pencil className="h-4 w-4" />
          <AlertDescription>
            Режим HRBP — доступно редактирование итогов и даты/времени
          </AlertDescription>
        </Alert>
      )}

      {/* Header: status + date + autosave indicator */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(meeting.status)}>
            {getStatusLabel(meeting.status)}
          </Badge>
          {meeting.meeting_date && (
            <span className="text-sm text-muted-foreground">
              {formatMeetingDateFull(meeting.meeting_date, user?.timezone)}
            </span>
          )}
        </div>
        {/* Autosave status indicator */}
        {autoSave.aggregatedStatus !== 'idle' && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {autoSave.aggregatedStatus === 'saving' && (
              <><Loader2 className="h-3 w-3 animate-spin" /> Сохраняется...</>
            )}
            {autoSave.aggregatedStatus === 'saved' && (
              <><CheckCircle2 className="h-3 w-3 text-primary" /> Сохранено</>
            )}
            {autoSave.aggregatedStatus === 'error' && (
              <><AlertCircle className="h-3 w-3 text-destructive" /> Ошибка сохранения</>
            )}
          </div>
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
                <span className="text-[10px]">({getTimezoneOffsetLabel(getEffectiveTimezone(user?.timezone))})</span>
              </Label>
              <div className="flex gap-2">
                {(() => {
                  const raw = watch('meeting_date') || '';
                  const dt = parseMeetingDateTime(raw);
                  const userTz = getEffectiveTimezone(user?.timezone);
                  const dateValue = dt ? formatDateInTimezone(dt, userTz) : '';
                  const timeValue = dt ? formatTimeInTimezone(dt, userTz) : '';

                  const parsedDate = dateValue ? parse(dateValue, 'yyyy-MM-dd', new Date()) : undefined;
                  const dtErrors = validateMeetingDateTime(dateValue, timeValue, { skipPastCheck: !canEditDateTime, timezone: userTz });
                  const dtDateError = getFieldError(dtErrors, 'date');

                  return (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!canEditDateTime}
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
                                setValue('meeting_date', localDateTimeToUtcIso(nextDate, nextTime, userTz), { shouldDirty: true });
                              } else {
                                setValue('meeting_date', '', { shouldDirty: true });
                              }
                            }}
                            disabled={(d) => {
                              const todayStr = getNowInTimezone(userTz).date;
                              const dStr = format(d, 'yyyy-MM-dd');
                              return dStr < todayStr;
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
                            setValue('meeting_date', localDateTimeToUtcIso(nextDate, nextTime, userTz), { shouldDirty: true });
                          }
                        }}
                        disabled={!canEditDateTime}
                        placeholder="Время"
                        minTime={dateValue === getNowInTimezone(userTz).date ? getNowInTimezone(userTz).time : null}
                      />
                    </>
                  );
                })()}
              </div>
              {isOverdue && !isHrbpEdit && (
                <p className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Дата встречи прошла. Чтобы назначить новое время, используйте «Перенести».
                </p>
              )}
              <p className="text-xs text-destructive min-h-[1rem]">
                {(() => {
                  const skipPast = !canEditDateTime;
                  const raw = watch('meeting_date') || '';
                  const dt = parseMeetingDateTime(raw);
                  const tz = getEffectiveTimezone(user?.timezone);
                  const dateValue = dt ? formatDateInTimezone(dt, tz) : '';
                  const timeValue = dt ? formatTimeInTimezone(dt, tz) : '';
                  const dtErrors = validateMeetingDateTime(dateValue, timeValue, { skipPastCheck: skipPast, timezone: tz });
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
                <>
                  <Input
                    type="url"
                    {...register('meeting_link')}
                    placeholder="https://meet.google.com/..."
                    className={cn("bg-background h-9", errors.meeting_link && "border-destructive")}
                  />
                  {errors.meeting_link && (
                    <p className="text-xs text-destructive">{errors.meeting_link.message}</p>
                  )}
                </>
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
                  const authorName = rescheduleAuthors?.[r.rescheduled_by] || '';
                  return (
                    <p key={r.id} className="text-xs text-muted-foreground leading-relaxed flex items-center gap-1 flex-wrap">
                      <span>{formatMeetingDateTimeShort(r.previous_date, user?.timezone)}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">{formatMeetingDateTimeShort(r.new_date, user?.timezone)}</span>
                      {authorName && <span>· {authorName}</span>}
                      <span>· {formatMeetingDateTimeShort(r.rescheduled_at, user?.timezone)}</span>
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
          onReschedule={async (params) => {
            // P1: Cancel pending timer + bump generation so in-flight RPC is ignored
            autoSave.cancelPendingDate();
            await rescheduleSilentAsync(params);
            // Only clear draft after successful server commit
            autoSave.clearDateDraft();
          }}
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
      {(isManager || isHrbpEdit) && (
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
                onClick={() => { setSummaryDraft(summaryDraft || ''); setIsEditingSummary(true); }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Добавить итоги
              </Button>
            </div>
          )}

          {/* Inline editing textarea */}
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
                <Button type="button" variant={(summaryDirty && isSummaryValid) ? 'default' : 'outline'} size="sm" onClick={handleSaveSummary} disabled={!summaryDirty || !isSummaryValid || isSavingSummary}>
                  {isSavingSummary ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSavingSummary ? 'Сохранение...' : 'Сохранить итоги'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSummaryDraft(''); setIsEditingSummary(false); autoSave.clearSummaryDraft(); }} disabled={isSavingSummary}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {isMeetingStarted && !meeting.meeting_summary && !isEditingSummary && !canEditSummary && (
            <p className="text-sm text-muted-foreground italic">Итоги не заполнены</p>
          )}

          {/* Saved summary — text, meta, view status, thread */}
          {hasSavedSummary && (
            <div className="space-y-3">
              {/* Summary text */}
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {meeting.meeting_summary}
              </p>

              {/* Meta line: author name · date + edit button */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] text-muted-foreground">
                  {summaryAuthorName || 'Автор'}
                  {meeting.summary_saved_at && ` · ${formatMeetingDateFull(meeting.summary_saved_at, user?.timezone)}`}
                </p>
                {canEditSummary && !isEditingSummary && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => { setSummaryDraft(meeting.meeting_summary || ''); setIsEditingSummary(true); }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Изменить
                  </Button>
                )}
              </div>

              {/* View status */}
              <div className="space-y-1">
                {(() => {
                  const participants = [meeting.employee_id, meeting.manager_id].filter(id => id !== meeting.summary_saved_by);
                  return participants.map(pid => {
                    const view = summaryViews.find(v => v.user_id === pid);
                    const name = view?.user_name || getParticipantName(pid);
                    if (view) {
                      return (
                        <p key={pid} className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary/60" />
                          {name} ознакомился · {formatMeetingDateFull(view.viewed_at, user?.timezone)}
                        </p>
                      );
                    }
                    return (
                      <p key={pid} className="text-xs text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {name} ещё не просматривал итоги
                      </p>
                    );
                  });
                })()}
              </div>

              {/* Thread — messenger for current meeting */}
              <MeetingSummaryThread
                meetingId={meetingId}
                isParticipant={isParticipant}
              />
            </div>
          )}

          {/* History of past meetings — separate section */}
          {meeting && (
            <MeetingSummaryHistory
              employeeId={meeting.employee_id}
              currentMeetingId={meetingId}
              currentMeetingCreatedAt={meeting.created_at}
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
    </div>
  );
};
