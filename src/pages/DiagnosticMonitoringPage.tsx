import React, { useState, useMemo, useEffect } from 'react';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useUsers, getFullName } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ClipboardCheck, TrendingUp, Calendar, Download, Settings, FileSpreadsheet } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ParticipantExpandableRow } from '@/components/ParticipantExpandableRow';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { OfflineSurveyManager } from '@/components/OfflineSurveyManager';
import { exportMonitoringExcel } from '@/utils/exportMonitoringExcel';

interface ParticipantProgress {
  user_id: string;
  full_name: string;
  position: string;
  self_assessment_completed: boolean;
  manager_assessment_completed: boolean;
  colleagues_count: number;
  colleagues_completed: number;
}

export const DiagnosticMonitoringPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission: canManageParticipants, isLoading: participantsLoading } = usePermission('diagnostics.manage_participants');
  const { hasPermission: canViewAdminPanel, isLoading: adminLoading } = usePermission('security.view_admin_panel');
  const { hasPermission: canViewAllDiagnostics, isLoading: diagnosticsPermLoading } = usePermission('diagnostics.view_results');
  const { hasPermission: canViewTeam, isLoading: teamPermLoading } = usePermission('team.view');
  const { stages, isLoading: stagesLoading } = useDiagnosticStages();
  const { users } = useUsers();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Sort stages from newest to oldest by created_at
  const sortedStages = useMemo(() => {
    if (!stages) return [];
    return [...stages].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [stages]);

  // Auto-select the newest stage when stages load
  useEffect(() => {
    if (sortedStages.length > 0 && !selectedStageId) {
      setSelectedStageId(sortedStages[0].id);
    }
  }, [sortedStages, selectedStageId]);

  // Permission-based access control
  // isManager: can view team but not all diagnostics (for filtering to subordinates only)
  const isManager = canViewTeam && !canViewAdminPanel;
  const isAdminOrHR = canViewAllDiagnostics;

  // Get subordinate IDs for managers (using subtree)
  const { data: subtreeIdsData } = useQuery({
    queryKey: ['management-subtree-ids-monitoring', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .rpc('get_management_subtree_ids', { _manager_id: user.id });
      if (error) throw error;
      return (data as string[]) || [];
    },
    enabled: isManager && !!user?.id,
  });
  const subordinateIds = useMemo(() => {
    if (!isManager) return [];
    return subtreeIdsData || [];
  }, [isManager, subtreeIdsData]);

  // Fetch participants progress for selected stage
  const { data: participantsProgress, isLoading: progressLoading } = useQuery({
    queryKey: ['diagnostic-participants-progress', selectedStageId, isManager, subordinateIds, users.length],
    queryFn: async () => {
      if (!selectedStageId) return [];

      // Get all participants for this stage
      let query = supabase
        .from('diagnostic_stage_participants')
        .select('user_id')
        .eq('stage_id', selectedStageId);

      // For managers, filter to only their subordinates
      if (isManager && subordinateIds.length > 0) {
        query = query.in('user_id', subordinateIds);
      } else if (isManager && subordinateIds.length === 0) {
        return []; // Manager has no subordinates
      }

      const { data: participants, error: participantsError } = await query;

      if (participantsError) throw participantsError;

      const progress: ParticipantProgress[] = [];

      for (const participant of participants || []) {
        const user = users.find(u => u.id === participant.user_id);
        
        // Self-assessment - check if there's at least one result
        const { data: selfHardResults } = await supabase
          .from('hard_skill_results')
          .select('id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('evaluating_user_id', participant.user_id)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .limit(1);

        const { data: selfSoftResults } = await supabase
          .from('soft_skill_results')
          .select('id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('evaluating_user_id', participant.user_id)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .limit(1);

        const selfCompleted = (selfHardResults && selfHardResults.length > 0) || 
                             (selfSoftResults && selfSoftResults.length > 0);

        // Manager assessment - check if there's at least one result
        const managerId = user?.manager_id || '';
        const { data: managerHardResults } = await supabase
          .from('hard_skill_results')
          .select('id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('evaluating_user_id', managerId)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .limit(1);

        const { data: managerSoftResults } = await supabase
          .from('soft_skill_results')
          .select('id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('evaluating_user_id', managerId)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .limit(1);

        const managerCompleted = (managerHardResults && managerHardResults.length > 0) || 
                                (managerSoftResults && managerSoftResults.length > 0);

        // Get total assigned peer evaluators from survey_360_assignments
        // Include expired to show them in monitoring (they count as assigned even if not completed)
        const { data: assignedColleagues } = await supabase
          .from('survey_360_assignments')
          .select('evaluating_user_id, status')
          .eq('evaluated_user_id', participant.user_id)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('assignment_type', 'peer')
          .in('status', ['approved', 'completed', 'expired']);

        const totalAssignedColleagues = assignedColleagues?.length || 0;

        // Colleagues - get unique colleagues who actually completed evaluation
        const { data: colleaguesHardResults } = await supabase
          .from('hard_skill_results')
          .select('evaluating_user_id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .neq('evaluating_user_id', participant.user_id)
          .neq('evaluating_user_id', managerId);

        const { data: colleaguesSoftResults } = await supabase
          .from('soft_skill_results')
          .select('evaluating_user_id')
          .eq('evaluated_user_id', participant.user_id)
          .eq('diagnostic_stage_id', selectedStageId)
          .eq('is_draft', false)
          .neq('evaluating_user_id', participant.user_id)
          .neq('evaluating_user_id', managerId);

        const uniqueColleaguesCompleted = new Set([
          ...(colleaguesHardResults?.map(r => r.evaluating_user_id) || []),
          ...(colleaguesSoftResults?.map(r => r.evaluating_user_id) || [])
        ]);

        const colleaguesCompletedCount = uniqueColleaguesCompleted.size;

        progress.push({
          user_id: participant.user_id,
          full_name: getFullName(user) || 'Не указано',
          position: user?.positions?.name || 'Не указано',
          self_assessment_completed: selfCompleted,
          manager_assessment_completed: managerCompleted,
          colleagues_count: totalAssignedColleagues,
          colleagues_completed: colleaguesCompletedCount,
        });
      }

      return progress;
    },
    enabled: !!selectedStageId && users.length > 0,
  });

  // Fetch participant user IDs for offline surveys
  const { data: participantUserIds } = useQuery({
    queryKey: ['diagnostic-participant-ids', selectedStageId, isManager, subordinateIds],
    queryFn: async () => {
      if (!selectedStageId) return [];

      let query = supabase
        .from('diagnostic_stage_participants')
        .select('user_id')
        .eq('stage_id', selectedStageId);

      if (isManager && subordinateIds.length > 0) {
        query = query.in('user_id', subordinateIds);
      } else if (isManager && subordinateIds.length === 0) {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.map(p => p.user_id) || [];
    },
    enabled: !!selectedStageId,
  });

  const permissionLoading = participantsLoading || adminLoading || diagnosticsPermLoading || teamPermLoading;
  // Allow access for admin/hr_bp with permissions OR managers
  const hasAccess = canManageParticipants || canViewAdminPanel || canViewAllDiagnostics || canViewTeam;

  // Проверка доступа
  if (permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const selectedStage = sortedStages.find(s => s.id === selectedStageId);

  if (stagesLoading) {
    return <div className="p-6">Загрузка...</div>;
  }

  // Calculate statistics
  const totalParticipants = participantsProgress?.length || 0;
  // Завершено = самооценка + фидбек руководителя (без учета коллег)
  const completedAll = participantsProgress?.filter(
    p => p.self_assessment_completed && p.manager_assessment_completed
  ).length || 0;
  
  // Calculate actual completion rate based on participant progress
  const actualCompletionRate = totalParticipants > 0 
    ? Math.round((completedAll / totalParticipants) * 100) 
    : 0;

  const handleExportToExcel = async () => {
    if (!selectedStageId) {
      toast.error('Выберите этап для экспорта');
      return;
    }

    try {
      toast.loading('Формирование отчета...');

      // Получаем участников этапа
      let participantsQuery = supabase
        .from('diagnostic_stage_participants')
        .select('user_id')
        .eq('stage_id', selectedStageId);

      if (isManager && subordinateIds.length > 0) {
        participantsQuery = participantsQuery.in('user_id', subordinateIds);
      } else if (isManager && subordinateIds.length === 0) {
        toast.dismiss();
        toast.error('У вас нет подчинённых для экспорта');
        return;
      }

      const { data: participants } = await participantsQuery;

      if (!participants || participants.length === 0) {
        toast.dismiss();
        toast.error('Нет участников для экспорта');
        return;
      }

      const exportData = await exportMonitoringExcel(
        selectedStageId,
        participants.map(p => p.user_id),
        users,
        selectedStage?.period || 'отчет',
      );

      if (exportData.length === 0) {
        toast.dismiss();
        toast.error('Нет данных для экспорта');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Результаты диагностики');

      const wscols = [
        { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 30 },
        { wch: 50 }, { wch: 20 }, { wch: 10 }, { wch: 40 }, { wch: 10 },
      ];
      worksheet['!cols'] = wscols;

      const fileName = `Диагностика_${selectedStage?.period || 'отчет'}_${new Date().toLocaleDateString('ru-RU')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.dismiss();
      toast.success('Отчет успешно экспортирован');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.dismiss();
      toast.error('Ошибка при экспорте данных');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs />
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Мониторинг диагностики</h1>
          <p className="text-text-secondary mt-2">Отслеживание прогресса этапов и участников</p>
        </div>
        <div className="flex gap-2">
          {isAdminOrHR && (
            <Button onClick={() => navigate('/admin/diagnostics')} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Справочники диагностики
            </Button>
          )}
          {selectedStageId && (
            <Button onClick={handleExportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Экспорт в Excel
            </Button>
          )}
        </div>
      </div>

      {/* Stage Filter */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">Этап диагностики</label>
          <Select value={selectedStageId || ''} onValueChange={setSelectedStageId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Выберите этап" />
            </SelectTrigger>
            <SelectContent>
              {sortedStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.period} ({new Date(stage.start_date).toLocaleDateString()} - {new Date(stage.end_date).toLocaleDateString()})
                  {stage.is_active && ' • Активен'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      {selectedStage && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Выбранный этап</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedStage.period}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(selectedStage.start_date).toLocaleDateString()} - {new Date(selectedStage.end_date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Участников</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalParticipants}</div>
              <p className="text-xs text-muted-foreground mt-1">Всего участников</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Завершено</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedAll} / {totalParticipants}</div>
              <p className="text-xs text-muted-foreground mt-1">Личный фидбек + фидбек руководителя</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Прогресс</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{actualCompletionRate}%</div>
              <Progress value={actualCompletionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="participants">Участники</TabsTrigger>
          <TabsTrigger value="offline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Офлайн-анкеты
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedStageId 
                  ? `Участники этапа: ${selectedStage?.period}`
                  : 'Выберите этап для просмотра участников'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressLoading ? (
                <div className="text-center py-8">Загрузка...</div>
              ) : !selectedStageId ? (
                <div className="text-center py-8 text-muted-foreground">
                  Выберите этап в фильтре выше
                </div>
              ) : participantsProgress && participantsProgress.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ФИО</TableHead>
                      <TableHead>Должность</TableHead>
                      <TableHead>Личный фидбек</TableHead>
                      <TableHead>Фидбек коллег</TableHead>
                      <TableHead>Фидбек unit-лида</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantsProgress.map((participant) => (
                      <ParticipantExpandableRow
                        key={participant.user_id}
                        userId={participant.user_id}
                        fullName={participant.full_name}
                        position={participant.position}
                        selfCompleted={participant.self_assessment_completed}
                        colleaguesCount={participant.colleagues_count}
                        colleaguesCompleted={participant.colleagues_completed}
                        managerCompleted={participant.manager_assessment_completed}
                        stageId={selectedStageId!}
                        users={users}
                      />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет участников для отображения
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline" className="space-y-4">
          <OfflineSurveyManager
            stageId={selectedStageId}
            stagePeriod={selectedStage?.period || ''}
            stageStatus={selectedStage?.status}
            users={users}
            participantUserIds={participantUserIds || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};