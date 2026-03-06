import React, { useState, useEffect } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, FileText, Clock, CheckCircle, AlertCircle, RotateCcw, History } from 'lucide-react';
import { useOneOnOneMeetings } from '@/hooks/useOneOnOneMeetings';
import { useSubordinates } from '@/hooks/useSubordinates';
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
  const statusMap = {
    draft: { label: 'Черновик', variant: 'secondary' as const, icon: FileText },
    submitted: { label: 'На утверждении', variant: 'default' as const, icon: Clock },
    returned: { label: 'Возврат на доработку', variant: 'destructive' as const, icon: AlertCircle },
    approved: { label: 'Утверждено', variant: 'default' as const, icon: CheckCircle },
    expired: { label: 'Просрочено', variant: 'warning' as const, icon: RotateCcw },
  };
  const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
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
  const [activeTab, setActiveTab] = useState<string>('my-meetings');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Fetch latest meeting activity per subordinate for smart auto-selection
  const subordinateIds = subordinates.map(s => s.id);
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

  // Auto-select subordinate by most recent meeting activity
  useEffect(() => {
    if (subordinates.length === 0 || selectedEmployeeId) return;

    if (latestActivity && latestActivity.length > 0) {
      // Build map: employee_id -> max updated_at
      const activityMap = new Map<string, string>();
      for (const row of latestActivity) {
        if (!activityMap.has(row.employee_id)) {
          activityMap.set(row.employee_id, row.updated_at);
        }
      }

      // Sort subordinates: by latest activity desc, then alphabetically
      const sorted = [...subordinates].sort((a, b) => {
        const aTime = activityMap.get(a.id) || '';
        const bTime = activityMap.get(b.id) || '';
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) {
          const cmp = bTime.localeCompare(aTime);
          if (cmp !== 0) return cmp;
        }
        const aName = [a.last_name, a.first_name].filter(Boolean).join(' ');
        const bName = [b.last_name, b.first_name].filter(Boolean).join(' ');
        return aName.localeCompare(bName);
      });

      setSelectedEmployeeId(sorted[0].id);
    } else if (latestActivity !== undefined) {
      // No meetings at all — first by alphabet
      setSelectedEmployeeId(subordinates[0].id);
    }
  }, [subordinates, selectedEmployeeId, latestActivity]);

  // Switch to subordinate tab once permission loads
  useEffect(() => {
    if (!permLoading && canViewSubordinateMeetings) {
      setActiveTab('subordinate-meetings');
    }
  }, [permLoading, canViewSubordinateMeetings]);

  // My meetings (as employee or manager on my own meetings)
  const { meetings: myMeetingsRaw, isLoading, createMeetingAsync } = useOneOnOneMeetings();
  // Subordinate meetings (filtered by selected employee)
  const { meetings: subordinateMeetings } = useOneOnOneMeetings(
    selectedEmployeeId ? { employeeId: selectedEmployeeId } : undefined
  );

  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingId, setNewMeetingId] = useState<string | null>(null);

  const handleCreateMeeting = async (params: { employee_id: string; manager_id: string; stage_id?: string | null }) => {
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Встречи 1:1</h1>
          <p className="text-text-secondary mt-1">Планирование и история встреч с unit-лидом</p>
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
            <DialogTitle>Новая встреча 1:1</DialogTitle>
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
                        <h3 className="font-semibold text-text-primary mb-2">
                          Встреча {myMeetings.length - index}
                          {meeting.meeting_date && (
                            <span className="font-normal text-text-secondary ml-2">
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
                            {meeting.status === 'expired' ? 'Возобновить' : 'Открыть'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Встреча 1:1</DialogTitle>
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
              <CardContent className="pt-6 text-center text-text-secondary">
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
            {/* Employee selector */}
            {subordinates.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-text-secondary whitespace-nowrap">Сотрудник:</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {subordinates.map(sub => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {formatUserName(sub)}
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
                            <h3 className="font-semibold text-text-primary mb-2">
                              Встреча {subordinateMeetings.length - index}
                              {meeting.meeting_date && (
                                <span className="font-normal text-text-secondary ml-2">
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
                                {isHistorical ? 'Просмотр' : meeting.status === 'submitted' ? 'Рассмотреть' : meeting.status === 'expired' ? 'Возобновить' : 'Открыть'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Встреча 1:1 — Сотрудник</DialogTitle>
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
                <CardContent className="pt-6 text-center text-text-secondary">
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
