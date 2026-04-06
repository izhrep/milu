import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Clock, CheckCircle, FileText, History, CalendarClock, Trash2 } from 'lucide-react';
import { RescheduleMeetingDialog } from '@/components/RescheduleMeetingDialog';
import { useOneOnOneMeetings } from '@/hooks/useOneOnOneMeetings';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { useAllEmployeesForMeetings } from '@/hooks/useAllEmployeesForMeetings';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingForm } from '@/components/MeetingForm';
import { CreateMeetingDialog } from '@/components/CreateMeetingDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DeleteMeetingDialog } from '@/components/DeleteMeetingDialog';
const formatUserName = (u: { first_name: string | null; last_name: string | null }) =>
  [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени';

/**
 * Compute effective meeting status client-side.
 * If DB says 'scheduled' but meeting_date is in the past and no summary — treat as 'awaiting_summary'.
 */
const getEffectiveStatus = (meeting: { status: string; meeting_date: string | null; meeting_summary: string | null }): string => {
  if (meeting.status === 'recorded') return 'recorded';
  if (meeting.status === 'scheduled' && meeting.meeting_date && !meeting.meeting_summary) {
    const meetingTime = new Date(meeting.meeting_date).getTime();
    if (!Number.isNaN(meetingTime) && meetingTime <= Date.now()) {
      return 'awaiting_summary';
    }
  }
  return meeting.status;
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
    scheduled: { label: 'Запланирована', variant: 'secondary', icon: Clock },
    awaiting_summary: { label: 'Ожидает итогов', variant: 'destructive', icon: FileText },
    recorded: { label: 'Зафиксирована', variant: 'default', icon: CheckCircle },
  };
  const config = statusMap[status] || statusMap.scheduled;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const MeetingCardsSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="border-0 shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const MeetingsPage = () => {
  const { user } = useAuth();
  useMinuteTick(); // Force re-render every 60s so getEffectiveStatus() picks up time changes

  // Permissions
  const { hasPermission: canViewSubordinateMeetings, isLoading: permLoading } = usePermission('team.view');
  const { hasPermission: canViewAllMeetings, isLoading: permAllLoading } = usePermission('meetings.view_all');
  const { hasPermission: canDeleteMeetings } = usePermission('meetings.delete');

  // Manager subtree data (existing flow)
  const { subordinates, isManager, isLoading: subordinatesLoading } = useSubordinates();
  const { allSubtreeUsers, isDirect, isLoading: subtreeLoading } = useSubordinateTree();

  // Admin/HR all-employees data (new flow)
  const { employees: allEmployees, isLoading: allEmployeesLoading } = useAllEmployeesForMeetings(canViewAllMeetings);

  const [activeTab, setActiveTab] = useState<string>('my-meetings');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedAllEmployeeId, setSelectedAllEmployeeId] = useState<string>('');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string>('');
  const [selectedAllManagerFilter, setSelectedAllManagerFilter] = useState<string>('');

  // ─── Manager subordinate selector ───
  const selectorUsers = allSubtreeUsers.map(u => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    isDirect: isDirect(u.id),
    manager_id: u.manager_id,
  }));
  const subordinateIds = selectorUsers.map(s => s.id);

  // Detect if current user has indirect reports (manager+1 scenario)
  const hasIndirectReports = selectorUsers.some(u => !u.isDirect);

  // For manager+1: list of direct reports who are themselves managers (have subordinates in subtree)
  const managerFilterOptions = useMemo(() => {
    if (!hasIndirectReports || !user) return [];
    const directReports = selectorUsers.filter(u => u.isDirect);
    // A direct report is a "sub-manager" if any other subtree user has them as manager_id
    const subManagerIds = new Set(
      selectorUsers.filter(u => !u.isDirect).map(u => u.manager_id).filter(Boolean)
    );
    return directReports.filter(u => subManagerIds.has(u.id));
  }, [selectorUsers, hasIndirectReports, user]);

  // Employees for the selected manager filter (manager+1 tab)
  const filteredSubordinateEmployees = useMemo(() => {
    if (!hasIndirectReports) {
      // Simple manager: show all direct reports flat
      return selectorUsers;
    }
    if (!selectedManagerFilter) return [];
    // Show direct reports of the selected sub-manager
    return selectorUsers.filter(u => u.manager_id === selectedManagerFilter);
  }, [selectorUsers, selectedManagerFilter, hasIndirectReports]);

  // Auto-select first manager filter for manager+1
  useEffect(() => {
    if (!hasIndirectReports || selectedManagerFilter || !user) return;
    // Default: current user (shows own direct reports)
    setSelectedManagerFilter(user.id);
  }, [hasIndirectReports, selectedManagerFilter, user]);

  // Reset employee when manager filter changes
  useEffect(() => {
    if (hasIndirectReports) {
      setSelectedEmployeeId('');
    }
  }, [selectedManagerFilter, hasIndirectReports]);

  // ─── Admin/HR: build manager list and employee list ───
  const allManagerOptions = useMemo(() => {
    if (!allEmployees.length) return [];
    // Managers = users who appear as manager_id of at least one employee
    const managerIds = new Set(allEmployees.map(e => e.manager_id).filter(Boolean) as string[]);
    // Include current user if they are a manager of someone
    const allUsersMap = new Map(allEmployees.map(e => [e.id, e]));
    // Also check if current user is someone's manager
    if (user && managerIds.has(user.id) && !allUsersMap.has(user.id)) {
      // Current user might not be in allEmployees (they're excluded), add them
      return [
        { id: user.id, first_name: user.first_name ?? null, last_name: user.last_name ?? null },
        ...allEmployees.filter(e => managerIds.has(e.id)).sort((a, b) => formatUserName(a).localeCompare(formatUserName(b))),
      ];
    }
    return allEmployees
      .filter(e => managerIds.has(e.id))
      .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));
  }, [allEmployees, user]);

  const filteredAllEmployees = useMemo(() => {
    if (!selectedAllManagerFilter || !allEmployees.length) return [];
    return allEmployees
      .filter(e => e.manager_id === selectedAllManagerFilter)
      .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b)));
  }, [allEmployees, selectedAllManagerFilter]);

  // Latest activity for subordinate auto-select (existing)
  const { data: latestActivity } = useQuery({
    queryKey: ['subordinate-meeting-activity', subordinateIds],
    queryFn: async () => {
      if (subordinateIds.length === 0) return [];
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('employee_id, updated_at')
        .in('employee_id', subordinateIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: subordinateIds.length > 0,
  });

  // Latest activity for all-employees auto-select (admin/hr)
  const allEmployeeIds = useMemo(() => allEmployees.map(e => e.id), [allEmployees]);
  const { data: allEmployeesActivity } = useQuery({
    queryKey: ['all-employees-meeting-activity', allEmployeeIds],
    queryFn: async () => {
      if (allEmployeeIds.length === 0) return [];
      // Fetch in batches if needed (Supabase .in() limit)
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('employee_id, updated_at')
        .in('employee_id', allEmployeeIds.slice(0, 500))
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canViewAllMeetings && allEmployeeIds.length > 0,
  });

  // Auto-select subordinate employee
  useEffect(() => {
    if (filteredSubordinateEmployees.length === 0 || selectedEmployeeId) return;
    // Check if selectedEmployeeId is still valid
    if (selectedEmployeeId && !filteredSubordinateEmployees.find(u => u.id === selectedEmployeeId)) {
      setSelectedEmployeeId('');
      return;
    }
    if (latestActivity && latestActivity.length > 0) {
      const activityMap = new Map<string, string>();
      for (const row of latestActivity) {
        if (!activityMap.has(row.employee_id)) {
          activityMap.set(row.employee_id, row.updated_at);
        }
      }
      const sorted = [...filteredSubordinateEmployees].sort((a, b) => {
        const aTime = activityMap.get(a.id) || '';
        const bTime = activityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) { const cmp = bTime.localeCompare(aTime); if (cmp !== 0) return cmp; }
        return [a.last_name, a.first_name].filter(Boolean).join(' ').localeCompare([b.last_name, b.first_name].filter(Boolean).join(' '));
      });
      setSelectedEmployeeId(sorted[0].id);
    } else if (latestActivity !== undefined) {
      setSelectedEmployeeId(filteredSubordinateEmployees[0].id);
    }
  }, [filteredSubordinateEmployees, selectedEmployeeId, latestActivity]);

  // Auto-select manager filter for admin/hr tab
  useEffect(() => {
    if (!canViewAllMeetings || selectedAllManagerFilter || allManagerOptions.length === 0) return;
    // Default to first manager with recent activity, or just first
    if (allEmployeesActivity && allEmployeesActivity.length > 0) {
      // Find which manager has the most recent subordinate activity
      const managerSet = new Set(allManagerOptions.map(m => m.id));
      const managerActivityMap = new Map<string, string>();
      for (const row of allEmployeesActivity) {
        const emp = allEmployees.find(e => e.id === row.employee_id);
        if (emp?.manager_id && managerSet.has(emp.manager_id) && !managerActivityMap.has(emp.manager_id)) {
          managerActivityMap.set(emp.manager_id, row.updated_at);
        }
      }
      const sorted = [...allManagerOptions].sort((a, b) => {
        const aTime = managerActivityMap.get(a.id) || '';
        const bTime = managerActivityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) return bTime.localeCompare(aTime);
        return formatUserName(a).localeCompare(formatUserName(b));
      });
      setSelectedAllManagerFilter(sorted[0].id);
    } else if (allEmployeesActivity !== undefined) {
      setSelectedAllManagerFilter(allManagerOptions[0].id);
    }
  }, [allManagerOptions, selectedAllManagerFilter, canViewAllMeetings, allEmployeesActivity, allEmployees]);

  // Auto-select employee for admin/hr tab when manager filter changes
  useEffect(() => {
    if (!selectedAllManagerFilter) { setSelectedAllEmployeeId(''); return; }
    const employees = filteredAllEmployees;
    if (employees.length === 0) { setSelectedAllEmployeeId(''); return; }
    // Pick first employee with recent activity
    if (allEmployeesActivity && allEmployeesActivity.length > 0) {
      const activityMap = new Map<string, string>();
      for (const row of allEmployeesActivity) {
        if (!activityMap.has(row.employee_id)) activityMap.set(row.employee_id, row.updated_at);
      }
      const sorted = [...employees].sort((a, b) => {
        const aTime = activityMap.get(a.id) || '';
        const bTime = activityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) return bTime.localeCompare(aTime);
        return formatUserName(a).localeCompare(formatUserName(b));
      });
      setSelectedAllEmployeeId(sorted[0].id);
    } else {
      setSelectedAllEmployeeId(employees[0].id);
    }
  }, [selectedAllManagerFilter, filteredAllEmployees, allEmployeesActivity]);

  // Default tab based on permissions and actual data availability
  useEffect(() => {
    if (permLoading || permAllLoading) return;
    if (canViewAllMeetings) {
      setActiveTab('all-meetings');
    } else if (canViewSubordinateMeetings && selectorUsers.length > 0) {
      setActiveTab('subordinate-meetings');
    } else {
      setActiveTab('my-meetings');
    }
  }, [permLoading, permAllLoading, canViewSubordinateMeetings, canViewAllMeetings, selectorUsers.length]);

  const { meetings: myMeetingsRaw, isLoading: myMeetingsLoading, createMeetingAsync } = useOneOnOneMeetings();
  const { meetings: subordinateMeetings, isLoading: subMeetingsLoading } = useOneOnOneMeetings(
    selectedEmployeeId ? { employeeId: selectedEmployeeId } : undefined
  );
  const { meetings: allEmployeeMeetings, isLoading: allMeetingsLoading } = useOneOnOneMeetings(
    selectedAllEmployeeId ? { employeeId: selectedAllEmployeeId } : undefined
  );


  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingId, setNewMeetingId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ id: string; date: string; employeeId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [prefillEmployeeId, setPrefillEmployeeId] = useState<string>('');
  const [prefillManagerId, setPrefillManagerId] = useState<string>('');

  // Auto-open meeting from URL query param (e.g. from task card)
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenHandled = useRef(false);

  useEffect(() => {
    // Support both ?meetingId= (task cards) and ?meeting= (notification links)
    const meetingId = searchParams.get('meetingId') || searchParams.get('meeting');
    const shouldCreateMeeting = searchParams.get('createMeeting') === '1';
    const employeeId = searchParams.get('employeeId') || '';
    const managerId = searchParams.get('managerId') || '';

    if (meetingId && !autoOpenHandled.current) {
      autoOpenHandled.current = true;
      setSelectedMeeting(meetingId);
      setIsFormOpen(true);
    } else if (shouldCreateMeeting && !autoOpenHandled.current) {
      autoOpenHandled.current = true;
      setPrefillEmployeeId(employeeId);
      setPrefillManagerId(managerId);
      setIsCreateOpen(true);
    }

    if ((meetingId || shouldCreateMeeting) && autoOpenHandled.current) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('meetingId');
      nextParams.delete('meeting');
      nextParams.delete('createMeeting');
      nextParams.delete('employeeId');
      nextParams.delete('managerId');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { rescheduleMeeting, deleteMeeting, isDeletingMeeting } = useOneOnOneMeetings();

  const handleCreateMeeting = async (params: { employee_id: string; manager_id: string; stage_id?: string | null; meeting_date: string }) => {
    const result = await createMeetingAsync(params);
    if (result?.id) {
      setNewMeetingId(result.id);
      setSelectedMeeting(null);
      setIsFormOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setIsFormOpen(false);
    setSelectedMeeting(null);
    setNewMeetingId(null);
  };

  const myMeetings = myMeetingsRaw?.filter(m => m.employee_id === user?.id);

  const getButtonLabel = (effectiveStatus: string, isHistorical: boolean) => {
    if (isHistorical) return 'Просмотр';
    switch (effectiveStatus) {
      case 'awaiting_summary': return 'Заполнить итоги';
      default: return 'Открыть';
    }
  };

  // ─── Shared meeting card renderer ───
  const renderMeetingCard = (
    meeting: typeof subordinateMeetings extends (infer T)[] | undefined ? T : never,
    index: number,
    total: number,
    options: { isManager?: boolean; isHistorical?: boolean }
  ) => {
    const isHistorical = options.isHistorical ?? (options.isManager ? meeting.manager_id !== user?.id : false);
    const effectiveStatus = getEffectiveStatus(meeting);

    return (
      <Card key={meeting.id} className="border-0 shadow-card hover:shadow-card-hover transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">
                Встреча {total - index}
                {meeting.meeting_date && (
                  <span className="font-normal text-muted-foreground ml-2">
                      — {formatMeetingDateFull(meeting.meeting_date, user?.timezone)}
                    </span>
                )}
              </h3>
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(effectiveStatus)}
                {isHistorical && (
                  <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                    <History className="h-3 w-3" />
                    Историческая
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isHistorical && effectiveStatus === 'awaiting_summary' ? (
                <>
                  <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) setSelectedMeeting(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                        Открыть и заполнить итоги
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {options.isManager ? 'Встреча one-to-one — Сотрудник' : 'Встреча one-to-one'}
                        </DialogTitle>
                      </DialogHeader>
                      <MeetingForm
                        meetingId={meeting.id}
                        isManager={options.isManager && !isHistorical}
                        onClose={() => setIsFormOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1.5"
                    onClick={() => setRescheduleTarget({ id: meeting.id, date: meeting.meeting_date || '', employeeId: meeting.employee_id })}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Перенести
                  </Button>
                </>
              ) : (
                <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                  setIsFormOpen(open);
                  if (!open) setSelectedMeeting(null);
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                      {getButtonLabel(effectiveStatus, isHistorical)}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {options.isManager ? 'Встреча one-to-one — Сотрудник' : 'Встреча one-to-one'}
                      </DialogTitle>
                    </DialogHeader>
                    <MeetingForm
                      meetingId={meeting.id}
                      isManager={options.isManager && !isHistorical}
                      onClose={() => setIsFormOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
               )}
              {canDeleteMeetings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => setDeleteTarget(meeting.id)}
                  title="Удалить встречу"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const permissionsLoading = permLoading || permAllLoading;

  // Derived loading states per tab
  const isMyTabLoading = permissionsLoading || myMeetingsLoading;
  const isSubTabLoading = permissionsLoading || subtreeLoading || !selectedEmployeeId || subMeetingsLoading;
  const isAllTabLoading = permissionsLoading || allEmployeesLoading || !selectedAllManagerFilter || !selectedAllEmployeeId || allMeetingsLoading;

  // Determine which tabs to show — manager tab only for users who have subordinates (not for admin/hr without subordinates)
  const showManagerTab = canViewSubordinateMeetings && selectorUsers.length > 0;
  const showAllMeetingsTab = canViewAllMeetings;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Встречи one-to-one</h1>
          <p className="text-muted-foreground mt-1"><p className="text-muted-foreground mt-1">Планирование и история встреч с лидом</p></p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать встречу
        </Button>
      </div>

      <CreateMeetingDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setPrefillEmployeeId('');
            setPrefillManagerId('');
          }
        }}
        onCreateMeeting={handleCreateMeeting}
        initialEmployeeId={prefillEmployeeId || undefined}
        initialManagerId={prefillManagerId || undefined}
      />

      <Dialog open={isFormOpen && newMeetingId !== null} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая встреча one-to-one</DialogTitle>
          </DialogHeader>
          {newMeetingId && (
            <MeetingForm meetingId={newMeetingId} onClose={handleCloseDialog} />
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {permissionsLoading ? (
          <Skeleton className="h-10 w-80 rounded-lg" />
        ) : (
          <TabsList>
            {showAllMeetingsTab && (
              <TabsTrigger value="all-meetings">Встречи сотрудников</TabsTrigger>
            )}
            {showManagerTab && (
              <TabsTrigger value="subordinate-meetings">Встречи с моими сотрудниками</TabsTrigger>
            )}
            <TabsTrigger value="my-meetings">Мои встречи с руководителем</TabsTrigger>
          </TabsList>
        )}

        {/* ─── My Meetings tab (all users) ─── */}
        <TabsContent value="my-meetings" className="space-y-4">
          {isMyTabLoading ? (
            <MeetingCardsSkeleton count={3} />
          ) : myMeetings && myMeetings.length > 0 ? (
            <div className="grid gap-4">
              {myMeetings.map((meeting, index) => (
                <Card key={meeting.id} className="border-0 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2">
                          Встреча {myMeetings.length - index}
                          {meeting.meeting_date && (
                            <span className="font-normal text-muted-foreground ml-2">
                              — {formatMeetingDateFull(meeting.meeting_date, user?.timezone)}
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(getEffectiveStatus(meeting))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEffectiveStatus(meeting) === 'awaiting_summary' ? (
                          <>
                            <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                              setIsFormOpen(open);
                              if (!open) setSelectedMeeting(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                                  Открыть и заполнить итоги
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Встреча one-to-one</DialogTitle>
                                </DialogHeader>
                                <MeetingForm meetingId={meeting.id} onClose={() => setIsFormOpen(false)} />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground gap-1.5"
                              onClick={() => setRescheduleTarget({ id: meeting.id, date: meeting.meeting_date || '', employeeId: meeting.employee_id })}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              Перенести
                            </Button>
                          </>
                        ) : (
                          <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                            setIsFormOpen(open);
                            if (!open) setSelectedMeeting(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                                {getButtonLabel(getEffectiveStatus(meeting), false)}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Встреча one-to-one</DialogTitle>
                              </DialogHeader>
                              <MeetingForm meetingId={meeting.id} onClose={() => setIsFormOpen(false)} />
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-card">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Нет созданных встреч</p>
                <Button onClick={() => setIsCreateOpen(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Создать первую встречу
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Manager: Subordinate Meetings tab ─── */}
        {showManagerTab && (
          <TabsContent value="subordinate-meetings" className="space-y-4">
            {subtreeLoading ? (
              <MeetingCardsSkeleton count={3} />
            ) : (
            <>
            {selectorUsers.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Manager filter — only for manager+1 */}
                {hasIndirectReports && (
                  <>
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Лид:</label>
                    <Select value={selectedManagerFilter} onValueChange={setSelectedManagerFilter}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Выберите лида" />
                      </SelectTrigger>
                      <SelectContent>
                        {user && (
                          <SelectItem value={user.id}>
                            {formatUserName({ first_name: user.first_name ?? null, last_name: user.last_name ?? null })} (я)
                          </SelectItem>
                        )}
                        {managerFilterOptions.map(mgr => (
                          <SelectItem key={mgr.id} value={mgr.id}>
                            {formatUserName(mgr)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Сотрудник:</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubordinateEmployees.map(sub => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {formatUserName(sub)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!selectedEmployeeId || subMeetingsLoading ? (
              <MeetingCardsSkeleton count={3} />
            ) : subordinateMeetings && subordinateMeetings.length > 0 ? (
              <div className="grid gap-4">
                {subordinateMeetings.map((meeting, index) =>
                  renderMeetingCard(meeting, index, subordinateMeetings.length, {
                    isManager: true,
                    isHistorical: meeting.manager_id !== user?.id,
                  })
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Нет встреч у выбранного сотрудника</p>
                </CardContent>
              </Card>
            )}
            </>
            )}
          </TabsContent>
        )}

        {/* ─── Admin/HR: All Employee Meetings tab ─── */}
        {showAllMeetingsTab && (
          <TabsContent value="all-meetings" className="space-y-4">
            {allEmployeesLoading ? (
              <MeetingCardsSkeleton count={3} />
            ) : (
            <>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Лид:</label>
              <Select value={selectedAllManagerFilter} onValueChange={setSelectedAllManagerFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={allEmployeesLoading ? 'Загрузка...' : 'Выберите лида'} />
                </SelectTrigger>
                <SelectContent>
                  {allManagerOptions.map(mgr => (
                    <SelectItem key={mgr.id} value={mgr.id}>
                      {formatUserName(mgr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Сотрудник:</label>
              <Select value={selectedAllEmployeeId} onValueChange={setSelectedAllEmployeeId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={!selectedAllManagerFilter ? 'Сначала выберите руководителя' : 'Выберите сотрудника'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAllEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {formatUserName(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedAllEmployeeId || allMeetingsLoading ? (
              <MeetingCardsSkeleton count={3} />
            ) : allEmployeeMeetings && allEmployeeMeetings.length > 0 ? (
              <div className="grid gap-4">
                {allEmployeeMeetings.map((meeting, index) =>
                  renderMeetingCard(meeting, index, allEmployeeMeetings.length, {
                    isManager: false,
                  })
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Нет встреч у выбранного сотрудника</p>
                </CardContent>
              </Card>
            )}
            </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {rescheduleTarget && (
        <RescheduleMeetingDialog
          open={!!rescheduleTarget}
          onOpenChange={(open) => { if (!open) setRescheduleTarget(null); }}
          meetingId={rescheduleTarget.id}
          currentMeetingDate={rescheduleTarget.date}
          employeeId={rescheduleTarget.employeeId}
          onReschedule={rescheduleMeeting}
        />
      )}

      <DeleteMeetingDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMeeting(deleteTarget);
            // Close form if the deleted meeting was open
            if (selectedMeeting === deleteTarget) {
              setIsFormOpen(false);
              setSelectedMeeting(null);
            }
          } finally {
            setDeleteTarget(null);
          }
        }}
        isDeleting={isDeletingMeeting}
      />
    </div>
  );
};

export default MeetingsPage;
