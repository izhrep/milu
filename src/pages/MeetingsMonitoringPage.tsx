import React, { useMemo, useState } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertTriangle, CheckCircle, Clock, MinusCircle, Users,
  CalendarCheck, CalendarClock, FileText, TrendingUp, UserCheck,
} from 'lucide-react';

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

// Period options
const now = new Date();
const periods = [
  { value: 'current_month', label: 'Текущий месяц', from: startOfMonth(now), to: endOfMonth(now) },
  { value: 'prev_month', label: 'Прошлый месяц', from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
  { value: 'current_quarter', label: 'Текущий квартал', from: startOfQuarter(now), to: endOfQuarter(now) },
  { value: 'last_90', label: 'Последние 90 дней', from: subMonths(now, 3), to: now },
];

const MeetingsMonitoringPage = () => {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr_bp';
  const { allSubtreeUsers, isDirect } = useSubordinateTree();
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');

  const period = periods.find(p => p.value === selectedPeriod) || periods[0];

  // Fetch ALL active users for admin/hr
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

  // Fetch external position IDs
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

  // Fetch user names for summary_saved_by
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

  // Employee summaries
  const employeeSummaries = useMemo(() => {
    return usersToShow.map(emp => {
      const meetings = meetingsData?.filter(m => m.employee_id === emp.id) || [];
      const hasMeetings = meetings.length > 0;
      const lastRecorded = meetings.find(m => m.status === 'recorded');
      const hasScheduled = meetings.some(m => m.status === 'scheduled');
      const hasAwaiting = meetings.some(m => m.status === 'awaiting_summary');

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
      };
    }).sort((a, b) => {
      const priority: Record<MonitoringStatus, number> = { overdue: 0, awaiting_summary: 1, scheduled: 2, not_in_cycle: 3, ok: 4 };
      const diff = priority[a.monitoringStatus] - priority[b.monitoringStatus];
      if (diff !== 0) return diff;
      return (b.daysSinceLast ?? 999) - (a.daysSinceLast ?? 999);
    });
  }, [usersToShow, meetingsData, allUsersMap, isAdminOrHr, isDirect]);

  // KPI counts
  const kpi = useMemo(() => {
    const counts = { total: 0, not_in_cycle: 0, overdue: 0, awaiting_summary: 0, scheduled: 0, ok: 0 };
    employeeSummaries.forEach(e => {
      counts.total++;
      counts[e.monitoringStatus]++;
    });
    return counts;
  }, [employeeSummaries]);

  // Meeting aggregates for the selected period
  const meetingAggregates = useMemo(() => {
    if (!meetingsData) return { scheduled: 0, awaiting_summary: 0, recorded: 0, total: 0, recordedPercent: 0 };
    const periodMeetings = meetingsData.filter(m => {
      if (!m.meeting_date) return false;
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
  }, [meetingsData, period]);

  const renderStatusBadge = (status: MonitoringStatus) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive" className="gap-1 whitespace-nowrap"><AlertTriangle className="h-3 w-3" />Просрочено</Badge>;
      case 'not_in_cycle':
        return <Badge variant="outline" className="gap-1 text-muted-foreground whitespace-nowrap"><MinusCircle className="h-3 w-3" />Встречи не начаты</Badge>;
      case 'awaiting_summary':
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-200 whitespace-nowrap"><Clock className="h-3 w-3" />Ожидает итогов</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="gap-1 whitespace-nowrap"><CalendarClock className="h-3 w-3" />Запланирована</Badge>;
      case 'ok':
        return <Badge variant="default" className="gap-1 whitespace-nowrap"><CheckCircle className="h-3 w-3" />В норме</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      {/* Header + period selector */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Мониторинг встреч one-to-one</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Регулярность и статусы встреч по сотрудникам</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[200px] bg-background">
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
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : (
        <>
          {/* KPI row — employee statuses */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={<Users className="h-4 w-4" />} label="Всего" value={kpi.total} />
            <KpiCard icon={<CheckCircle className="h-4 w-4 text-emerald-600" />} label="В норме" value={kpi.ok} accent="text-emerald-600" />
            <KpiCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Просрочено" value={kpi.overdue} accent="text-destructive" />
            <KpiCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="Ожидает итогов" value={kpi.awaiting_summary} accent="text-amber-600" />
            <KpiCard icon={<CalendarClock className="h-4 w-4 text-primary" />} label="Запланировано" value={kpi.scheduled} accent="text-primary" />
            <KpiCard icon={<MinusCircle className="h-4 w-4 text-muted-foreground" />} label="Встречи не начаты" value={kpi.not_in_cycle} />
          </div>

          {/* Meeting aggregates for period */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Встречи за период: {period.label.toLowerCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-foreground">{meetingAggregates.total}</div>
                  <div className="text-xs text-muted-foreground">Всего встреч</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{meetingAggregates.recorded}</div>
                  <div className="text-xs text-muted-foreground">Зафиксировано</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{meetingAggregates.awaiting_summary}</div>
                  <div className="text-xs text-muted-foreground">Ожидает итогов</div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{meetingAggregates.recordedPercent}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Доля зафиксированных</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee table */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Сотрудники ({employeeSummaries.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {employeeSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Нет сотрудников для мониторинга</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Сотрудник</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Статус</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Последняя встреча</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Дней назад</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Детали</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Автор итогов</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeSummaries.map(emp => (
                        <tr
                          key={emp.id}
                          className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${emp.monitoringStatus === 'overdue' ? 'bg-destructive/5' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{formatUserName(emp)}</span>
                              {!isAdminOrHr && !emp.isDirect && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">непрямой</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {renderStatusBadge(emp.monitoringStatus)}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                            {emp.lastMeetingDate
                              ? format(emp.lastMeetingDate, 'd MMM yyyy', { locale: ru })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-right tabular-nums">
                            {emp.daysSinceLast !== null ? (
                              <span className={emp.daysSinceLast > REGULARITY_THRESHOLD_DAYS ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                {emp.daysSinceLast}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {emp.hasScheduled && (
                                <span className="flex items-center gap-0.5"><CalendarClock className="h-3 w-3" /> план</span>
                              )}
                              {emp.hasAwaiting && (
                                <span className="flex items-center gap-0.5 text-amber-600"><Clock className="h-3 w-3" /> итоги</span>
                              )}
                              {!emp.hasScheduled && !emp.hasAwaiting && emp.monitoringStatus !== 'not_in_cycle' && (
                                <span>—</span>
                              )}
                              {emp.monitoringStatus === 'not_in_cycle' && (
                                <span>нет встреч</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[150px]">
                            {emp.lastSummarySavedBy || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// Small KPI card component
const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: number; accent?: string }> = ({ icon, label, value, accent }) => (
  <Card className="border-border/50">
    <CardContent className="pt-4 pb-3 px-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent || 'text-foreground'}`}>{value}</div>
    </CardContent>
  </Card>
);

export default MeetingsMonitoringPage;
