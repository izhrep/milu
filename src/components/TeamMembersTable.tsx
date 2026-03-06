import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, TrendingUp, Eye, ArrowRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MeetingForm } from './MeetingForm';
import { UserCareerTrackView } from './UserCareerTrackView';
import { ManagerRespondentApproval } from './ManagerRespondentApproval';
import { RespondentsListDialog } from './RespondentsListDialog';
import { User } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
interface TeamMembersTableProps {
  members: User[];
  currentUserId: string;
  diagnosticStageId?: string | null;
}

export const TeamMembersTable: React.FC<TeamMembersTableProps> = ({ members, currentUserId, diagnosticStageId }) => {
  const navigate = useNavigate();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedCareerTrackId, setSelectedCareerTrackId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedRespondentUserId, setSelectedRespondentUserId] = useState<string | null>(null);
  const [selectedRespondentUserName, setSelectedRespondentUserName] = useState<string>('');
  const [selectedRespondentViewUserId, setSelectedRespondentViewUserId] = useState<string | null>(null);
  const [selectedRespondentViewUserName, setSelectedRespondentViewUserName] = useState<string>('');

  // Check permissions for managing respondents
  const { hasPermission: canManageAllUsers } = usePermission('users.view');
  const { hasPermission: canManageTeam } = usePermission('team.manage');
  
  // Fallback to active stage if no stage is selected
  const { activeStage } = useDiagnosticStages();
  const effectiveStageId = diagnosticStageId || activeStage?.id;

  // Fetch meetings for all team members
  const { data: meetingsData } = useQuery({
    queryKey: ['team-meetings', currentUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('id, employee_id, status, meeting_date')
        .eq('manager_id', currentUserId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch career progress for all team members
  const { data: careerProgressData } = useQuery({
    queryKey: ['team-career-progress', members.map(m => m.id)],
    queryFn: async () => {
      const memberIds = members.map(m => m.id);
      const { data, error } = await supabase
        .from('user_career_progress')
        .select(`
          user_id,
          career_track_id,
          status,
          career_tracks (
            name,
            description
          )
        `)
        .in('user_id', memberIds)
        .eq('status', 'active');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch assessment results for all team members filtered by stage
  const { data: assessmentsData } = useQuery({
    queryKey: ['team-assessments', members.map(m => m.id), effectiveStageId],
    queryFn: async () => {
      const memberIds = members.map(m => m.id);
      let query = supabase
        .from('user_assessment_results')
        .select('user_id, skill_id, quality_id, self_assessment, peers_average, manager_assessment')
        .in('user_id', memberIds);
      
      if (effectiveStageId) {
        query = query.eq('diagnostic_stage_id', effectiveStageId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveStageId,
  });

  // Fetch respondents status for all team members (only peer assignments)
  // Use effectiveStageId which falls back to active stage if no stage is selected
  const { data: respondentsData, refetch: refetchRespondents } = useQuery({
    queryKey: ['team-respondents', members.map(m => m.id), effectiveStageId],
    queryFn: async () => {
      const memberIds = members.map(m => m.id);
      console.log('Loading respondents for members:', memberIds, 'effectiveStageId:', effectiveStageId);
      
      let query = supabase
        .from('survey_360_assignments')
        .select('evaluated_user_id, status, assignment_type, diagnostic_stage_id')
        .in('evaluated_user_id', memberIds)
        .eq('assignment_type', 'peer'); // Only peer assignments need manager approval
      
      // Always filter by effective stage (either selected or active)
      if (effectiveStageId) {
        query = query.eq('diagnostic_stage_id', effectiveStageId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading respondents:', error);
        throw error;
      }
      
      console.log('Loaded respondents data:', data);
      return data;
    },
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache (formerly cacheTime in v4)
    enabled: !!effectiveStageId, // Only run query when we have a stage ID
  });

  const getCareerTrack = (userId: string): { name: string; trackId: string | null } => {
    const progress = careerProgressData?.find(p => p.user_id === userId);
    if (!progress || !progress.career_tracks) {
      return { name: 'Не выбран', trackId: null };
    }
    return { name: progress.career_tracks.name, trackId: progress.career_track_id };
  };

  const getAverageSkills = (userId: string): number | null => {
    const skillResults = assessmentsData?.filter(
      a => a.user_id === userId && a.skill_id !== null
    );
    if (!skillResults || skillResults.length === 0) return null;
    
    // Вычисляем среднее всех оценок (self, peers, manager)
    let sum = 0;
    let count = 0;
    skillResults.forEach(result => {
      if (result.self_assessment) { sum += result.self_assessment; count++; }
      if (result.peers_average) { sum += result.peers_average; count++; }
      if (result.manager_assessment) { sum += result.manager_assessment; count++; }
    });
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  };

  const getAverageQualities = (userId: string): number | null => {
    const qualityResults = assessmentsData?.filter(
      a => a.user_id === userId && a.quality_id !== null
    );
    if (!qualityResults || qualityResults.length === 0) return null;
    
    // Вычисляем среднее всех оценок (self, peers, manager)
    let sum = 0;
    let count = 0;
    qualityResults.forEach(result => {
      if (result.self_assessment) { sum += result.self_assessment; count++; }
      if (result.peers_average) { sum += result.peers_average; count++; }
      if (result.manager_assessment) { sum += result.manager_assessment; count++; }
    });
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  };

  const handleOpenMeeting = (meetingId: string | null) => {
    if (meetingId) {
      setSelectedMeetingId(meetingId);
    }
  };

  const getMeetingStatus = (userId: string): { id: string; status: string; date: string; variant: 'default' | 'destructive' | 'outline' | 'secondary'; meetingId: string } => {
    const userMeetings = meetingsData?.filter(m => m.employee_id === userId);
    if (!userMeetings || userMeetings.length === 0) {
      return { id: '', status: 'Не назначена', date: '', variant: 'secondary', meetingId: '' };
    }
    
    const latestMeeting = userMeetings[0];
    let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'secondary';
    let status = 'Не назначена';
    
    if (latestMeeting.status === 'draft') {
      variant = 'secondary';
      status = 'Черновик';
    } else if (latestMeeting.status === 'submitted') {
      variant = 'default';
      status = 'Отправлена';
    } else if (latestMeeting.status === 'approved') {
      variant = 'secondary'; // используем secondary для успеха
      status = 'Утверждена';
    } else if (latestMeeting.status === 'returned') {
      variant = 'destructive';
      status = 'Возвращена';
    }
    
    return {
      id: latestMeeting.id,
      status,
      date: latestMeeting.meeting_date || '',
      variant,
      meetingId: latestMeeting.id
    };
  };

  const handleOpenCareerTrack = (trackId: string | null, userName: string) => {
    if (trackId) {
      setSelectedCareerTrackId(trackId);
      setSelectedUserName(userName);
    }
  };

  const getRespondentsStatus = (userId: string, isManager: boolean) => {
    const userAssignments = (respondentsData || []).filter(r => r.evaluated_user_id === userId);
    
    console.log('Getting respondents status for user:', userId, 'assignments:', userAssignments);
    
    // HR BP и администраторы всегда могут добавлять респондентов, даже если assignments нет
    if (userAssignments.length === 0) {
      // Для менеджеров и HR/Admin показываем кнопку для добавления респондентов
      if (canManageAllUsers || (canManageTeam && isManager)) {
        return { status: 'Добавить', variant: 'outline' as const, hasPending: false, isApproved: false, count: 0, isDraft: false };
      }
      return { status: 'Не назначено', variant: 'secondary' as const, hasPending: false, isApproved: false, count: 0, isDraft: true };
    }

    // Подсчёт по статусам
    const pending = userAssignments.filter(a => a.status === 'pending').length;
    const approved = userAssignments.filter(a => a.status === 'approved').length;
    const completed = userAssignments.filter(a => a.status === 'completed').length;
    const rejected = userAssignments.filter(a => a.status === 'rejected').length;
    const expired = userAssignments.filter(a => a.status === 'expired').length;
    
    // Общее количество = pending + approved + completed (активные)
    // expired и rejected НЕ входят в активный подсчёт
    const activeTotal = pending + approved + completed;
    
    // Если есть pending - показываем "Ожидает" с количеством активных
    if (pending > 0) {
      return { status: `Ожидает (${activeTotal})`, variant: 'default' as const, hasPending: true, isApproved: false, count: activeTotal, isDraft: false };
    }
    
    // Если все активные completed - "Завершено"
    if (completed > 0 && completed === activeTotal) {
      return { status: `Завершено (${completed})`, variant: 'secondary' as const, hasPending: false, isApproved: true, count: completed, isDraft: false };
    }
    
    // Если есть expired и нет активных - "Просрочено"
    if (expired > 0 && activeTotal === 0) {
      return { status: `Просрочено (${expired})`, variant: 'destructive' as const, hasPending: false, isApproved: false, count: expired, isDraft: false };
    }
    
    // Если все rejected и нет активных - "Отклонено"
    if (rejected > 0 && activeTotal === 0) {
      return { status: `Отклонено (${rejected})`, variant: 'destructive' as const, hasPending: false, isApproved: false, count: rejected, isDraft: false };
    }
    
    // Если все активные approved - "Согласовано"
    if (approved === activeTotal && approved > 0) {
      return { status: `Согласовано (${approved})`, variant: 'secondary' as const, hasPending: false, isApproved: true, count: approved, isDraft: false };
    }
    
    // Смешанные статусы - показываем общее с учётом всех
    const total = userAssignments.length;
    return { status: `Респонденты (${total})`, variant: 'outline' as const, hasPending: false, isApproved: false, count: total, isDraft: false };
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Категория должностей</TableHead>
              <TableHead>Респонденты</TableHead>
              <TableHead>Встреча 1:1</TableHead>
              <TableHead className="text-center">Hard-навыки</TableHead>
              <TableHead className="text-center">Soft-навыки</TableHead>
              <TableHead>Обратная связь 360</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const fullName = `${member.last_name} ${member.first_name} ${member.middle_name || ''}`.trim();
              const meeting = getMeetingStatus(member.id);
              const careerTrack = getCareerTrack(member.id);
              const avgSkills = getAverageSkills(member.id);
              const avgQualities = getAverageQualities(member.id);
              // Проверяем, является ли текущий пользователь менеджером этого члена команды
              const isManagerOfMember = member.manager_id === currentUserId;
              const respondentsStatus = getRespondentsStatus(member.id, isManagerOfMember);

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/profile?user=${member.id}`)}
                      className="font-medium text-brand-purple hover:underline text-left"
                    >
                      {fullName}
                    </button>
                  </TableCell>
                  <TableCell>{member.positions?.name || '-'}</TableCell>
                  <TableCell>{member.positions?.position_categories?.name || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant={respondentsStatus.hasPending ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        // Если есть pending - открываем диалог согласования
                        if (respondentsStatus.hasPending) {
                          setSelectedRespondentUserId(member.id);
                          setSelectedRespondentUserName(fullName);
                        } else if (!respondentsStatus.isDraft) {
                          // Если есть согласованные/отклоненные - открываем диалог просмотра
                          setSelectedRespondentViewUserId(member.id);
                          setSelectedRespondentViewUserName(fullName);
                        }
                      }}
                      disabled={respondentsStatus.isDraft}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {respondentsStatus.status}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={meeting.variant}>{meeting.status}</Badge>
                      {meeting.meetingId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenMeeting(meeting.meetingId)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {avgSkills !== null ? (
                      <Badge variant="outline">{avgSkills}</Badge>
                    ) : (
                      <span className="text-text-tertiary text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {avgQualities !== null ? (
                      <Badge variant="outline">{avgQualities}</Badge>
                    ) : (
                      <span className="text-text-tertiary text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/assessment/results/${member.id}`, { 
                        state: { 
                          from: '/team',
                          stageId: effectiveStageId 
                        } 
                      })}
                      disabled={avgSkills === null && avgQualities === null}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {avgSkills !== null || avgQualities !== null ? 'Результаты' : 'Нет результатов'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status ? 'default' : 'secondary'}>
                      {member.status ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/profile?user=${member.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Meeting Dialog */}
      <Dialog open={!!selectedMeetingId} onOpenChange={(open) => !open && setSelectedMeetingId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Встреча 1:1</DialogTitle>
          </DialogHeader>
          {selectedMeetingId && (
            <MeetingForm meetingId={selectedMeetingId} isManager onClose={() => setSelectedMeetingId(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Career Track Dialog */}
      <Dialog open={!!selectedCareerTrackId} onOpenChange={(open) => !open && setSelectedCareerTrackId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Карьерный трек - {selectedUserName}</DialogTitle>
          </DialogHeader>
          {selectedCareerTrackId && (
            <UserCareerTrackView trackId={selectedCareerTrackId} />
          )}
        </DialogContent>
      </Dialog>

      {/* Respondent Approval Dialog */}
      {selectedRespondentUserId && (
        <ManagerRespondentApproval
          open={!!selectedRespondentUserId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRespondentUserId(null);
            }
          }}
          evaluatedUserId={selectedRespondentUserId}
          evaluatedUserName={selectedRespondentUserName}
          diagnosticStageId={diagnosticStageId}
          onApprovalComplete={async () => {
            // Force immediate refetch
            await refetchRespondents();
          }}
        />
      )}

      {/* Respondents List View Dialog */}
      {selectedRespondentViewUserId && (
        <RespondentsListDialog
          open={!!selectedRespondentViewUserId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRespondentViewUserId(null);
            }
          }}
          evaluatedUserId={selectedRespondentViewUserId}
          evaluatedUserName={selectedRespondentViewUserName}
          diagnosticStageId={diagnosticStageId}
        />
      )}
    </>
  );
};
