import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ProfileStatus,
  profileStatusLabels,
  profileStatusColors,
  actionLabel,
} from './profileTypes';

interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  positions?: { name?: string } | null;
  manager_id?: string | null;
  hire_date?: string | null;
  profileStatus: ProfileStatus;
}

interface Props {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getManagerName: (id: string | null) => string;
}

const ProfileEmployeeList = ({ employees, selectedId, onSelect, getManagerName }: Props) => {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Сотрудники</span>
          <span className="text-sm font-normal text-text-secondary">{employees.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">ФИО</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="pr-4">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(e => {
                const fullName = `${e.last_name || ''} ${e.first_name || ''}`.trim() || '—';
                const isSelected = e.id === selectedId;
                return (
                  <TableRow
                    key={e.id}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => onSelect(e.id)}
                  >
                    <TableCell className="pl-4 font-medium text-text-primary">{fullName}</TableCell>
                    <TableCell className="text-text-secondary text-sm">{e.positions?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${profileStatusColors[e.profileStatus]}`}>
                        {profileStatusLabels[e.profileStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs"
                        onClick={(ev) => { ev.stopPropagation(); onSelect(e.id); }}
                      >
                        {actionLabel[e.profileStatus]}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-text-secondary">
                    Нет сотрудников по выбранным фильтрам
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ProfileEmployeeList;
