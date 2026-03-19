import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
  const { hasPermission: canManageMeetings } = usePermission('meetings.manage');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>('');
  const [meetingTime, setMeetingTime] = useState<string>('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHrOrAdmin = canManageMeetings;

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
    enabled: !!user && !canManageMeetings,
  });

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
    enabled: !!user,
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

  const { data: subordinates } = useQuery({
    queryKey: ['subordinates-for-meeting', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('manager_id', user.id)
        .order('last_name');
      return data || [];
    },
    enabled: !!user,
  });

  const isManager = subordinates && subordinates.length > 0;

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

  const handleCreate = async () => {
    if (!meetingDate) return;

    let employeeId: string;
    let managerId: string;

    if (isHrOrAdmin) {
      if (!selectedEmployee || !selectedManager) return;
      employeeId = selectedEmployee;
      managerId = selectedManager;
    } else if (isManager) {
      if (!selectedEmployee) return;
      employeeId = selectedEmployee;
      managerId = user!.id;
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
        meeting_date: `${meetingDate}T${meetingTime}`,
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

  const managersForEmployee = useMemo(() => {
    if (!isHrOrAdmin || !allUsers) return [];
    return allUsers.filter(u => u.id !== selectedEmployee);
  }, [isHrOrAdmin, allUsers, selectedEmployee]);

  const needsManualManagerSelect = !isManager && !isHrOrAdmin && !currentUserData?.manager_id;

  const canSubmit = () => {
    if (!meetingDate) return false;
    if (isHrOrAdmin) return selectedEmployee && selectedManager && selectedEmployee !== selectedManager;
    if (isManager) return !!selectedEmployee;
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
          {/* Date & time (required) */}
          <div className="space-y-2">
            <Label>Дата и время встречи *</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                className="flex-1"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
              <Input
                type="time"
                className="w-28"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
              />
            </div>
          </div>

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

          {isManager && !isHrOrAdmin && (
            <div className="space-y-2">
              <Label>Сотрудник</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {subordinates?.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{formatUserName(sub)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
