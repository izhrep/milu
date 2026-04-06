import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Users, FileText } from 'lucide-react';
import {
  ManagementProfile,
  computeProfileStatus,
  profileStatusLabels,
  profileStatusColors,
  computeTaskStatus,
  emptyProfile,
} from './profileTypes';
import ProfileForm from './ProfileForm';

interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  email?: string;
  positions?: { name?: string } | null;
  departments?: { name?: string } | null;
  manager_id?: string | null;
  hire_date?: string | null;
  employee_number?: string | null;
  status?: boolean | string | null;
}

interface Props {
  employee: Employee;
  profile: ManagementProfile | null;
  onSave: (data: ManagementProfile) => void;
  onSaveAndNext: (data: ManagementProfile) => void;
  getManagerName: (id: string | null) => string;
}

const ProfileCard = ({ employee, profile, onSave, onSaveAndNext, getManagerName }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const status = computeProfileStatus(profile);
  const taskStatus = computeTaskStatus(status);
  const fullName = `${employee.last_name || ''} ${employee.first_name || ''} ${employee.middle_name || ''}`.trim();

  return (
    <div className="space-y-4">
      {/* System profile (readonly) */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Системный профиль
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-text-secondary">ФИО</span>
              <p className="font-medium text-text-primary">{fullName || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Статус сотрудника</span>
              <p className="font-medium text-text-primary">{(employee as any).status || 'Активен'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Должность</span>
              <p className="font-medium text-text-primary">{employee.positions?.name || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Подразделение</span>
              <p className="font-medium text-text-primary">{(employee as any).departments?.name || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Руководитель</span>
              <p className="font-medium text-text-primary">{getManagerName(employee.manager_id || null)}</p>
            </div>
            <div>
              <span className="text-text-secondary">Дата начала работы</span>
              <p className="font-medium text-text-primary">{employee.hire_date || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Email</span>
              <p className="font-medium text-text-primary">{employee.email || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary">Табельный номер</span>
              <p className="font-medium text-text-primary">{(employee as any).employee_number || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management profile */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Управленческий профиль
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${profileStatusColors[status]}`}>
                {profileStatusLabels[status]}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {taskStatus}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isEditing && !profile ? (
            // Empty state
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary mb-4">
                По сотруднику еще не зафиксировано текущее управленческое состояние
              </p>
              <Button onClick={() => setIsEditing(true)}>
                Заполнить профиль
              </Button>
            </div>
          ) : (
            <ProfileForm
              initial={profile || emptyProfile}
              onSave={(data) => {
                onSave(data);
                setIsEditing(false);
              }}
              onSaveAndNext={(data) => {
                onSaveAndNext(data);
                setIsEditing(false);
              }}
              onCancel={profile ? () => setIsEditing(false) : undefined}
              isEditing={isEditing || !profile}
              onStartEdit={() => setIsEditing(true)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileCard;
