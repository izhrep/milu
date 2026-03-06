import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, X, UserPlus } from 'lucide-react';
import { ColleagueSelectionDialog } from './ColleagueSelectionDialog';
import { useAuth } from '@/contexts/AuthContext';

interface Respondent {
  id: string;
  evaluating_user_id: string;
  status: string;
  is_manager_participant: boolean;
  evaluator_name: string;
  evaluator_position?: string;
}

interface RespondentApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onApproved: () => void;
}

export const RespondentApprovalDialog = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onApproved,
}: RespondentApprovalDialogProps) => {
  const { user } = useAuth();
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showColleagueSelection, setShowColleagueSelection] = useState(false);

  useEffect(() => {
    if (open && employeeId) {
      fetchRespondents();
    }
  }, [open, employeeId]);

  const fetchRespondents = async () => {
    try {
      setLoading(true);

      const { data: assignments, error } = await supabase
        .from('survey_360_assignments')
        .select('id, evaluating_user_id, status, is_manager_participant')
        .eq('evaluated_user_id', employeeId)
        .in('status', ['pending', 'approved']);

      if (error) throw error;

      // Decrypt evaluator names
      const respondentsWithNames = await Promise.all(
        (assignments || []).map(async (assignment: any) => {
          const { data: user } = await supabase
            .from('users')
            .select('first_name, last_name, middle_name, positions(name)')
            .eq('id', assignment.evaluating_user_id)
            .single();

          if (!user) return null;

          try {
            const response = await fetch(
              'https://functions.yandexcloud.net/d4ej36ob4qetcnhgsj2l',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  first_name: user.first_name,
                  last_name: user.last_name,
                  middle_name: user.middle_name,
                }),
              }
            );

            if (!response.ok) throw new Error('Decryption failed');

            const decrypted = await response.json();
            return {
              id: assignment.id,
              evaluating_user_id: assignment.evaluating_user_id,
              status: assignment.status,
              is_manager_participant: assignment.is_manager_participant,
              evaluator_name: `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name || ''}`.trim(),
              evaluator_position: (user as any).positions?.name,
            } as Respondent;
          } catch (error) {
            console.error('Error decrypting user data:', error);
            return null;
          }
        })
      );

      setRespondents(respondentsWithNames.filter((r): r is Respondent => r !== null));
    } catch (error) {
      console.error('Error fetching respondents:', error);
      toast.error('Ошибка загрузки респондентов');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    try {
      setSubmitting(true);

      if (!user?.id) {
        toast.error('Необходимо авторизоваться');
        return;
      }

      // Update all pending assignments to approved
      const { error } = await supabase
        .from('survey_360_assignments')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('evaluated_user_id', employeeId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success('Список респондентов утвержден');
      onApproved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving respondents:', error);
      toast.error('Ошибка при утверждении списка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('survey_360_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Респондент удален');
      fetchRespondents();
    } catch (error) {
      console.error('Error removing respondent:', error);
      toast.error('Ошибка при удалении респондента');
    }
  };

  const handleAddColleagues = async (selectedColleagues: string[]) => {
    try {
      if (!user?.id) {
        toast.error('Необходимо авторизоваться');
        return;
      }

      // Create assignments for selected colleagues
      const assignments = selectedColleagues.map(colleagueId => ({
        evaluated_user_id: employeeId,
        evaluating_user_id: colleagueId,
        status: 'pending',
        assignment_type: 'peer',
      }));

      const { error } = await supabase
        .from('survey_360_assignments')
        .insert(assignments);

      if (error) throw error;

      toast.success('Респонденты добавлены в список');
      fetchRespondents();
    } catch (error) {
      console.error('Error adding colleagues:', error);
      toast.error('Ошибка при добавлении респондентов');
    }
  };

  const pendingCount = respondents.filter(r => r.status === 'pending').length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Респонденты для оценки: {employeeName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColleagueSelection(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить респондентов
            </Button>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : respondents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет респондентов для утверждения
            </div>
          ) : (
            respondents.map(respondent => (
              <div
                key={respondent.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {respondent.evaluator_name}
                    {respondent.is_manager_participant && (
                      <Badge variant="secondary" className="ml-2">
                        Руководитель
                      </Badge>
                    )}
                  </div>
                  {respondent.evaluator_position && (
                    <div className="text-sm text-muted-foreground">
                      {respondent.evaluator_position}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {respondent.status === 'approved' ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Утверждено
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="outline">Ожидает</Badge>
                      {!respondent.is_manager_participant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(respondent.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          {pendingCount > 0 && (
            <Button onClick={handleApproveAll} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Утверждение...
                </>
              ) : (
                `Утвердить список (${pendingCount})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ColleagueSelectionDialog
      open={showColleagueSelection}
      onOpenChange={setShowColleagueSelection}
      onConfirm={handleAddColleagues}
      currentUserId={employeeId}
    />
    </>
  );
};
