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
import ProjectSelect from './ProjectSelect';

interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  positions?: { name?: string } | null;
  manager_id?: string | null;
  hire_date?: string | null;
  profileStatus: ProfileStatus;
  currentProject?: string;
}

interface Props {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getManagerName: (id: string | null) => string;
  onProjectChange?: (employeeId: string, project: string) => void;
}

const ProfileEmployeeList = ({ employees, selectedId, onSelect, getManagerName, onProjectChange }: Props) => {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-body-lg flex items-center justify-between">
          <span>Сотрудники</span>
          <span className="text-body-md font-normal text-muted-foreground">{employees.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">ФИО</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Проект</TableHead>
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
                    <TableCell className="pl-4 font-medium text-foreground">{fullName}</TableCell>
                    <TableCell className="text-muted-foreground text-body-md">{e.positions?.name || '—'}</TableCell>
                    <TableCell className="text-body-md" onClick={(ev) => ev.stopPropagation()}>
                      {onProjectChange ? (
                        <ProjectSelect
                          value={e.currentProject || ''}
                          onChange={(v) => onProjectChange(e.id, v)}
                          compact
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-muted-foreground">{e.currentProject || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-caption-sm ${profileStatusColors[e.profileStatus]}`}>
                        {profileStatusLabels[e.profileStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-caption-sm"
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
