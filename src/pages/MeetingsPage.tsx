import React, { useState, useEffect } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Clock, CheckCircle, FileText, History } from 'lucide-react';
import { useOneOnOneMeetings } from '@/hooks/useOneOnOneMeetings';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MeetingForm } from '@/components/MeetingForm';
import { CreateMeetingDialog } from '@/components/CreateMeetingDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const formatUserName = (u: { first_name: string | null; last_name: string | null }) =>
  [u.last_name, u.first_name].filter(Boolean).join(' ') || 'Без имени';

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

const MeetingsPage = () => {
  const { user } = useAuth();
  const { hasPermission: canViewSubordinateMeetings, isLoading: permLoading } = usePermission('team.view');
  const { subordinates, isManager } = useSubordinates();
  const { allSubtreeUsers, isDirect } = useSubordinateTree();
  const [activeTab, setActiveTab] = useState<string>('my-meetings');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const selectorUsers = allSubtreeUsers.map(u => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    isDirect: isDirect(u.id),
    managerName: !isDirect(u.id) ? (() => {
      const mgr = allSubtreeUsers.find(m => m.id === u.manager_id);
      return mgr ? `${mgr.last_name || ''} ${mgr.first_name || ''}`.trim() : '';
    })() : '',
  }));
  const subordinateIds = selectorUsers.map(s => s.id);
  
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

  useEffect(() => {
    if (selectorUsers.length === 0 || selectedEmployeeId) return;
    if (latestActivity && latestActivity.length > 0) {
      const activityMap = new Map<string, string>();
      for (const row of latestActivity) {
        if (!activityMap.has(row.employee_id)) {
          activityMap.set(row.employee_id, row.updated_at);
        }
      }
      const sorted = [...selectorUsers].sort((a, b) => {
        const aTime = activityMap.get(a.id) || '';
        const bTime = activityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) { const cmp = bTime.localeCompare(aTime); if (cmp !== 0) return cmp; }
        return [a.last_name, a.first_name].filter(Boolean).join(' ').localeCompare([b.last_name, b.first_name].filter(Boolean).join(' '));
      });
      setSelectedEmployeeId(sorted[0].id);
    } else if (latestActivity !== undefined) {
      setSelectedEmployeeId(selectorUsers[0].id);
    }
  }, [selectorUsers, selectedEmployeeId, latestActivity]);

  useEffect(() => {
    if (!permLoading && canViewSubordinateMeetings) {
      setActiveTab('subordinate-meetings');
    }
  }, [permLoading, canViewSubordinateMeetings]);

  const { meetings: myMeetingsRaw, isLoading, createMeetingAsync } = useOneOnOneMeetings();
  const { meetings: subordinateMeetings } = useOneOnOneMeetings(
    selectedEmployeeId ? { employeeId: selectedEmployeeId } : undefined
  );

  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingId, setNewMeetingId] = useState<string | null>(null);

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

  const getButtonLabel = (status: string, isHistorical: boolean) => {
    if (isHistorical) return 'Просмотр';
    switch (status) {
      case 'awaiting_summary': return 'Заполнить итоги';
      default: return 'Открыть';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Встречи one-to-one</h1>
          <p className="text-muted-foreground mt-1">Планирование и история встреч с unit-лидом</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать встречу
        </Button>
      </div>

      <CreateMeetingDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreateMeeting={handleCreateMeeting}
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
        <TabsList>
          {canViewSubordinateMeetings && (
            <TabsTrigger value="subordinate-meetings">Встречи подчиненных</TabsTrigger>
          )}
          <TabsTrigger value="my-meetings">Мои встречи</TabsTrigger>
        </TabsList>

        <TabsContent value="my-meetings" className="space-y-4">
          {myMeetings && myMeetings.length > 0 ? (
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
                              — {format(new Date(meeting.meeting_date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(meeting.status)}
                        </div>
                      </div>
                      <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                        setIsFormOpen(open);
                        if (!open) setSelectedMeeting(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                            {getButtonLabel(meeting.status, false)}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Встреча one-to-one</DialogTitle>
                          </DialogHeader>
                          <MeetingForm meetingId={meeting.id} onClose={() => setIsFormOpen(false)} />
                        </DialogContent>
                      </Dialog>
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

        {canViewSubordinateMeetings && (
          <TabsContent value="subordinate-meetings" className="space-y-4">
            {selectorUsers.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Сотрудник:</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectorUsers.map(sub => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {formatUserName(sub)}
                        {!sub.isDirect && sub.managerName && (
                          <span className="text-muted-foreground ml-1">(через {sub.managerName})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {subordinateMeetings && subordinateMeetings.length > 0 ? (
              <div className="grid gap-4">
                {subordinateMeetings.map((meeting, index) => {
                  const isHistorical = meeting.manager_id !== user?.id;
                  return (
                    <Card key={meeting.id} className="border-0 shadow-card hover:shadow-card-hover transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-2">
                              Встреча {subordinateMeetings.length - index}
                              {meeting.meeting_date && (
                                <span className="font-normal text-muted-foreground ml-2">
                                  — {format(new Date(meeting.meeting_date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusBadge(meeting.status)}
                              {isHistorical && (
                                <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                                  <History className="h-3 w-3" />
                                  Историческая
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Dialog open={isFormOpen && selectedMeeting === meeting.id} onOpenChange={(open) => {
                            setIsFormOpen(open);
                            if (!open) setSelectedMeeting(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedMeeting(meeting.id)}>
                                {getButtonLabel(meeting.status, isHistorical)}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Встреча one-to-one — Сотрудник</DialogTitle>
                              </DialogHeader>
                              <MeetingForm meetingId={meeting.id} isManager onClose={() => setIsFormOpen(false)} />
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-0 shadow-card">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{selectedEmployeeId ? 'Нет встреч у выбранного сотрудника' : 'Выберите сотрудника'}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default MeetingsPage;
