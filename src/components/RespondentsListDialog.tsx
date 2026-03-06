import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, X, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { decryptUserData } from '@/lib/userDataDecryption';

interface Respondent {
  id: string;
  evaluating_user_id: string;
  status: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  evaluator_name: string;
  evaluator_position?: string;
}

interface RespondentsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluatedUserId: string;
  evaluatedUserName: string;
  diagnosticStageId?: string | null;
}

export const RespondentsListDialog = ({
  open,
  onOpenChange,
  evaluatedUserId,
  evaluatedUserName,
  diagnosticStageId,
}: RespondentsListDialogProps) => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && evaluatedUserId) {
      fetchRespondents();
    }
  }, [open, evaluatedUserId, diagnosticStageId]);

  const fetchRespondents = async () => {
    try {
      setLoading(true);
      console.log('Fetching respondents for user:', evaluatedUserId);

      // Fetch all assignments for this user (peer type)
      let query = supabase
        .from('survey_360_assignments')
        .select('id, evaluating_user_id, status, approved_at, rejected_at, rejection_reason, diagnostic_stage_id')
        .eq('evaluated_user_id', evaluatedUserId)
        .eq('assignment_type', 'peer');

      // Filter by stage if specified
      if (diagnosticStageId) {
        query = query.eq('diagnostic_stage_id', diagnosticStageId);
      }

      const { data: assignments, error } = await query;

      if (error) {
        console.error('Error fetching assignments:', error);
        throw error;
      }

      console.log('Found assignments:', assignments);

      if (!assignments || assignments.length === 0) {
        setRespondents([]);
        return;
      }

      // Use SECURITY DEFINER RPC to fetch all evaluator profiles in one call
      const evaluatorIds = assignments.map((a: any) => a.evaluating_user_id);
      const { data: profiles, error: profilesError } = await supabase
        .rpc('get_respondent_profiles', { p_user_ids: evaluatorIds });

      if (profilesError) {
        console.error('Error fetching respondent profiles:', profilesError);
      }

      // Build a map of profiles by ID
      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

      // Map assignments to respondents using profile data
      const respondentsWithNames = await Promise.all(
        assignments.map(async (assignment: any) => {
          const profile = profileMap.get(assignment.evaluating_user_id);
          if (!profile) {
            console.log('Profile not found for:', assignment.evaluating_user_id);
            return null;
          }

          try {
            const decrypted = await decryptUserData({
              first_name: profile.first_name,
              last_name: profile.last_name,
              middle_name: profile.middle_name,
              email: null,
            });

            const fullName = `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name || ''}`.trim();

            return {
              id: assignment.id,
              evaluating_user_id: assignment.evaluating_user_id,
              status: assignment.status,
              approved_at: assignment.approved_at,
              rejected_at: assignment.rejected_at,
              rejection_reason: assignment.rejection_reason,
              evaluator_name: fullName,
              evaluator_position: profile.position_name,
            } as Respondent;
          } catch (error) {
            console.error('Error decrypting user data:', error);
            return null;
          }
        })
      );

      const validRespondents = respondentsWithNames.filter((r): r is Respondent => r !== null);
      console.log('Valid respondents:', validRespondents);
      setRespondents(validRespondents);
    } catch (error) {
      console.error('Error fetching respondents:', error);
      toast.error('Ошибка загрузки респондентов');
    } finally {
      setLoading(false);
    }
  };

  const approvedRespondents = respondents.filter(r => r.status === 'approved' || r.status === 'completed');
  const rejectedRespondents = respondents.filter(r => r.status === 'rejected');
  const expiredRespondents = respondents.filter(r => r.status === 'expired');

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Респонденты: {evaluatedUserName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : respondents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Нет респондентов
          </div>
        ) : (
          <Tabs defaultValue="approved" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="approved" className="gap-2">
                <Check className="h-4 w-4" />
                Согласованные ({approvedRespondents.length})
              </TabsTrigger>
              <TabsTrigger value="expired" className="gap-2">
                <Clock className="h-4 w-4" />
                Просроченные ({expiredRespondents.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <X className="h-4 w-4" />
                Отклоненные ({rejectedRespondents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approved" className="space-y-3 mt-4">
              {approvedRespondents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет согласованных респондентов
                </div>
              ) : (
                approvedRespondents.map(respondent => (
                  <div
                    key={respondent.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {respondent.evaluator_name}
                      </div>
                      {respondent.evaluator_position && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {respondent.evaluator_position}
                        </div>
                      )}
                      {respondent.approved_at && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Согласовано: {formatDate(respondent.approved_at)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {respondent.status === 'completed' ? (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" />
                          Завершено
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Согласовано
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="expired" className="space-y-3 mt-4">
              {expiredRespondents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет просроченных респондентов
                </div>
              ) : (
                expiredRespondents.map(respondent => (
                  <div
                    key={respondent.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card border-orange-200"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {respondent.evaluator_name}
                      </div>
                      {respondent.evaluator_position && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {respondent.evaluator_position}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600">
                        <Clock className="h-3 w-3" />
                        Просрочено
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-3 mt-4">
              {rejectedRespondents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет отклоненных респондентов
                </div>
              ) : (
                rejectedRespondents.map(respondent => (
                  <div
                    key={respondent.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {respondent.evaluator_name}
                      </div>
                      {respondent.evaluator_position && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {respondent.evaluator_position}
                        </div>
                      )}
                      {respondent.rejection_reason && (
                        <div className="text-sm text-destructive mt-2 p-2 bg-destructive/10 rounded">
                          <span className="font-medium">Причина отклонения:</span> {respondent.rejection_reason}
                        </div>
                      )}
                      {respondent.rejected_at && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Отклонено: {formatDate(respondent.rejected_at)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="gap-1">
                        <X className="h-3 w-3" />
                        Отклонено
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
