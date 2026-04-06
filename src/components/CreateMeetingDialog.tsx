import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Search } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { Loader2 } from 'lucide-react';
import { validateMeetingCreation, getFieldError, type MeetingValidationError } from '@/lib/meetingValidation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { localDateTimeToUtcIso, getEffectiveTimezone, getTimezoneOffsetLabel, getMinTimeForDate } from '@/lib/meetingDateTime';

const MAX_INCOMPLETE_MEETINGS = 2;

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMeeting: (params: { employee_id: string; manager_id: string; stage_id?: string | null; meeting_date: string }) => Promise<any>;
  stageId?: string | null;
  initialEmployeeId?: string;
  initialManagerId?: string;
}

const formatUserName = (u: { first_name: string | null; last_name: string | null }) =>
  [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени';

export const CreateMeetingDialog: React.FC<CreateMeetingDialogProps> = ({
  open,
  onOpenChange,
  onCreateMeeting,
  stageId,
  initialEmployeeId,
  initialManagerId,
}) => {
  const { user } = useAuth();
  const { hasPermission: canViewAll } = usePermission('meetings.view_all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>('');
  const [meetingTime, setMeetingTime] = useState<string>('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const isHrOrAdmin = canViewAll;

  // Subtree data for manager/manager+1 scenarios
  const { allSubtreeUsers, isDirect, isLoading: subtreeLoading } = useSubordinateTree();

  const isManager = allSubtreeUsers.length > 0;

  // Employee list: all subtree users (direct + indirect)
  const employeeOptions = useMemo(() => {
    if (!user || isHrOrAdmin) return [];
    const options = allSubtreeUsers.map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: (u as any).email ?? '',
      manager_id: u.manager_id,
      direct: isDirect(u.id),
    }));
    if (!managerSearchQuery.trim()) return options;
    const q = managerSearchQuery.toLowerCase().trim();
    return options.filter(u => {
      const fullName = [u.last_name, u.first_name].filter(Boolean).join(' ').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return fullName.includes(q) || email.includes(q);
    });
  }, [allSubtreeUsers, isDirect, user, isHrOrAdmin, managerSearchQuery]);

  // Manager options depend on selected employee
  const managerOptions = useMemo(() => {
    if (!user || !selectedEmployee || isHrOrAdmin) return [];
    const emp = allSubtreeUsers.find(u => u.id === selectedEmployee);
    if (!emp) return [];

    const isDirectReport = isDirect(selectedEmployee);

    if (isDirectReport) {
      return [{ id: user.id, first_name: user.first_name ?? null, last_name: user.last_name ?? null }];
    }

    if (emp.manager_id) {
      const directMgr = allSubtreeUsers.find(u => u.id === emp.manager_id);
      if (directMgr) {
        return [{
          id: directMgr.id,
          first_name: directMgr.first_name,
          last_name: directMgr.last_name,
        }];
      }
    }

    return [{ id: user.id, first_name: user.first_name ?? null, last_name: user.last_name ?? null }];
  }, [selectedEmployee, allSubtreeUsers, isDirect, user, isHrOrAdmin]);

  const managerSelectorDisabled = managerOptions.length <= 1 && !isHrOrAdmin;

  // Auto-select manager when employee changes
  useEffect(() => {
    if (isHrOrAdmin) return;
    if (!selectedEmployee) {
      setSelectedManager('');
      return;
    }
    const isDirectReport = isDirect(selectedEmployee);
    if (isDirectReport && user) {
      setSelectedManager(user.id);
    } else {
      const emp = allSubtreeUsers.find(u => u.id === selectedEmployee);
      if (emp?.manager_id) {
        setSelectedManager(emp.manager_id);
      } else if (user) {
        setSelectedManager(user.id);
      }
    }
  }, [selectedEmployee, isDirect, allSubtreeUsers, user, isHrOrAdmin]);

  // --- Fallback for non-manager, non-HR users (employee creating meeting with their own manager) ---
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-manager', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('users')
        .select('id, manager_id, first_name, last_name')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user && !isManager && !isHrOrAdmin,
  });

  const { data: managerData } = useQuery({
    queryKey: ['manager-name', currentUserData?.manager_id],
    queryFn: async () => {
      if (!currentUserData?.manager_id) return null;
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('id', currentUserData.manager_id)
        .single();
      return data;
    },
    enabled: !!currentUserData?.manager_id,
  });

  const { data: potentialManagers } = useQuery({
    queryKey: ['potential-managers'],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .neq('id', user.id)
        .order('last_name');
      return data || [];
    },
    enabled: !!user && !isManager && !isHrOrAdmin && !currentUserData?.manager_id,
  });

  const needsManualManagerSelect = !isManager && !isHrOrAdmin && !currentUserData?.manager_id;

  // --- HR/Admin: all users with manager_id (org-linked only) ---
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-meeting'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, manager_id')
        .eq('status', true)
        .order('last_name');
      return data || [];
    },
    enabled: isHrOrAdmin,
  });

  // Task 2: HRBP restricted to existing org links only
  // Employees that have a manager_id set
  const hrEmployeeOptions = useMemo(() => {
    if (!isHrOrAdmin || !allUsers) return [];
    return allUsers.filter(u => !!u.manager_id);
  }, [isHrOrAdmin, allUsers]);

  const filteredHrEmployees = useMemo(() => {
    if (!searchQuery.trim()) return hrEmployeeOptions;
    const q = searchQuery.toLowerCase().trim();
    return hrEmployeeOptions.filter(u => {
      const fullName = [u.last_name, u.first_name].filter(Boolean).join(' ').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return fullName.includes(q) || email.includes(q);
    });
  }, [hrEmployeeOptions, searchQuery]);

  // Task 2: Auto-set manager from employee's org link
  useEffect(() => {
    if (!isHrOrAdmin || !selectedEmployee || !allUsers) return;
    const emp = allUsers.find(u => u.id === selectedEmployee);
    if (emp?.manager_id) {
      setSelectedManager(emp.manager_id);
    } else {
      setSelectedManager('');
    }
  }, [isHrOrAdmin, selectedEmployee, allUsers]);

  useEffect(() => {
    if (!open) return;

    if (initialEmployeeId) {
      setSelectedEmployee(initialEmployeeId);
    }

    if (initialManagerId) {
      setSelectedManager(initialManagerId);
    }
  }, [open, initialEmployeeId, initialManagerId]);

  // Resolve the manager name for display
  const hrSelectedManagerName = useMemo(() => {
    if (!isHrOrAdmin || !selectedManager || !allUsers) return null;
    const mgr = allUsers.find(u => u.id === selectedManager);
    return mgr ? formatUserName(mgr) : null;
  }, [isHrOrAdmin, selectedManager, allUsers]);

  const handleCreate = async () => {
    if (!meetingDate) return;

    let employeeId: string;
    let managerId: string;

    if (isHrOrAdmin) {
      if (!selectedEmployee || !selectedManager) return;
      employeeId = selectedEmployee;
      managerId = selectedManager;
    } else if (isManager) {
      if (!selectedEmployee || !selectedManager) return;
      employeeId = selectedEmployee;
      managerId = selectedManager;
    } else if (needsManualManagerSelect) {
      if (!selectedManager) return;
      employeeId = user!.id;
      managerId = selectedManager;
    } else {
      if (!currentUserData?.manager_id) return;
      employeeId = user!.id;
      managerId = currentUserData.manager_id;
    }

    setIsSubmitting(true);
    try {
      const userTz = getEffectiveTimezone(user?.timezone);
      const meetingDateUtc = localDateTimeToUtcIso(meetingDate, meetingTime, userTz);
      await onCreateMeeting({
        employee_id: employeeId,
        manager_id: managerId,
        stage_id: stageId || null,
        meeting_date: meetingDateUtc,
      });
      onOpenChange(false);
      resetForm();
    } catch {
      // error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployee('');
    setSelectedManager('');
    setMeetingDate('');
    setMeetingTime('10:00');
    setSearchQuery('');
    setManagerSearchQuery('');
  };

  // Resolve effective employee/manager IDs for validation
  const effectiveEmployeeId = useMemo(() => {
    if (isHrOrAdmin || isManager) return selectedEmployee;
    if (needsManualManagerSelect) return user?.id;
    return user?.id;
  }, [isHrOrAdmin, isManager, needsManualManagerSelect, selectedEmployee, user]);

  const effectiveManagerId = useMemo(() => {
    if (isHrOrAdmin || isManager || needsManualManagerSelect) return selectedManager;
    return currentUserData?.manager_id || '';
  }, [isHrOrAdmin, isManager, needsManualManagerSelect, selectedManager, currentUserData]);

  // Task 10: Unified incomplete meetings count — only scheduled/awaiting_summary
  const { data: incompleteMeetingsCount } = useQuery({
    queryKey: ['incomplete-meetings-count', effectiveEmployeeId],
    queryFn: async () => {
      if (!effectiveEmployeeId) return 0;
      const { count, error } = await supabase
        .from('one_on_one_meetings')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', effectiveEmployeeId)
        .in('status', ['scheduled', 'awaiting_summary']);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!effectiveEmployeeId,
  });

  const meetingLimitReached = (incompleteMeetingsCount ?? 0) >= MAX_INCOMPLETE_MEETINGS;

  const validationErrors = useMemo<MeetingValidationError[]>(() =>
    validateMeetingCreation({
      date: meetingDate,
      time: meetingTime,
      employeeId: effectiveEmployeeId || undefined,
      managerId: effectiveManagerId || undefined,
    }),
  [meetingDate, meetingTime, effectiveEmployeeId, effectiveManagerId]);

  const dateError = getFieldError(validationErrors, 'date');
  const timeError = getFieldError(validationErrors, 'time');
  const participantsError = getFieldError(validationErrors, 'participants');

  const canSubmit = () => {
    if (meetingLimitReached) return false;
    if (validationErrors.length > 0) return false;
    if (!meetingDate || !meetingTime) return false;
    if (isHrOrAdmin) return !!selectedEmployee && !!selectedManager;
    if (isManager) return !!selectedEmployee && !!selectedManager;
    if (needsManualManagerSelect) return !!selectedManager;
    return !!currentUserData?.manager_id;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать встречу one-to-one</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Дата и время встречи *
              <span className="text-xs font-normal text-muted-foreground">
                ({getTimezoneOffsetLabel(getEffectiveTimezone(user?.timezone))})
              </span>
            </Label>
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !meetingDate && "text-muted-foreground",
                      dateError && "border-destructive",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {meetingDate
                      ? format(parse(meetingDate, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy', { locale: ru })
                      : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={meetingDate ? parse(meetingDate, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(d) => d && setMeetingDate(format(d, 'yyyy-MM-dd'))}
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
                value={meetingTime}
                onChange={(v) => setMeetingTime(v)}
                minTime={getMinTimeForDate(meetingDate, getEffectiveTimezone(user?.timezone))}
              />
            </div>
            {(dateError || timeError) && (
              <p className="text-xs text-destructive">{dateError || timeError}</p>
            )}
          </div>

          {/* === Non-manager, non-HR: employee creates meeting with own manager === */}
          {!isManager && !isHrOrAdmin && !needsManualManagerSelect && (
            <div className="text-sm text-muted-foreground">
              Встреча будет создана с вашим руководителем
              {managerData ? (
                <span className="font-medium text-foreground"> — {formatUserName(managerData)}</span>
              ) : null}.
            </div>
          )}

          {needsManualManagerSelect && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">
                У вас не назначен руководитель. Выберите руководителя для встречи:
              </div>
              <Label>Руководитель</Label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите руководителя" />
                </SelectTrigger>
                <SelectContent>
                  {potentialManagers?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{formatUserName(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* === Manager (subtree-based) === */}
          {isManager && !isHrOrAdmin && (
            <>
              <div className="space-y-2">
                <Label>Сотрудник</Label>
                <Select value={selectedEmployee} onValueChange={(v) => { setSelectedEmployee(v); setManagerSearchQuery(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={subtreeLoading ? 'Загрузка...' : 'Выберите сотрудника'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Поиск по ФИО или email..."
                          value={managerSearchQuery}
                          onChange={(e) => setManagerSearchQuery(e.target.value)}
                          className="pl-7 h-9"
                          autoComplete="off"
                          autoCorrect="off"
                          data-1p-ignore
                          data-lpignore="true"
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {employeeOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Не найдено</div>
                    ) : (
                      employeeOptions.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {formatUserName(emp)}
                          {!emp.direct && (
                            <span className="ml-1 text-xs text-muted-foreground">(непрямой)</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmployee && (
                <div className="space-y-2">
                  <Label>Руководитель</Label>
                  {managerSelectorDisabled ? (
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                      {managerOptions[0] ? formatUserName(managerOptions[0]) : '—'}
                    </div>
                  ) : (
                    <Select value={selectedManager} onValueChange={setSelectedManager}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите руководителя" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerOptions.map(u => (
                          <SelectItem key={u.id} value={u.id}>{formatUserName(u)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          {/* === HR/Admin: org-linked pairs only (Task 1 & 2) === */}
          {isHrOrAdmin && (
            <>
              <div className="space-y-2">
                <Label>Сотрудник</Label>
                <Select value={selectedEmployee} onValueChange={(v) => { setSelectedEmployee(v); setSearchQuery(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Поиск по ФИО или email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-7 h-9"
                          autoComplete="off"
                          autoCorrect="off"
                          data-1p-ignore
                          data-lpignore="true"
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {filteredHrEmployees.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Не найдено</div>
                    ) : (
                      filteredHrEmployees.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {formatUserName(u)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {/* Task 2: Manager auto-filled from org link, read-only */}
              {selectedEmployee && (
                <div className="space-y-2">
                  <Label>Руководитель</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                    {hrSelectedManagerName || '—'}
                  </div>
                </div>
              )}
            </>
          )}
          {meetingLimitReached && (
            <p className="text-xs text-destructive">
              Нельзя создать новую встречу: у сотрудника уже есть 2 незавершённые встречи. Сначала зафиксируйте итоги одной из них.
            </p>
          )}
          {participantsError && (
            <p className="text-xs text-destructive">{participantsError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit() || isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Создание...</> : 'Создать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
