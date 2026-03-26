import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
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

const MAX_INCOMPLETE_MEETINGS = 2;

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMeeting: (params: { employee_id: string; manager_id: string; stage_id?: string | null; meeting_date: string }) => Promise<any>;
  stageId?: string | null;
}

const formatUserName = (u: { first_name: string | null; last_name: string | null }) =>
  [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени';

export const CreateMeetingDialog: React.FC<CreateMeetingDialogProps> = ({
  open,
  onOpenChange,
  onCreateMeeting,
  stageId,
}) => {
  const { user } = useAuth();
  const { hasPermission: canViewAll } = usePermission('meetings.view_all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>('');
  const [meetingTime, setMeetingTime] = useState<string>('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHrOrAdmin = canViewAll;

  // Subtree data for manager/manager+1 scenarios
  const { allSubtreeUsers, isDirect, isLoading: subtreeLoading } = useSubordinateTree();

  const isManager = allSubtreeUsers.length > 0;

  // Employee list: all subtree users (direct + indirect)
  const employeeOptions = useMemo(() => {
    if (!user || isHrOrAdmin) return [];
    return allSubtreeUsers.map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      manager_id: u.manager_id,
      direct: isDirect(u.id),
    }));
  }, [allSubtreeUsers, isDirect, user, isHrOrAdmin]);

  // Manager options depend on selected employee
  // For indirect reports: only the employee's direct manager can be set as manager_id
  // This prevents manager+1 from creating meetings where they are the manager
  const managerOptions = useMemo(() => {
    if (!user || !selectedEmployee || isHrOrAdmin) return [];
    const emp = allSubtreeUsers.find(u => u.id === selectedEmployee);
    if (!emp) return [];

    const isDirectReport = isDirect(selectedEmployee);

    if (isDirectReport) {
      // Direct report: only current user can be manager
      return [{ id: user.id, first_name: user.first_name ?? null, last_name: user.last_name ?? null }];
    }

    // Indirect report: ONLY the employee's direct manager (not manager+1)
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

    // Fallback if direct manager not found in subtree (shouldn't happen normally)
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
      // Direct: always current user
      setSelectedManager(user.id);
    } else {
      // Indirect: ALWAYS use the employee's direct manager
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

  // --- HR/Admin: all users ---
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-meeting'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, manager_id')
        .order('last_name');
      return data || [];
    },
    enabled: isHrOrAdmin,
  });

  const managersForEmployee = useMemo(() => {
    if (!isHrOrAdmin || !allUsers) return [];
    return allUsers.filter(u => u.id !== selectedEmployee);
  }, [isHrOrAdmin, allUsers, selectedEmployee]);

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
      await onCreateMeeting({
        employee_id: employeeId,
        manager_id: managerId,
        stage_id: stageId || null,
        meeting_date: `${meetingDate}T${meetingTime}:00`,
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

  // Check incomplete meetings count for the selected employee
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
            <Label>Дата и время встречи *</Label>
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
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder={subtreeLoading ? 'Загрузка...' : 'Выберите сотрудника'} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {formatUserName(emp)}
                        {!emp.direct && (
                          <span className="ml-1 text-xs text-muted-foreground">(непрямой)</span>
                        )}
                      </SelectItem>
                    ))}
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

          {/* === HR/Admin: arbitrary pair === */}
          {isHrOrAdmin && (
            <>
              <div className="space-y-2">
                <Label>Сотрудник</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.map(u => (
                      <SelectItem key={u.id} value={u.id}>{formatUserName(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Руководитель</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите руководителя" />
                  </SelectTrigger>
                  <SelectContent>
                    {managersForEmployee.map(u => (
                      <SelectItem key={u.id} value={u.id}>{formatUserName(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
