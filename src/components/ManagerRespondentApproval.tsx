import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Plus } from 'lucide-react';
import { ManagerAddRespondentDialog } from './ManagerAddRespondentDialog';
import { useAuth } from '@/contexts/AuthContext';

interface ManagerRespondentApprovalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluatedUserId: string;
  evaluatedUserName: string;
  onApprovalComplete: () => void;
  diagnosticStageId?: string | null;
}

interface PendingAssignment {
  id: string;
  evaluating_user_id: string;
  evaluating_user_name: string;
  position?: string;
  company?: string;
  department?: string;
  status: string;
  added_by_manager?: boolean;
  diagnostic_stage_id?: string;
  action?: 'approve' | 'reject' | null;
}

export const ManagerRespondentApproval: React.FC<ManagerRespondentApprovalProps> = ({
  open,
  onOpenChange,
  evaluatedUserId,
  evaluatedUserName,
  onApprovalComplete,
  diagnosticStageId,
}) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<PendingAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (open && evaluatedUserId) {
      // Reset state when dialog opens
      setAssignments([]);
      loadPendingAssignments();
    }
  }, [open, evaluatedUserId, diagnosticStageId]);

  const loadPendingAssignments = async () => {
    try {
      setLoading(true);

      // Загружаем все peer назначения для этого пользователя (pending, approved, rejected)
      let query = supabase
        .from('survey_360_assignments')
        .select('id, evaluating_user_id, status, added_by_manager, diagnostic_stage_id')
        .eq('evaluated_user_id', evaluatedUserId)
        .eq('assignment_type', 'peer')
        .in('status', ['pending', 'approved', 'rejected']);

      // Filter by stage if specified
      if (diagnosticStageId) {
        query = query.eq('diagnostic_stage_id', diagnosticStageId);
      }

      const { data: assignmentsData, error } = await query;

      if (error) throw error;

      // Use SECURITY DEFINER RPC to bypass RLS restrictions on users table
      const userIds = assignmentsData?.map(a => a.evaluating_user_id) || [];
      
      const usersMap: Record<string, { name: string; position?: string; company?: string; department?: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .rpc('get_respondent_profiles', { p_user_ids: userIds });

        // Fetch department and company info separately
        const { data: usersExtra } = await supabase
          .rpc('get_users_for_peer_selection', { _current_user_id: userIds[0] });

        const departmentIds = [...new Set((usersExtra || []).filter((u: any) => userIds.includes(u.id) && u.department_id).map((u: any) => u.department_id))];
        
        const [departmentsResult] = await Promise.all([
          departmentIds.length > 0 
            ? supabase.from('departments').select('id, name, company_id').in('id', departmentIds)
            : Promise.resolve({ data: [] })
        ]);

        const departmentsMap = new Map((departmentsResult.data || []).map((d: any) => [d.id, { name: d.name, company_id: d.company_id }]));

        const companyIds = (departmentsResult.data || []).map((d: any) => d.company_id).filter(Boolean);
        const { data: companiesData } = companyIds.length > 0
          ? await supabase.from('companies').select('id, name').in('id', companyIds)
          : { data: [] };
        const companiesMap = new Map((companiesData || []).map((c: any) => [c.id, c.name]));

        // Build user department map from usersExtra
        const userDeptMap = new Map((usersExtra || []).filter((u: any) => userIds.includes(u.id)).map((u: any) => [u.id, u.department_id]));

        if (profilesData) {
          for (const profile of profilesData) {
            const fullName = `${profile.last_name || ''} ${profile.first_name || ''} ${profile.middle_name || ''}`.trim();
            const deptId = userDeptMap.get(profile.id);
            const departmentInfo = deptId ? departmentsMap.get(deptId) : undefined;
            
            usersMap[profile.id] = {
              name: fullName || 'Неизвестно',
              position: profile.position_name || undefined,
              department: departmentInfo?.name,
              company: departmentInfo?.company_id ? companiesMap.get(departmentInfo.company_id) : undefined,
            };
          }
        }
      }

      const enrichedAssignments: PendingAssignment[] = assignmentsData?.map(a => {
        const userInfo = usersMap[a.evaluating_user_id] || { name: 'Загрузка...' };
        return {
          id: a.id,
          evaluating_user_id: a.evaluating_user_id,
          evaluating_user_name: userInfo.name,
          position: userInfo.position,
          company: userInfo.company,
          department: userInfo.department,
          status: a.status,
          added_by_manager: a.added_by_manager || false,
          diagnostic_stage_id: a.diagnostic_stage_id || undefined,
          action: null,
        };
      }) || [];

      console.log('Loaded assignments:', enrichedAssignments);

      setAssignments(enrichedAssignments);
    } catch (error) {
      console.error('Error loading pending assignments:', error);
      toast.error('Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  };

  const setAction = (id: string, action: 'approve' | 'reject' | null) => {
    setAssignments(prev =>
      prev.map(a => (a.id === id ? { ...a, action } : a))
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Фильтруем назначения по действиям (только pending)
      const toApprove = assignments.filter(a => a.action === 'approve' && a.status === 'pending');
      const toReject = assignments.filter(a => a.action === 'reject' && a.status === 'pending');

      // Проверяем, что хотя бы одно действие выбрано
      if (toApprove.length === 0 && toReject.length === 0) {
        toast.error('Выберите действие хотя бы для одного респондента');
        setSaving(false);
        return;
      }

      // Используем переданный diagnosticStageId или берём из assignments/participants
      let stageId = diagnosticStageId;
      if (!stageId) {
        const { data: stageParticipant } = await supabase
          .from('diagnostic_stage_participants')
          .select('stage_id')
          .eq('user_id', evaluatedUserId)
          .maybeSingle();

        stageId = stageParticipant?.stage_id || assignments[0]?.diagnostic_stage_id;
      }

      // Утверждаем выбранные назначения
      if (toApprove.length > 0) {
        const { error: approveError } = await supabase
          .from('survey_360_assignments')
          .update({ 
            status: 'approved',
            approved_by: user?.id,
            approved_at: new Date().toISOString()
          })
          .in('id', toApprove.map(a => a.id));

        if (approveError) throw approveError;

        // Создаем задачи для утвержденных респондентов
        const { error: tasksError } = await supabase.functions.invoke(
          'create-peer-evaluation-tasks',
          {
            body: {
              approvedAssignments: toApprove,
              diagnosticStageId: stageId,
              evaluatedUserName,
            }
          }
        );

        if (tasksError) throw tasksError;
      }

      // Отклоняем выбранные назначения (БЕЗ комментария)
      if (toReject.length > 0) {
        const { error: rejectError } = await supabase
          .from('survey_360_assignments')
          .update({ 
            status: 'rejected',
            rejected_at: new Date().toISOString()
          })
          .in('id', toReject.map(a => a.id));

        if (rejectError) throw rejectError;
      }

      // Проверяем, остались ли pending назначения
      const remainingPending = assignments.filter(a => 
        a.status === 'pending' && !a.action
      );

      // Завершаем задачу peer_approval, если все обработаны
      if (remainingPending.length === 0 && stageId && user?.id) {
        const { data: approvalTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('diagnostic_stage_id', stageId)
          .eq('task_type', 'peer_approval')
          .eq('assignment_id', evaluatedUserId)
          .eq('status', 'pending')
          .maybeSingle();

        if (approvalTask) {
          await supabase
            .from('tasks')
            .update({ status: 'completed' })
            .eq('id', approvalTask.id);
        }
      }

      toast.success('Список респондентов обновлен');
      onApprovalComplete();
      
      // Если все обработаны, закрываем диалог
      if (remainingPending.length === 0) {
        onOpenChange(false);
      } else {
        // Перезагружаем список
        await loadPendingAssignments();
      }
    } catch (error) {
      console.error('Error saving respondent actions:', error);
      toast.error('Ошибка сохранения изменений');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Утверждение списка оценивающих для {evaluatedUserName}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить респондента
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет респондентов для отображения
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {assignments
              .filter(a => a.status === 'pending')
              .map((assignment) => (
                <div 
                  key={assignment.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{assignment.evaluating_user_name}</p>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {assignment.position && <p>{assignment.position}</p>}
                      {assignment.company && <p>Компания: {assignment.company}</p>}
                      {assignment.department && <p>Подразделение: {assignment.department}</p>}
                    </div>
                  </div>
                  
                  <Badge variant="outline" className="ml-4 flex-shrink-0">
                    {assignment.added_by_manager ? 'Добавлен руководителем' : 'Предложен сотрудником'}
                  </Badge>

                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button
                      size="sm"
                      variant={assignment.action === 'approve' ? 'default' : 'outline'}
                      onClick={() => setAction(assignment.id, 'approve')}
                    >
                      Согласовать
                    </Button>
                    <Button
                      size="sm"
                      variant={assignment.action === 'reject' ? 'destructive' : 'outline'}
                      onClick={() => setAction(assignment.id, 'reject')}
                    >
                      Отклонить
                    </Button>
                  </div>
                </div>
              ))}

            {assignments.filter(a => a.status === 'approved').length > 0 && (
              <>
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">Утвержденные респонденты</h4>
                </div>
                {assignments
                  .filter(a => a.status === 'approved')
                  .map((assignment) => (
                    <div 
                      key={assignment.id} 
                      className="flex items-center justify-between p-4 border rounded-lg bg-green-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{assignment.evaluating_user_name}</p>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {assignment.position && <p>{assignment.position}</p>}
                          {assignment.company && <p>Компания: {assignment.company}</p>}
                          {assignment.department && <p>Подразделение: {assignment.department}</p>}
                        </div>
                      </div>
                      
                      <Badge variant="outline" className="ml-4 bg-green-100 flex-shrink-0">
                        Утвержден
                      </Badge>
                    </div>
                  ))}
              </>
            )}

            {assignments.filter(a => a.status === 'rejected').length > 0 && (
              <>
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">Отклоненные респонденты</h4>
                </div>
                {assignments
                  .filter(a => a.status === 'rejected')
                  .map((assignment) => (
                    <div 
                      key={assignment.id} 
                      className="flex items-center justify-between p-4 border rounded-lg bg-red-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{assignment.evaluating_user_name}</p>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {assignment.position && <p>{assignment.position}</p>}
                          {assignment.company && <p>Компания: {assignment.company}</p>}
                          {assignment.department && <p>Подразделение: {assignment.department}</p>}
                        </div>
                      </div>
                      
                      <Badge variant="outline" className="ml-4 bg-red-100 flex-shrink-0">
                        Отклонен
                      </Badge>
                    </div>
                  ))}
              </>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !assignments.some(a => a.action)}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить изменения
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ManagerAddRespondentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        evaluatedUserId={evaluatedUserId}
        managerId={user?.id || ''}
        diagnosticStageId={diagnosticStageId || assignments[0]?.diagnostic_stage_id}
        onRespondentAdded={() => {
          loadPendingAssignments();
        }}
      />
    </Dialog>
  );
};