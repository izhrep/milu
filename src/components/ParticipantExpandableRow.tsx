import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User, UserCheck, Users } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getFullName } from '@/hooks/useUsers';

interface RespondentInfo {
  id: string;
  name: string;
  position: string;
  feedbackType: 'self' | 'colleague' | 'manager';
  status: 'new' | 'in_progress' | 'completed' | 'expired';
  hasResults: boolean;
}

interface ParticipantExpandableRowProps {
  userId: string;
  fullName: string;
  position: string;
  selfCompleted: boolean;
  colleaguesCount: number;
  colleaguesCompleted: number;
  managerCompleted: boolean;
  stageId: string;
  users: any[];
}

export const ParticipantExpandableRow: React.FC<ParticipantExpandableRowProps> = ({
  userId,
  fullName,
  position,
  selfCompleted,
  colleaguesCount,
  colleaguesCompleted,
  managerCompleted,
  stageId,
  users,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch respondents data when expanded
  const { data: respondents, isLoading } = useQuery({
    queryKey: ['participant-respondents', userId, stageId],
    queryFn: async () => {
      const respondentsList: RespondentInfo[] = [];
      const user = users.find(u => u.id === userId);
      const managerId = user?.manager_id;

      // Self assessment
      const { data: selfHardResults } = await supabase
        .from('hard_skill_results')
        .select('id, is_draft')
        .eq('evaluated_user_id', userId)
        .eq('evaluating_user_id', userId)
        .eq('diagnostic_stage_id', stageId);

      const { data: selfSoftResults } = await supabase
        .from('soft_skill_results')
        .select('id, is_draft')
        .eq('evaluated_user_id', userId)
        .eq('evaluating_user_id', userId)
        .eq('diagnostic_stage_id', stageId);

      const selfHasAnyResults = (selfHardResults && selfHardResults.length > 0) || 
                                (selfSoftResults && selfSoftResults.length > 0);
      const selfHasCompletedResults = 
        (selfHardResults?.some(r => !r.is_draft)) || 
        (selfSoftResults?.some(r => !r.is_draft));

      let selfStatus: 'new' | 'in_progress' | 'completed' = 'new';
      if (selfHasCompletedResults) {
        selfStatus = 'completed';
      } else if (selfHasAnyResults) {
        selfStatus = 'in_progress';
      }

      respondentsList.push({
        id: `self-${userId}`,
        name: getFullName(user) || 'Не указано',
        position: user?.positions?.name || 'Не указано',
        feedbackType: 'self',
        status: selfStatus,
        hasResults: selfHasCompletedResults || false,
      });

      // Manager assessment
      if (managerId) {
        const manager = users.find(u => u.id === managerId);
        
        const { data: mgrHardResults } = await supabase
          .from('hard_skill_results')
          .select('id, is_draft')
          .eq('evaluated_user_id', userId)
          .eq('evaluating_user_id', managerId)
          .eq('diagnostic_stage_id', stageId);

        const { data: mgrSoftResults } = await supabase
          .from('soft_skill_results')
          .select('id, is_draft')
          .eq('evaluated_user_id', userId)
          .eq('evaluating_user_id', managerId)
          .eq('diagnostic_stage_id', stageId);

        const mgrHasAnyResults = (mgrHardResults && mgrHardResults.length > 0) || 
                                  (mgrSoftResults && mgrSoftResults.length > 0);
        const mgrHasCompletedResults = 
          (mgrHardResults?.some(r => !r.is_draft)) || 
          (mgrSoftResults?.some(r => !r.is_draft));

        let mgrStatus: 'new' | 'in_progress' | 'completed' = 'new';
        if (mgrHasCompletedResults) {
          mgrStatus = 'completed';
        } else if (mgrHasAnyResults) {
          mgrStatus = 'in_progress';
        }

        respondentsList.push({
          id: `manager-${managerId}`,
          name: getFullName(manager) || 'Не указано',
          position: manager?.positions?.name || 'Не указано',
          feedbackType: 'manager',
          status: mgrStatus,
          hasResults: mgrHasCompletedResults || false,
        });
      }

      // Get assigned colleagues (include expired to show them in monitoring)
      const { data: assignedColleagues } = await supabase
        .from('survey_360_assignments')
        .select('evaluating_user_id, status')
        .eq('evaluated_user_id', userId)
        .eq('diagnostic_stage_id', stageId)
        .eq('assignment_type', 'peer')
        .in('status', ['approved', 'completed', 'pending', 'expired']);

      if (assignedColleagues) {
        for (const assignment of assignedColleagues) {
          const colleague = users.find(u => u.id === assignment.evaluating_user_id);
          
          // Check if colleague has results
          const { data: colHardResults } = await supabase
            .from('hard_skill_results')
            .select('id, is_draft')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .eq('diagnostic_stage_id', stageId);

          const { data: colSoftResults } = await supabase
            .from('soft_skill_results')
            .select('id, is_draft')
            .eq('evaluated_user_id', userId)
            .eq('evaluating_user_id', assignment.evaluating_user_id)
            .eq('diagnostic_stage_id', stageId);

          const colHasAnyResults = (colHardResults && colHardResults.length > 0) || 
                                    (colSoftResults && colSoftResults.length > 0);
          const colHasCompletedResults = 
            (colHardResults?.some(r => !r.is_draft)) || 
            (colSoftResults?.some(r => !r.is_draft));

          let colStatus: 'new' | 'in_progress' | 'completed' | 'expired' = 'new';
          
          // Check if assignment is expired
          if (assignment.status === 'expired') {
            colStatus = 'expired';
          } else if (colHasCompletedResults) {
            colStatus = 'completed';
          } else if (colHasAnyResults) {
            colStatus = 'in_progress';
          }

          respondentsList.push({
            id: `colleague-${assignment.evaluating_user_id}`,
            name: getFullName(colleague) || 'Не указано',
            position: colleague?.positions?.name || 'Не указано',
            feedbackType: 'colleague',
            status: colStatus,
            hasResults: colHasCompletedResults || false,
          });
        }
      }

      return respondentsList;
    },
    enabled: isOpen,
  });

  const getFeedbackTypeLabel = (type: 'self' | 'colleague' | 'manager') => {
    switch (type) {
      case 'self': return 'Личный фидбек';
      case 'colleague': return 'Фидбек коллег';
      case 'manager': return 'Фидбек unit-лида';
    }
  };

  const getFeedbackTypeIcon = (type: 'self' | 'colleague' | 'manager') => {
    switch (type) {
      case 'self': return <User className="h-4 w-4" />;
      case 'colleague': return <Users className="h-4 w-4" />;
      case 'manager': return <UserCheck className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: 'new' | 'in_progress' | 'completed' | 'expired', hasResults: boolean) => {
    if (status === 'completed') {
      return (
        <div className="flex gap-1">
          <Badge className="bg-green-100 text-green-700 border-green-300">Выполнено</Badge>
          {hasResults && <Badge variant="outline" className="text-blue-600 border-blue-300">Есть результаты</Badge>}
        </div>
      );
    }
    if (status === 'expired') {
      return <Badge className="bg-red-100 text-red-700 border-red-300">Просрочено</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Выполняется</Badge>;
    }
    return <Badge variant="secondary">Новый</Badge>;
  };

  // Calculate overall status for the row
  const getOverallSelfStatus = () => {
    if (selfCompleted) return <Badge className="bg-green-100 text-green-700 border-green-300">Выполнено</Badge>;
    return <Badge variant="secondary">Новый</Badge>;
  };

  const getOverallManagerStatus = () => {
    if (managerCompleted) return <Badge className="bg-green-100 text-green-700 border-green-300">Выполнено</Badge>;
    return <Badge variant="secondary">Новый</Badge>;
  };

  const getOverallColleaguesStatus = () => {
    if (colleaguesCompleted > 0 && colleaguesCompleted >= colleaguesCount) {
      return <Badge className="bg-green-100 text-green-700 border-green-300">Выполнено ({colleaguesCompleted}/{colleaguesCount})</Badge>;
    }
    if (colleaguesCompleted > 0) {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Выполняется ({colleaguesCompleted}/{colleaguesCount})</Badge>;
    }
    if (colleaguesCount > 0) {
      return <Badge variant="secondary">Новый (0/{colleaguesCount})</Badge>;
    }
    return <Badge variant="secondary">Нет оценок</Badge>;
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {fullName}
          </div>
        </TableCell>
        <TableCell>{position}</TableCell>
        <TableCell>{getOverallSelfStatus()}</TableCell>
        <TableCell>{getOverallColleaguesStatus()}</TableCell>
        <TableCell>{getOverallManagerStatus()}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={5} className="p-0">
            <div className="p-4 pl-12">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Загрузка респондентов...</div>
              ) : respondents && respondents.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 font-medium">ФИО</th>
                        <th className="text-left p-2 font-medium">Должность</th>
                        <th className="text-left p-2 font-medium">Тип фидбека</th>
                        <th className="text-left p-2 font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respondents.map((respondent) => (
                        <tr key={respondent.id} className="border-t">
                          <td className="p-2">{respondent.name}</td>
                          <td className="p-2 text-muted-foreground">{respondent.position}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getFeedbackTypeIcon(respondent.feedbackType)}
                              {getFeedbackTypeLabel(respondent.feedbackType)}
                            </div>
                          </td>
                          <td className="p-2">{getStatusBadge(respondent.status, respondent.hasResults)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Нет респондентов</div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};