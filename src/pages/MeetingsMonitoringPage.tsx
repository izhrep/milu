import React, { useMemo, useState, useCallback } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertTriangle, CheckCircle, Clock, MinusCircle, Users,
  CalendarClock, TrendingUp, Search, List, Network,
  ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const REGULARITY_THRESHOLD_DAYS = 35;

const formatUserName = (u: { first_name: string | null; last_name: string | null }) =>
  [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени';

interface BasicUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
  status: boolean | null;
  position_id: string | null;
}

interface MeetingRow {
  employee_id: string;
  manager_id: string;
  status: string;
  meeting_date: string | null;
  updated_at: string;
  meeting_summary: string | null;
  summary_saved_by: string | null;
}

type MonitoringStatus = 'overdue' | 'not_in_cycle' | 'awaiting_summary' | 'scheduled' | 'ok';
type ViewMode = 'list' | 'structure';
type SubordinationFilter = 'all' | 'direct' | 'indirect';

const STATUS_OPTIONS: { value: MonitoringStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'awaiting_summary', label: 'Ожидает итогов' },
  { value: 'scheduled', label: 'Запланирована' },
  { value: 'ok', label: 'В норме' },
  { value: 'not_in_cycle', label: 'Цикл встреч не начат' },
];

const now = new Date();
const periods = [
  { value: 'current_month', label: 'Текущий месяц', from: startOfMonth(now), to: endOfMonth(now) },
  { value: 'prev_month', label: 'Прошлый месяц', from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
  { value: 'current_quarter', label: 'Текущий квартал', from: startOfQuarter(now), to: endOfQuarter(now) },
  { value: 'last_90', label: 'Последние 90 дней', from: subMonths(now, 3), to: now },
];

const PRIORITY_ORDER: Record<MonitoringStatus, number> = {
  overdue: 0, awaiting_summary: 1, scheduled: 2, not_in_cycle: 3, ok: 4,
};

/* ─── helpers ─── */

const formatRelativeDate = (date: Date): string => {
  if (isToday(date)) return 'сегодня';
  if (isYesterday(date)) return 'вчера';
  return format(date, 'd MMM', { locale: ru });
};

const formatDaysAgo = (days: number): string => {
  if (days === 0) return 'сегодня';
  if (days === 1) return '1 день назад';
  if (days >= 2 && days <= 4) return `${days} дня назад`;
  return `${days} дней назад`;
};

const getStatusConfig = (status: MonitoringStatus) => {
  switch (status) {
    case 'overdue':
      return { label: 'Просрочено', badgeClass: 'bg-destructive/10 text-destructive border-destructive/20', icon: <AlertTriangle className="h-3 w-3" /> };
    case 'not_in_cycle':
      return { label: 'Цикл встреч не начат', badgeClass: 'bg-muted text-muted-foreground border-border text-xs whitespace-nowrap', icon: <MinusCircle className="h-3 w-3" /> };
    case 'awaiting_summary':
      return { label: 'Ожидает итогов', badgeClass: 'bg-warning/10 text-warning border-warning/20', icon: <Clock className="h-3 w-3" /> };
    case 'scheduled':
      return { label: 'Запланирована', badgeClass: 'bg-primary/10 text-primary border-primary/20', icon: <CalendarClock className="h-3 w-3" /> };
    case 'ok':
      return { label: 'В норме', badgeClass: 'bg-success/10 text-success border-success/20', icon: <CheckCircle className="h-3 w-3" /> };
  }
};

const formatDateTime = (date: Date): string => {
  return format(date, 'd MMM, HH:mm', { locale: ru });
};

const getContextText = (emp: EmployeeSummary): string => {
  if (emp.monitoringStatus === 'not_in_cycle') return 'Встреч не было';
  if (emp.monitoringStatus === 'awaiting_summary' && emp.awaitingMeetingDate) return `Была запланирована на ${formatDateTime(emp.awaitingMeetingDate)}`;
  if (emp.monitoringStatus === 'scheduled' && emp.scheduledMeetingDate) return `Запланирована на ${formatDateTime(emp.scheduledMeetingDate)}`;
  if (emp.monitoringStatus === 'scheduled') return 'Есть запланированная встреча';
  if (emp.lastMeetingDate && emp.daysSinceLast !== null) return `Последняя: ${format(emp.lastMeetingDate, 'd MMM', { locale: ru })}, ${formatDaysAgo(emp.daysSinceLast)}`;
  return '—';
};

const getActionText = (status: MonitoringStatus): string => {
  switch (status) {
    case 'overdue': return 'Назначить встречу';
    case 'not_in_cycle': return 'Назначить первую встречу';
    case 'awaiting_summary': return 'Заполнить итоги';
    case 'scheduled': return 'Дождаться встречи';
    case 'ok': return 'Действий не требуется';
  }
};

const getActionClass = (status: MonitoringStatus): string => {
  switch (status) {
    case 'overdue':
    case 'not_in_cycle':
    case 'awaiting_summary':
      return 'text-foreground font-medium';
    default:
      return 'text-muted-foreground';
  }
};

const isActionRequired = (status: MonitoringStatus) =>
  status === 'overdue' || status === 'awaiting_summary' || status === 'not_in_cycle';

interface EmployeeSummary extends BasicUser {
  isDirect: boolean;
  totalMeetings: number;
  lastMeetingDate: Date | null;
  daysSinceLast: number | null;
  monitoringStatus: MonitoringStatus;
  hasScheduled: boolean;
  hasAwaiting: boolean;
  lastSummarySavedBy: string | null;
  managerName: string | null;
  scheduledMeetingDate: Date | null;
  awaitingMeetingDate: Date | null;
}

/* ─── Subordination path helper ─── */
const getSubordinationText = (
  emp: EmployeeSummary,
  isAdminOrHr: boolean,
  currentUserId: string | undefined,
  allUsersMap?: Map<string, string>,
  allUsers?: BasicUser[],
): string => {
  if (!emp.manager_id || !emp.managerName) return '';

  // Direct report — just show manager
  if (emp.isDirect && !isAdminOrHr) {
    return '';
  }

  // For indirect, try to build a short path
  if (!emp.isDirect && !isAdminOrHr && allUsersMap && allUsers && currentUserId) {
    // Walk up from emp.manager_id to currentUserId
    const path: string[] = [];
    let cursor = emp.manager_id;
    let safety = 10;
    while (cursor && cursor !== currentUserId && safety-- > 0) {
      const name = allUsersMap.get(cursor);
      if (name) path.push(name);
      const cursorUser = allUsers.find(u => u.id === cursor);
      cursor = cursorUser?.manager_id || '';
    }
    if (path.length > 0) {
      return `Через: ${path.join(' → ')}`;
    }
  }

  return `Менеджер: ${emp.managerName}`;
};

/* ─── main component ─── */

const MeetingsMonitoringPage = () => {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr_bp';
  const { allSubtreeUsers, isDirect } = useSubordinateTree();
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MonitoringStatus | 'all'>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [subordinationFilter, setSubordinationFilter] = useState<SubordinationFilter>('all');
  const [actionOnly, setActionOnly] = useState(false);
  const isMobile = useIsMobile();

  const period = periods.find(p => p.value === selectedPeriod) || periods[0];

  const { data: allCompanyUsers, isLoading: loadingAllUsers } = useQuery({
    queryKey: ['all-company-users-monitoring'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, manager_id, status, position_id')
        .eq('status', true)
        .order('last_name');
      if (error) throw error;
      return (data || []) as BasicUser[];
    },
    enabled: isAdminOrHr,
  });

  const { data: externalPositionIds } = useQuery({
    queryKey: ['external-position-ids'],
    queryFn: async () => {
      const { data: cats, error: catsErr } = await supabase
        .from('position_categories')
        .select('id, name')
        .ilike('name', '%(внешний)%');
      if (catsErr) throw catsErr;
      const externalCatIds = (cats || []).map(c => c.id);
      if (externalCatIds.length === 0) return new Set<string>();
      const { data: positions, error: posErr } = await supabase
        .from('positions')
        .select('id')
        .in('position_category_id', externalCatIds);
      if (posErr) throw posErr;
      return new Set((positions || []).map(p => p.id));
    },
  });

  const { data: allUsersMap } = useQuery({
    queryKey: ['users-name-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name');
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach(u => map.set(u.id, [u.last_name, u.first_name].filter(Boolean).join(' ') || '—'));
      return map;
    },
  });

  const rawUsers: BasicUser[] = isAdminOrHr
    ? (allCompanyUsers || []).filter(u => u.id !== user?.id)
    : allSubtreeUsers;

  const usersToShow = rawUsers.filter(u => {
    if (!externalPositionIds) return true;
    return !u.position_id || !externalPositionIds.has(u.position_id);
  });

  const userIds = usersToShow.map(u => u.id);

  const { data: meetingsData, isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings-monitoring', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('employee_id, manager_id, status, meeting_date, updated_at, meeting_summary, summary_saved_by')
        .in('employee_id', userIds)
        .order('meeting_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as MeetingRow[];
    },
    enabled: userIds.length > 0,
  });

  const isLoading = isAdminOrHr ? loadingAllUsers || loadingMeetings : loadingMeetings;

  /* Build employee summaries */
  const employeeSummaries = useMemo((): EmployeeSummary[] => {
    return usersToShow.map(emp => {
      const meetings = meetingsData?.filter(m => m.employee_id === emp.id) || [];
      const hasMeetings = meetings.length > 0;
      const lastRecorded = meetings.find(m => m.status === 'recorded');
      const hasScheduled = meetings.some(m => m.status === 'scheduled');
      const hasAwaiting = meetings.some(m => m.status === 'awaiting_summary');

      const scheduledMeeting = meetings.find(m => m.status === 'scheduled');
      const awaitingMeeting = meetings.find(m => m.status === 'awaiting_summary');

      const scheduledMeetingDate = scheduledMeeting?.meeting_date ? new Date(scheduledMeeting.meeting_date) : null;
      const awaitingMeetingDate = awaitingMeeting?.meeting_date ? new Date(awaitingMeeting.meeting_date) : null;

      const lastMeetingDate = lastRecorded?.meeting_date
        ? new Date(lastRecorded.meeting_date)
        : lastRecorded?.updated_at ? new Date(lastRecorded.updated_at) : null;

      const daysSinceLast = lastMeetingDate ? differenceInDays(new Date(), lastMeetingDate) : null;

      let monitoringStatus: MonitoringStatus;
      if (!hasMeetings) {
        monitoringStatus = 'not_in_cycle';
      } else if (hasAwaiting) {
        monitoringStatus = 'awaiting_summary';
      } else if (hasScheduled) {
        monitoringStatus = 'scheduled';
      } else if (daysSinceLast === null || daysSinceLast > REGULARITY_THRESHOLD_DAYS) {
        monitoringStatus = 'overdue';
      } else {
        monitoringStatus = 'ok';
      }

      const lastSummarySavedBy = lastRecorded?.summary_saved_by
        ? allUsersMap?.get(lastRecorded.summary_saved_by) || null
        : null;

      const managerName = emp.manager_id ? allUsersMap?.get(emp.manager_id) || null : null;

      return {
        ...emp,
        isDirect: isAdminOrHr ? true : isDirect(emp.id),
        totalMeetings: meetings.length,
        lastMeetingDate,
        daysSinceLast,
        monitoringStatus,
        hasScheduled,
        hasAwaiting,
        lastSummarySavedBy,
        managerName,
        scheduledMeetingDate,
        awaitingMeetingDate,
      };
    });
  }, [usersToShow, meetingsData, allUsersMap, isAdminOrHr, isDirect]);

  /* Unique managers for filter */
  const managerOptions = useMemo(() => {
    const managers = new Map<string, string>();
    employeeSummaries.forEach(emp => {
      if (emp.manager_id && emp.managerName) {
        managers.set(emp.manager_id, emp.managerName);
      }
    });
    return Array.from(managers.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employeeSummaries]);

  /* Subordination filter enabled? For admin/hr it requires a manager to be selected */
  const subordinationEnabled = isAdminOrHr ? managerFilter !== 'all' : true;

  /* Apply filters */
  const filteredSummaries = useMemo(() => {
    let result = employeeSummaries;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e =>
        formatUserName(e).toLowerCase().includes(q) ||
        (e.managerName && e.managerName.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(e => e.monitoringStatus === statusFilter);
    }
    if (managerFilter !== 'all') {
      result = result.filter(e => e.manager_id === managerFilter);
    }
    if (subordinationEnabled && subordinationFilter !== 'all') {
      if (subordinationFilter === 'direct') {
        result = result.filter(e => e.isDirect);
      } else if (subordinationFilter === 'indirect') {
        result = result.filter(e => !e.isDirect);
      }
    }
    if (actionOnly) {
      result = result.filter(e => isActionRequired(e.monitoringStatus));
    }

    return result;
  }, [employeeSummaries, searchQuery, statusFilter, managerFilter, subordinationFilter, subordinationEnabled, actionOnly]);

  /* Sorted by priority for list view */
  const sortedByPriority = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      const diff = PRIORITY_ORDER[a.monitoringStatus] - PRIORITY_ORDER[b.monitoringStatus];
      if (diff !== 0) return diff;
      return (b.daysSinceLast ?? 999) - (a.daysSinceLast ?? 999);
    });
  }, [filteredSummaries]);

  /* Grouped by manager for structure view */
  const groupedByManager = useMemo(() => {
    const groups = new Map<string, { managerId: string; managerName: string; members: EmployeeSummary[] }>();

    filteredSummaries.forEach(emp => {
      const mgrId = emp.manager_id || '__none__';
      if (!groups.has(mgrId)) {
        groups.set(mgrId, {
          managerId: mgrId,
          managerName: emp.managerName || 'Без руководителя',
          members: [],
        });
      }
      groups.get(mgrId)!.members.push(emp);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aActions = a.members.filter(m => isActionRequired(m.monitoringStatus)).length;
      const bActions = b.members.filter(m => isActionRequired(m.monitoringStatus)).length;
      if (aActions !== bActions) return bActions - aActions;
      return a.managerName.localeCompare(b.managerName);
    });
  }, [filteredSummaries]);

  /* KPI from filtered data */
  const kpi = useMemo(() => {
    const counts = { total: 0, not_in_cycle: 0, overdue: 0, awaiting_summary: 0, scheduled: 0, ok: 0 };
    filteredSummaries.forEach(e => {
      counts.total++;
      counts[e.monitoringStatus]++;
    });
    return counts;
  }, [filteredSummaries]);

  const meetingAggregates = useMemo(() => {
    if (!meetingsData) return { scheduled: 0, awaiting_summary: 0, recorded: 0, total: 0, recordedPercent: 0 };
    const filteredIds = new Set(filteredSummaries.map(e => e.id));
    const periodMeetings = meetingsData.filter(m => {
      if (!m.meeting_date) return false;
      if (!filteredIds.has(m.employee_id)) return false;
      const d = new Date(m.meeting_date);
      return d >= period.from && d <= period.to;
    });
    const scheduled = periodMeetings.filter(m => m.status === 'scheduled').length;
    const awaiting = periodMeetings.filter(m => m.status === 'awaiting_summary').length;
    const recorded = periodMeetings.filter(m => m.status === 'recorded').length;
    const total = periodMeetings.length;
    return {
      scheduled,
      awaiting_summary: awaiting,
      recorded,
      total,
      recordedPercent: total > 0 ? Math.round((recorded / total) * 100) : 0,
    };
  }, [meetingsData, period, filteredSummaries]);

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || managerFilter !== 'all' || subordinationFilter !== 'all' || actionOnly;

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setManagerFilter('all');
    setSubordinationFilter('all');
    setActionOnly(false);
  }, []);

  /* ─── render ─── */

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Мониторинг встреч one-to-one</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Регулярность и статусы встреч по сотрудникам</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Всего" value={kpi.total} />
            <KpiCard icon={<CheckCircle className="h-3.5 w-3.5" />} label="В норме" value={kpi.ok} accent="text-success" />
            <KpiCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Просрочено" value={kpi.overdue} accent="text-destructive" highlight={kpi.overdue > 0} />
            <KpiCard icon={<Clock className="h-3.5 w-3.5" />} label="Ожидает итогов" value={kpi.awaiting_summary} accent="text-warning" highlight={kpi.awaiting_summary > 0} />
            <KpiCard icon={<CalendarClock className="h-3.5 w-3.5" />} label="Запланировано" value={kpi.scheduled} accent="text-primary" />
            <KpiCard icon={<MinusCircle className="h-3.5 w-3.5" />} label="Не начаты" value={kpi.not_in_cycle} />
          </div>

          {/* Period aggregates */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{period.label}:</span>
            <span>Встреч: <strong className="text-foreground">{meetingAggregates.total}</strong></span>
            <span>Зафиксировано: <strong className="text-foreground">{meetingAggregates.recorded}</strong></span>
            <span>Ожидает итогов: <strong className="text-foreground">{meetingAggregates.awaiting_summary}</strong></span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <strong className="text-foreground">{meetingAggregates.recordedPercent}%</strong> зафиксировано
            </span>
          </div>

          {/* ═══ Controls ═══ */}
          <div className="space-y-2.5">

            {/* Row 1: View mode + Search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View mode — primary segmented control */}
              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Список
                </button>
                <button
                  onClick={() => setViewMode('structure')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'structure'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Network className="h-3.5 w-3.5" />
                  По структуре
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Поиск по сотруднику…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Row 2: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status */}
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as MonitoringStatus | 'all')}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-background">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subordination — segmented control */}
              {subordinationEnabled && (
                <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
                  {([
                    { value: 'all' as SubordinationFilter, label: 'Все в subtree' },
                    { value: 'direct' as SubordinationFilter, label: 'Только прямые' },
                    { value: 'indirect' as SubordinationFilter, label: 'Только непрямые' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSubordinationFilter(opt.value)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        subordinationFilter === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Action only */}
              <Button
                variant={actionOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActionOnly(v => !v)}
                className="h-8 text-xs"
              >
                Только требующие действий
              </Button>

              {/* Manager filter */}
              {managerOptions.length > 1 && (
                <Select value={managerFilter} onValueChange={setManagerFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs bg-background">
                    <SelectValue placeholder="Менеджер" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все менеджеры</SelectItem>
                    {managerOptions.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground gap-1">
                  <X className="h-3 w-3" /> Сбросить
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              {filteredSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {hasActiveFilters ? 'Нет сотрудников по заданным фильтрам' : 'Нет сотрудников для мониторинга'}
                </div>
              ) : viewMode === 'list' ? (
                <ListView
                  employees={sortedByPriority}
                  isMobile={isMobile}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={user?.id}
                  allUsersMap={allUsersMap}
                  allUsers={usersToShow}
                />
              ) : (
                <StructureView
                  groups={groupedByManager}
                  isMobile={isMobile}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={user?.id}
                  allUsersMap={allUsersMap}
                  allUsers={usersToShow}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   List View — flat priority-sorted table
   ═══════════════════════════════════════════ */

const ListView: React.FC<{
  employees: EmployeeSummary[];
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
}> = ({ employees, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers }) => {
  if (isMobile) {
    return (
      <div className="divide-y divide-border/40">
        {employees.map(emp => (
          <EmployeeMobileCard
            key={emp.id}
            emp={emp}
            showManager
            isAdminOrHr={isAdminOrHr}
            currentUserId={currentUserId}
            allUsersMap={allUsersMap}
            allUsers={allUsers}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="text-left pl-4 pr-2 py-2 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[30%]">Сотрудник</th>
            <th className="text-left px-2 py-2 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[18%]">Статус</th>
            <th className="text-left px-2 py-2 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[28%]">Контекст встречи</th>
            <th className="text-left pl-2 pr-4 py-2 font-medium text-xs text-muted-foreground uppercase tracking-wide w-[24%]">Следующее действие</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <EmployeeRow
              key={emp.id}
              emp={emp}
              isAdminOrHr={isAdminOrHr}
              currentUserId={currentUserId}
              allUsersMap={allUsersMap}
              allUsers={allUsers}
              indentLevel={0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════
   Structure View — grouped by manager
   ═══════════════════════════════════════════ */

const StructureView: React.FC<{
  groups: { managerId: string; managerName: string; members: EmployeeSummary[] }[];
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
}> = ({ groups, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers }) => {
  return (
    <div className="divide-y divide-border/40">
      {groups.map(group => (
        <ManagerGroup
          key={group.managerId}
          group={group}
          isMobile={isMobile}
          isAdminOrHr={isAdminOrHr}
          currentUserId={currentUserId}
          allUsersMap={allUsersMap}
          allUsers={allUsers}
        />
      ))}
    </div>
  );
};

const ManagerGroup: React.FC<{
  group: { managerId: string; managerName: string; members: EmployeeSummary[] };
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
}> = ({ group, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers }) => {
  const [open, setOpen] = useState(true);
  const actionCount = group.members.filter(m => isActionRequired(m.monitoringStatus)).length;
  const okCount = group.members.filter(m => m.monitoringStatus === 'ok').length;
  const totalCount = group.members.length;
  const sortedMembers = [...group.members].sort((a, b) => {
    const diff = PRIORITY_ORDER[a.monitoringStatus] - PRIORITY_ORDER[b.monitoringStatus];
    if (diff !== 0) return diff;
    return (b.daysSinceLast ?? 999) - (a.daysSinceLast ?? 999);
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <span className="font-semibold text-sm text-foreground">{group.managerName}</span>
          <span className="text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'сотрудник' : totalCount < 5 ? 'сотрудника' : 'сотрудников'}
          </span>
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            {actionCount > 0 && (
              <span className="font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {actionCount} требует действий
              </span>
            )}
            {okCount > 0 && (
              <span className="text-success flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {okCount} в норме
              </span>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isMobile ? (
          <div className="divide-y divide-border/30">
            {sortedMembers.map(emp => (
              <EmployeeMobileCard
                key={emp.id}
                emp={emp}
                showManager={false}
                isAdminOrHr={isAdminOrHr}
                currentUserId={currentUserId}
                allUsersMap={allUsersMap}
                allUsers={allUsers}
                indent
              />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {sortedMembers.map(emp => (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={currentUserId}
                  allUsersMap={allUsersMap}
                  allUsers={allUsers}
                  indentLevel={1}
                />
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ═══════════════════════════════════════════
   Shared: desktop employee row
   ═══════════════════════════════════════════ */

const EmployeeRow: React.FC<{
  emp: EmployeeSummary;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  indentLevel: number;
}> = ({ emp, isAdminOrHr, currentUserId, allUsersMap, allUsers, indentLevel }) => {
  const cfg = getStatusConfig(emp.monitoringStatus);
  const isProblematic = isActionRequired(emp.monitoringStatus);
  const subText = getSubordinationText(emp, isAdminOrHr, currentUserId, allUsersMap, allUsers);

  return (
    <tr
      className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
        emp.monitoringStatus === 'overdue' ? 'bg-destructive/[0.03]' : ''
      }`}
    >
      <td className={`pr-2 py-2.5 ${indentLevel > 0 ? 'pl-10' : 'pl-4'}`}>
        <div className="font-medium text-foreground">{formatUserName(emp)}</div>
        {subText && (
          <div className="text-[11px] text-muted-foreground/70 leading-snug mt-0.5">{subText}</div>
        )}
        {emp.lastSummarySavedBy && (
          <div className="text-[11px] text-muted-foreground/50 leading-snug">Итоги: {emp.lastSummarySavedBy}</div>
        )}
      </td>
      <td className="px-2 py-2.5">
        <Badge variant="outline" className={`gap-1 text-[11px] px-2 py-0.5 font-medium ${cfg.badgeClass}`}>
          {cfg.icon}{cfg.label}
        </Badge>
      </td>
      <td className="px-2 py-2.5 text-xs text-muted-foreground">{getContextText(emp)}</td>
      <td className={`pl-2 pr-4 py-2.5 text-xs ${getActionClass(emp.monitoringStatus)}`}>
        {isProblematic && <span className="mr-1">→</span>}
        {getActionText(emp.monitoringStatus)}
      </td>
    </tr>
  );
};

/* ═══════════════════════════════════════════
   Mobile employee card (shared)
   ═══════════════════════════════════════════ */

const EmployeeMobileCard: React.FC<{
  emp: EmployeeSummary;
  showManager: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  indent?: boolean;
}> = ({ emp, showManager, isAdminOrHr, currentUserId, allUsersMap, allUsers, indent }) => {
  const cfg = getStatusConfig(emp.monitoringStatus);
  const subText = showManager
    ? getSubordinationText(emp, isAdminOrHr, currentUserId, allUsersMap, allUsers)
    : '';

  return (
    <div className={`px-3 py-2.5 space-y-1 ${indent ? 'pl-6' : ''} ${emp.monitoringStatus === 'overdue' ? 'bg-destructive/5' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-foreground truncate">{formatUserName(emp)}</span>
        <Badge variant="outline" className={`shrink-0 gap-1 text-[11px] px-2 py-0.5 ${cfg.badgeClass}`}>
          {cfg.icon}{cfg.label}
        </Badge>
      </div>
      {subText && <p className="text-[11px] text-muted-foreground/70">{subText}</p>}
      <p className="text-xs text-muted-foreground">{getContextText(emp)}</p>
      <p className={`text-xs ${getActionClass(emp.monitoringStatus)}`}>→ {getActionText(emp.monitoringStatus)}</p>
    </div>
  );
};

/* ─── KPI card ─── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: number; accent?: string; highlight?: boolean }> = ({
  icon, label, value, accent, highlight,
}) => (
  <Card className={`border-border/50 ${highlight ? 'border-destructive/30 bg-destructive/[0.03]' : ''}`}>
    <CardContent className="pt-3 pb-2.5 px-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={accent || 'text-muted-foreground'}>{icon}</span>
        <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      </div>
      <div className={`text-xl font-bold leading-tight ${accent || 'text-foreground'}`}>{value}</div>
    </CardContent>
  </Card>
);

export default MeetingsMonitoringPage;
