import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  differenceInDays, format, startOfMonth, endOfMonth, subMonths, subDays,
  startOfQuarter, endOfQuarter, isToday, isYesterday,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatMeetingDateShort, formatMeetingDateOnly } from '@/lib/meetingDateFormat';
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
  id: string;
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

const PRIORITY_ORDER: Record<MonitoringStatus, number> = {
  overdue: 0, awaiting_summary: 1, scheduled: 2, not_in_cycle: 3, ok: 4,
};

const getEffectiveMeetingStatus = (m: MeetingRow): string => {
  if (m.status === 'scheduled' && m.meeting_date && !m.meeting_summary) {
    const meetingTime = new Date(m.meeting_date).getTime();
    if (!Number.isNaN(meetingTime) && meetingTime <= Date.now()) {
      return 'awaiting_summary';
    }
  }
  return m.status;
};

/* ─── helpers ─── */

const formatDateTime = (date: Date, timezone?: string): string => {
  if (!timezone) {
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timezone = 'UTC'; }
  }
  try {
    return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: timezone });
  } catch {
    return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
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

interface DisplayRow {
  rowKey: string;
  employeeId: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
  position_id: string | null;
  status: boolean | null;
  isDirect: boolean;
  managerName: string | null;
  monitoringStatus: MonitoringStatus;
  meetingId: string | null;
  meetingDate: Date | null;
  lastMeetingDate: Date | null;
  daysSinceLast: number | null;
  lastSummarySavedBy: string | null;
}

type ActionIntent =
  | { kind: 'meeting'; meetingId: string }
  | { kind: 'create'; employeeId: string; managerId: string | null };

const getActionIntent = (row: DisplayRow): ActionIntent | null => {
  if (row.monitoringStatus === 'awaiting_summary' && row.meetingId) {
    return { kind: 'meeting', meetingId: row.meetingId };
  }

  if (row.monitoringStatus === 'overdue' || row.monitoringStatus === 'not_in_cycle') {
    return {
      kind: 'create',
      employeeId: row.employeeId,
      managerId: row.manager_id,
    };
  }

  return null;
};

/* ─── Subordination path helper ─── */
const getSubordinationText = (
  row: DisplayRow,
  isAdminOrHr: boolean,
  currentUserId: string | undefined,
  allUsersMap?: Map<string, string>,
  allUsers?: BasicUser[],
): string => {
  if (!row.manager_id || !row.managerName) return '';
  if (row.isDirect && !isAdminOrHr) return '';
  if (!row.isDirect && !isAdminOrHr && allUsersMap && allUsers && currentUserId) {
    const path: string[] = [];
    let cursor = row.manager_id;
    let safety = 10;
    while (cursor && cursor !== currentUserId && safety-- > 0) {
      const name = allUsersMap.get(cursor);
      if (name) path.push(name);
      const cursorUser = allUsers.find(u => u.id === cursor);
      cursor = cursorUser?.manager_id || '';
    }
    if (path.length > 0) return `Через: ${path.join(' → ')}`;
  }
  return `Менеджер: ${row.managerName}`;
};

const getContextText = (row: DisplayRow, timezone?: string): string => {
  if (row.monitoringStatus === 'not_in_cycle') return 'Встреч не было';
  if (row.monitoringStatus === 'awaiting_summary' && row.meetingDate) return `Была запланирована на ${formatDateTime(row.meetingDate, timezone)}`;
  if (row.monitoringStatus === 'scheduled' && row.meetingDate) return `Запланирована на ${formatDateTime(row.meetingDate, timezone)}`;
  if (row.lastMeetingDate && row.daysSinceLast !== null) {
    const tz = timezone || ((() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })());
    const dateOnly = (() => { try { return row.lastMeetingDate!.toLocaleString('ru-RU', { day: 'numeric', month: 'short', timeZone: tz }); } catch { return format(row.lastMeetingDate!, 'd MMM', { locale: ru }); } })();
    return `Последняя: ${dateOnly}, ${formatDaysAgo(row.daysSinceLast)}`;
  }
  return '—';
};

/* ─── Build admin subtree client-side ─── */
const buildSubtreeIds = (managerId: string, users: BasicUser[]): Set<string> => {
  const result = new Set<string>();
  const queue = [managerId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const u of users) {
      if (u.manager_id === current && !result.has(u.id)) {
        result.add(u.id);
        queue.push(u.id);
      }
    }
  }
  return result;
};

/* ═══════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════ */

const MeetingsMonitoringPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const _tick = useMinuteTick();
  const { hasPermission: canViewTeam, isLoading: permLoading } = usePermission('team.view');
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

  /* ─── Dynamic periods ─── */
  const now = new Date();
  const periods = useMemo(() => [
    { value: 'current_month', label: 'Текущий месяц', from: startOfMonth(now), to: endOfMonth(now) },
    { value: 'prev_month', label: 'Прошлый месяц', from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { value: 'current_quarter', label: 'Текущий квартал', from: startOfQuarter(now), to: endOfQuarter(now) },
    { value: 'last_90', label: 'Последние 90 дней', from: subDays(now, 90), to: now },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [_tick]);
  const period = periods.find(p => p.value === selectedPeriod) || periods[0];

  /* ─── Data queries ─── */
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
        .select('id, employee_id, manager_id, status, meeting_date, updated_at, meeting_summary, summary_saved_by')
        .in('employee_id', userIds)
        .order('meeting_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as MeetingRow[];
    },
    enabled: userIds.length > 0,
  });

  const isLoading = isAdminOrHr ? loadingAllUsers || loadingMeetings : loadingMeetings;

  /* ─── Admin subtree for selected manager ─── */
  const adminSubtreeIds = useMemo(() => {
    if (!isAdminOrHr || managerFilter === 'all' || !allCompanyUsers) return null;
    return buildSubtreeIds(managerFilter, allCompanyUsers);
  }, [isAdminOrHr, managerFilter, allCompanyUsers]);

  /* ─── isDirect relative to context ─── */
  const getIsDirect = useCallback((emp: BasicUser): boolean => {
    if (!isAdminOrHr) return isDirect(emp.id);
    if (managerFilter === 'all') return true;
    return emp.manager_id === managerFilter;
  }, [isAdminOrHr, isDirect, managerFilter]);

  /* ─── Period-filtered meetings ─── */
  const periodMeetings = useMemo(() => {
    if (!meetingsData) return [];
    return meetingsData.filter(m => {
      if (!m.meeting_date) return false;
      const d = new Date(m.meeting_date);
      return d >= period.from && d <= period.to;
    });
  }, [meetingsData, period]);

  /* ─── Employee KPI data (one per employee, for upper KPI block) ─── */
  const employeeKpis = useMemo(() => {
    return usersToShow.map(emp => {
      const empAllMeetings = meetingsData?.filter(m => m.employee_id === emp.id) || [];
      const empPeriodMeetings = periodMeetings.filter(m => m.employee_id === emp.id);

      const activeInPeriod = empPeriodMeetings.filter(m => {
        const es = getEffectiveMeetingStatus(m);
        return es === 'scheduled' || es === 'awaiting_summary';
      });

      const hasAwaiting = activeInPeriod.some(m => getEffectiveMeetingStatus(m) === 'awaiting_summary');
      const hasScheduled = activeInPeriod.some(m => getEffectiveMeetingStatus(m) === 'scheduled');

      // Regularity from all-time data
      const lastRecorded = empAllMeetings.find(m => getEffectiveMeetingStatus(m) === 'recorded');
      const lastMeetingDate = lastRecorded?.meeting_date ? new Date(lastRecorded.meeting_date) : null;
      const daysSinceLast = lastMeetingDate ? differenceInDays(new Date(), lastMeetingDate) : null;

      let status: MonitoringStatus;
      if (hasAwaiting) status = 'awaiting_summary';
      else if (empAllMeetings.length === 0) status = 'not_in_cycle';
      else if (daysSinceLast === null || daysSinceLast > REGULARITY_THRESHOLD_DAYS) status = 'overdue';
      else if (hasScheduled) status = 'scheduled';
      else status = 'ok';

      const empIsDirect = getIsDirect(emp);
      const managerName = emp.manager_id ? allUsersMap?.get(emp.manager_id) || null : null;

      return {
        employeeId: emp.id,
        monitoringStatus: status,
        isDirect: empIsDirect,
        managerId: emp.manager_id,
        managerName,
      };
    });
  }, [usersToShow, meetingsData, periodMeetings, allUsersMap, getIsDirect, _tick]);

  /* ─── List rows (one per active meeting, or one employee-level row) ─── */
  const listRows = useMemo((): DisplayRow[] => {
    const rows: DisplayRow[] = [];

    usersToShow.forEach(emp => {
      const empAllMeetings = meetingsData?.filter(m => m.employee_id === emp.id) || [];
      const empPeriodMeetings = periodMeetings.filter(m => m.employee_id === emp.id);

      const activePeriodMeetings = empPeriodMeetings.filter(m => {
        const es = getEffectiveMeetingStatus(m);
        return es === 'scheduled' || es === 'awaiting_summary';
      });

      // Regularity from all-time
      const lastRecorded = empAllMeetings.find(m => getEffectiveMeetingStatus(m) === 'recorded');
      const lastMeetingDate = lastRecorded?.meeting_date ? new Date(lastRecorded.meeting_date) : null;
      const daysSinceLast = lastMeetingDate ? differenceInDays(new Date(), lastMeetingDate) : null;
      const lastSummarySavedBy = lastRecorded?.summary_saved_by
        ? allUsersMap?.get(lastRecorded.summary_saved_by) || null
        : null;
      const empIsDirect = getIsDirect(emp);
      const managerName = emp.manager_id ? allUsersMap?.get(emp.manager_id) || null : null;

      const baseRow = {
        employeeId: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        manager_id: emp.manager_id,
        position_id: emp.position_id,
        status: emp.status,
        isDirect: empIsDirect,
        managerName,
        lastMeetingDate,
        daysSinceLast,
        lastSummarySavedBy,
      };

      if (activePeriodMeetings.length > 0) {
        // One row per active meeting
        activePeriodMeetings.forEach(m => {
          const es = getEffectiveMeetingStatus(m) as MonitoringStatus;
          const mDate = m.meeting_date ? new Date(m.meeting_date) : null;
          rows.push({
            ...baseRow,
            rowKey: m.id,
            monitoringStatus: es,
            meetingId: m.id,
            meetingDate: mDate,
          });
        });
      } else {
        // Single employee-level row
        let empStatus: MonitoringStatus;
        if (empAllMeetings.length === 0) empStatus = 'not_in_cycle';
        else if (daysSinceLast === null || daysSinceLast > REGULARITY_THRESHOLD_DAYS) empStatus = 'overdue';
        else empStatus = 'ok';

        rows.push({
          ...baseRow,
          rowKey: emp.id,
          monitoringStatus: empStatus,
          meetingId: empStatus === 'ok' && lastRecorded ? lastRecorded.id : null,
          meetingDate: null,
        });
      }
    });

    return rows;
  }, [usersToShow, meetingsData, periodMeetings, allUsersMap, getIsDirect, _tick]);

  /* Unique managers for filter */
  const managerOptions = useMemo(() => {
    const managers = new Map<string, string>();
    usersToShow.forEach(emp => {
      if (emp.manager_id) {
        const name = allUsersMap?.get(emp.manager_id);
        if (name) managers.set(emp.manager_id, name);
      }
    });
    return Array.from(managers.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [usersToShow, allUsersMap]);

  /* Subordination filter enabled? For admin/hr it requires a manager to be selected */
  const subordinationEnabled = isAdminOrHr ? managerFilter !== 'all' : true;

  /* Apply filters to list rows */
  const filteredRows = useMemo(() => {
    let result = listRows;

    // Manager filter: for admin with selected manager, show full subtree
    if (managerFilter !== 'all') {
      if (isAdminOrHr && adminSubtreeIds) {
        result = result.filter(r => adminSubtreeIds.has(r.employeeId));
      } else if (!isAdminOrHr) {
        // For regular managers, manager filter already handled by allSubtreeUsers
        result = result.filter(r => r.manager_id === managerFilter);
      }
    }

    // Subordination filter (relative to selected manager)
    if (subordinationEnabled && subordinationFilter !== 'all') {
      if (subordinationFilter === 'direct') {
        result = result.filter(r => r.isDirect);
      } else if (subordinationFilter === 'indirect') {
        result = result.filter(r => !r.isDirect);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        formatUserName(r).toLowerCase().includes(q) ||
        (r.managerName && r.managerName.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => r.monitoringStatus === statusFilter);
    }

    if (actionOnly) {
      result = result.filter(r => isActionRequired(r.monitoringStatus));
    }

    return result;
  }, [listRows, searchQuery, statusFilter, managerFilter, subordinationFilter, subordinationEnabled, actionOnly, isAdminOrHr, adminSubtreeIds]);

  /* Sorted by priority */
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const diff = PRIORITY_ORDER[a.monitoringStatus] - PRIORITY_ORDER[b.monitoringStatus];
      if (diff !== 0) return diff;
      return (b.daysSinceLast ?? 999) - (a.daysSinceLast ?? 999);
    });
  }, [filteredRows]);

  /* Grouped by manager for structure view */
  const groupedByManager = useMemo(() => {
    const groups = new Map<string, { managerId: string; managerName: string; members: DisplayRow[] }>();
    filteredRows.forEach(row => {
      const mgrId = row.manager_id || '__none__';
      if (!groups.has(mgrId)) {
        groups.set(mgrId, {
          managerId: mgrId,
          managerName: row.managerName || 'Без руководителя',
          members: [],
        });
      }
      groups.get(mgrId)!.members.push(row);
    });
    return Array.from(groups.values()).sort((a, b) => {
      const aActions = a.members.filter(m => isActionRequired(m.monitoringStatus)).length;
      const bActions = b.members.filter(m => isActionRequired(m.monitoringStatus)).length;
      if (aActions !== bActions) return bActions - aActions;
      return a.managerName.localeCompare(b.managerName);
    });
  }, [filteredRows]);

  /* ─── KPI from employee-level data (filtered by same criteria) ─── */
  const kpi = useMemo(() => {
    let kpiData = employeeKpis;
    // Apply same manager/subordination/search/action filters to keep consistency
    if (managerFilter !== 'all') {
      if (isAdminOrHr && adminSubtreeIds) {
        kpiData = kpiData.filter(e => adminSubtreeIds.has(e.employeeId));
      } else if (!isAdminOrHr) {
        kpiData = kpiData.filter(e => e.managerId === managerFilter);
      }
    }
    if (subordinationEnabled && subordinationFilter !== 'all') {
      if (subordinationFilter === 'direct') kpiData = kpiData.filter(e => e.isDirect);
      else if (subordinationFilter === 'indirect') kpiData = kpiData.filter(e => !e.isDirect);
    }
    if (searchQuery.trim()) {
      // Need to match by employee name — look up from usersToShow
      const q = searchQuery.toLowerCase().trim();
      const matchIds = new Set(usersToShow.filter(u => formatUserName(u).toLowerCase().includes(q)).map(u => u.id));
      kpiData = kpiData.filter(e => matchIds.has(e.employeeId));
    }
    if (actionOnly) {
      kpiData = kpiData.filter(e => isActionRequired(e.monitoringStatus));
    }

    const counts = { total: 0, not_in_cycle: 0, overdue: 0, awaiting_summary: 0, scheduled: 0, ok: 0 };
    kpiData.forEach(e => {
      counts.total++;
      counts[e.monitoringStatus]++;
    });
    return counts;
  }, [employeeKpis, managerFilter, subordinationFilter, subordinationEnabled, searchQuery, actionOnly, isAdminOrHr, adminSubtreeIds, usersToShow]);

  /* ─── Meeting aggregates for bottom block ─── */
  const meetingAggregates = useMemo(() => {
    if (!periodMeetings.length) return { scheduled: 0, awaiting_summary: 0, recorded: 0, total: 0, recordedPercent: 0 };
    // Apply same filters to narrow to relevant employees
    const filteredEmpIds = new Set(filteredRows.map(r => r.employeeId));
    const relevantMeetings = periodMeetings.filter(m => filteredEmpIds.has(m.employee_id));

    const scheduled = relevantMeetings.filter(m => getEffectiveMeetingStatus(m) === 'scheduled').length;
    const awaiting = relevantMeetings.filter(m => getEffectiveMeetingStatus(m) === 'awaiting_summary').length;
    const recorded = relevantMeetings.filter(m => getEffectiveMeetingStatus(m) === 'recorded').length;
    const total = relevantMeetings.length;
    return {
      scheduled,
      awaiting_summary: awaiting,
      recorded,
      total,
      recordedPercent: total > 0 ? Math.round((recorded / total) * 100) : 0,
    };
  }, [periodMeetings, filteredRows]);

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || managerFilter !== 'all' || subordinationFilter !== 'all' || actionOnly;

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setManagerFilter('all');
    setSubordinationFilter('all');
    setActionOnly(false);
  }, []);

  /* ─── access guard ─── */
  const hasAccess = canViewTeam || isAdminOrHr || allSubtreeUsers.length > 0;

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

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
          {/* ═══ Upper block: Employees by status ═══ */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Сотрудники по статусу</p>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Всего" value={kpi.total} />
              <KpiCard icon={<CheckCircle className="h-3.5 w-3.5" />} label="В норме" value={kpi.ok} accent="text-success" />
              <KpiCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Просрочено" value={kpi.overdue} accent="text-destructive" highlight={kpi.overdue > 0} />
              <KpiCard icon={<Clock className="h-3.5 w-3.5" />} label="Ожидает итогов" value={kpi.awaiting_summary} accent="text-warning" highlight={kpi.awaiting_summary > 0} />
              <KpiCard icon={<CalendarClock className="h-3.5 w-3.5" />} label="Запланировано" value={kpi.scheduled} accent="text-primary" />
              <KpiCard icon={<MinusCircle className="h-3.5 w-3.5" />} label="Не начаты" value={kpi.not_in_cycle} />
            </div>
          </div>

          {/* ═══ Lower block: Meetings in period ═══ */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Встречи за период</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{period.label}:</span>
              <span>Всего: <strong className="text-foreground">{meetingAggregates.total}</strong></span>
              <span>Зафиксировано: <strong className="text-foreground">{meetingAggregates.recorded}</strong></span>
              <span>Ожидает итогов: <strong className="text-foreground">{meetingAggregates.awaiting_summary}</strong></span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <strong className="text-foreground">{meetingAggregates.recordedPercent}%</strong> зафиксировано
              </span>
            </div>
          </div>

          {/* ═══ Controls ═══ */}
          <div className="space-y-2.5">
            {/* Row 1: View mode + Search */}
            <div className="flex flex-wrap items-center gap-3">
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

              {subordinationEnabled && (
                <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
                  {([
                    { value: 'all' as SubordinationFilter, label: 'Вся команда' },
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

              <Button
                variant={actionOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActionOnly(v => !v)}
                className="h-8 text-xs"
              >
                Только требующие действий
              </Button>

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
              {filteredRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {hasActiveFilters ? 'Нет сотрудников по заданным фильтрам' : 'Нет сотрудников для мониторинга'}
                </div>
              ) : viewMode === 'list' ? (
                <ListView
                  rows={sortedRows}
                  isMobile={isMobile}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={user?.id}
                  allUsersMap={allUsersMap}
                  allUsers={usersToShow}
                  timezone={user?.timezone}
                  onActionClick={(row) => {
                    const actionIntent = getActionIntent(row);
                    if (!actionIntent) return;

                    const params = new URLSearchParams();

                    if (actionIntent.kind === 'meeting') {
                      params.set('meetingId', actionIntent.meetingId);
                    } else {
                      params.set('createMeeting', '1');
                      params.set('employeeId', actionIntent.employeeId);
                      if (actionIntent.managerId) {
                        params.set('managerId', actionIntent.managerId);
                      }
                    }

                    navigate(`/meetings?${params.toString()}`);
                  }}
                />
              ) : (
                <StructureView
                  groups={groupedByManager}
                  isMobile={isMobile}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={user?.id}
                  allUsersMap={allUsersMap}
                  allUsers={usersToShow}
                  timezone={user?.timezone}
                  onActionClick={(row) => {
                    const actionIntent = getActionIntent(row);
                    if (!actionIntent) return;

                    const params = new URLSearchParams();

                    if (actionIntent.kind === 'meeting') {
                      params.set('meetingId', actionIntent.meetingId);
                    } else {
                      params.set('createMeeting', '1');
                      params.set('employeeId', actionIntent.employeeId);
                      if (actionIntent.managerId) {
                        params.set('managerId', actionIntent.managerId);
                      }
                    }

                    navigate(`/meetings?${params.toString()}`);
                  }}
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
   List View
   ═══════════════════════════════════════════ */

const ListView: React.FC<{
  rows: DisplayRow[];
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  timezone?: string;
  onActionClick?: (row: DisplayRow) => void;
}> = ({ rows, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers, timezone, onActionClick }) => {
  if (isMobile) {
    return (
      <div className="divide-y divide-border/40">
        {rows.map(row => (
          <RowMobileCard
            key={row.rowKey}
            row={row}
            showManager
            isAdminOrHr={isAdminOrHr}
            currentUserId={currentUserId}
            allUsersMap={allUsersMap}
            allUsers={allUsers}
            timezone={timezone}
            onActionClick={onActionClick}
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
          {rows.map(row => (
            <RowDesktop
              key={row.rowKey}
              row={row}
              isAdminOrHr={isAdminOrHr}
              currentUserId={currentUserId}
              allUsersMap={allUsersMap}
              allUsers={allUsers}
              indentLevel={0}
              timezone={timezone}
              onActionClick={onActionClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════
   Structure View
   ═══════════════════════════════════════════ */

const StructureView: React.FC<{
  groups: { managerId: string; managerName: string; members: DisplayRow[] }[];
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  timezone?: string;
  onActionClick?: (row: DisplayRow) => void;
}> = ({ groups, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers, timezone, onActionClick }) => {
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
          timezone={timezone}
          onActionClick={onActionClick}
        />
      ))}
    </div>
  );
};

const ManagerGroup: React.FC<{
  group: { managerId: string; managerName: string; members: DisplayRow[] };
  isMobile: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  timezone?: string;
  onActionClick?: (row: DisplayRow) => void;
}> = ({ group, isMobile, isAdminOrHr, currentUserId, allUsersMap, allUsers, timezone, onActionClick }) => {
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
            {totalCount} {totalCount === 1 ? 'строка' : totalCount < 5 ? 'строки' : 'строк'}
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
            {sortedMembers.map(row => (
              <RowMobileCard
                key={row.rowKey}
                row={row}
                showManager={false}
                isAdminOrHr={isAdminOrHr}
                currentUserId={currentUserId}
                allUsersMap={allUsersMap}
                allUsers={allUsers}
                indent
                timezone={timezone}
                onActionClick={onActionClick}
              />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {sortedMembers.map(row => (
                <RowDesktop
                  key={row.rowKey}
                  row={row}
                  isAdminOrHr={isAdminOrHr}
                  currentUserId={currentUserId}
                  allUsersMap={allUsersMap}
                  allUsers={allUsers}
                  indentLevel={1}
                  timezone={timezone}
                  onActionClick={onActionClick}
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
   Desktop row
   ═══════════════════════════════════════════ */

const RowDesktop: React.FC<{
  row: DisplayRow;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  indentLevel: number;
  timezone?: string;
  onActionClick?: (row: DisplayRow) => void;
}> = ({ row, isAdminOrHr, currentUserId, allUsersMap, allUsers, indentLevel, timezone, onActionClick }) => {
  const cfg = getStatusConfig(row.monitoringStatus);
  const isProblematic = isActionRequired(row.monitoringStatus);
  const subText = getSubordinationText(row, isAdminOrHr, currentUserId, allUsersMap, allUsers);
  const canClick = isProblematic && !!getActionIntent(row);

  return (
    <tr
      className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
        row.monitoringStatus === 'overdue' ? 'bg-destructive/[0.03]' : ''
      }`}
    >
      <td className={`pr-2 py-2.5 ${indentLevel > 0 ? 'pl-10' : 'pl-4'}`}>
        <div className="font-medium text-foreground">{formatUserName(row)}</div>
        {subText && (
          <div className="text-[11px] text-muted-foreground/70 leading-snug mt-0.5">{subText}</div>
        )}
        {row.lastSummarySavedBy && (
          <div className="text-[11px] text-muted-foreground/50 leading-snug">Итоги: {row.lastSummarySavedBy}</div>
        )}
      </td>
      <td className="px-2 py-2.5">
        <Badge variant="outline" className={`gap-1 text-[11px] px-2 py-0.5 font-medium ${cfg.badgeClass}`}>
          {cfg.icon}{cfg.label}
        </Badge>
      </td>
      <td className="px-2 py-2.5 text-xs text-muted-foreground">{getContextText(row, timezone)}</td>
      <td className={`pl-2 pr-4 py-2.5 text-xs ${getActionClass(row.monitoringStatus)}`}>
        {canClick ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(row);
            }}
          >
            <span>→</span>
            {getActionText(row.monitoringStatus)}
          </button>
        ) : (
          <>
            {isProblematic && <span className="mr-1">→</span>}
            {getActionText(row.monitoringStatus)}
          </>
        )}
      </td>
    </tr>
  );
};

/* ═══════════════════════════════════════════
   Mobile card
   ═══════════════════════════════════════════ */

const RowMobileCard: React.FC<{
  row: DisplayRow;
  showManager: boolean;
  isAdminOrHr: boolean;
  currentUserId?: string;
  allUsersMap?: Map<string, string>;
  allUsers: BasicUser[];
  indent?: boolean;
  timezone?: string;
  onActionClick?: (row: DisplayRow) => void;
}> = ({ row, showManager, isAdminOrHr, currentUserId, allUsersMap, allUsers, indent, timezone, onActionClick }) => {
  const cfg = getStatusConfig(row.monitoringStatus);
  const isProblematic = isActionRequired(row.monitoringStatus);
  const canClick = isProblematic && !!getActionIntent(row);
  const subText = showManager
    ? getSubordinationText(row, isAdminOrHr, currentUserId, allUsersMap, allUsers)
    : '';

  return (
    <div className={`px-3 py-2.5 space-y-1 ${indent ? 'pl-6' : ''} ${row.monitoringStatus === 'overdue' ? 'bg-destructive/5' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-foreground truncate">{formatUserName(row)}</span>
        <Badge variant="outline" className={`shrink-0 gap-1 text-[11px] px-2 py-0.5 ${cfg.badgeClass}`}>
          {cfg.icon}{cfg.label}
        </Badge>
      </div>
      {subText && <p className="text-[11px] text-muted-foreground/70">{subText}</p>}
      <p className="text-xs text-muted-foreground">{getContextText(row, timezone)}</p>
      {canClick ? (
        <button
          type="button"
          className={`text-xs ${getActionClass(row.monitoringStatus)} hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded`}
          onClick={(e) => {
            e.stopPropagation();
            onActionClick?.(row);
          }}
        >
          → {getActionText(row.monitoringStatus)}
        </button>
      ) : (
        <p className={`text-xs ${getActionClass(row.monitoringStatus)}`}>→ {getActionText(row.monitoringStatus)}</p>
      )}
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
