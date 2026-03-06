import React from 'react';
import { CheckCircle, Clock, User, UserCheck, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { isCompleted } from '@/lib/statusMapper';

interface Respondent {
  id: string;
  name: string;
  type: 'self' | 'supervisor' | 'colleague';
  status: string;
  assigned_date: string;
  completed_at?: string;
}

interface RespondentStatusTableProps {
  respondents: Respondent[];
}

export const RespondentStatusTable: React.FC<RespondentStatusTableProps> = ({ respondents }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'self':
        return <User className="w-4 h-4" />;
      case 'supervisor':
        return <UserCheck className="w-4 h-4" />;
      case 'colleague':
        return <Users className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'self':
        return 'Самооценка';
      case 'supervisor':
        return 'Руководитель';
      case 'colleague':
        return 'Коллега';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    if (isCompleted(status)) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Завершено
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
        <Clock className="w-3 h-3 mr-1" />
        Ожидается
      </Badge>
    );
  };

  const sortedRespondents = [...respondents].sort((a, b) => {
    const typeOrder = { self: 0, supervisor: 1, colleague: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>ФИО оценивающего</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Дата назначения</TableHead>
            <TableHead>Дата завершения</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRespondents.map((respondent) => (
            <TableRow key={respondent.id}>
              <TableCell>{getTypeIcon(respondent.type)}</TableCell>
              <TableCell className="font-medium">{respondent.name}</TableCell>
              <TableCell>{getTypeLabel(respondent.type)}</TableCell>
              <TableCell>{getStatusBadge(respondent.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(respondent.assigned_date).toLocaleDateString('ru-RU')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {respondent.completed_at
                  ? new Date(respondent.completed_at).toLocaleDateString('ru-RU')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
          {sortedRespondents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Нет назначенных оценивающих
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};