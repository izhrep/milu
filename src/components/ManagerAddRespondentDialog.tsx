import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decryptUserData } from '@/lib/userDataDecryption';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  position?: string;
  position_category?: string;
  company?: string;
  department?: string;
}

interface ManagerAddRespondentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluatedUserId: string;
  managerId: string;
  diagnosticStageId?: string;
  onRespondentAdded: () => void;
}

export const ManagerAddRespondentDialog: React.FC<ManagerAddRespondentDialogProps> = ({
  open,
  onOpenChange,
  evaluatedUserId,
  managerId,
  diagnosticStageId,
  onRespondentAdded,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.first_name.toLowerCase().includes(query) ||
            user.last_name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Получаем всех пользователей
      const { data: allUsersRaw, error: usersError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, middle_name, status, position_id, department_id');

      if (usersError) throw usersError;

      // Фильтруем активных пользователей, кроме evaluated user и manager
      const usersData = (allUsersRaw || []).filter(
        u => u.status === true && u.id !== evaluatedUserId && u.id !== managerId
      );

      // Fetch positions and departments
      const positionIds = usersData.map(u => u.position_id).filter(Boolean);
      const departmentIds = usersData.map(u => u.department_id).filter(Boolean);

      const [positionsResult, departmentsResult] = await Promise.all([
        supabase.from('positions').select('id, name, position_category_id').in('id', positionIds),
        supabase.from('departments').select('id, name, company_id').in('id', departmentIds)
      ]);

      const positionsMap = new Map(positionsResult.data?.map(p => [p.id, { name: p.name, position_category_id: p.position_category_id }]) || []);
      const departmentsMap = new Map(departmentsResult.data?.map(d => [d.id, { name: d.name, company_id: d.company_id }]) || []);

      // Fetch position categories
      const positionCategoryIds = positionsResult.data?.map(p => p.position_category_id).filter(Boolean) || [];
      const { data: positionCategoriesData } = await supabase
        .from('position_categories')
        .select('id, name')
        .in('id', positionCategoryIds);
      
      const positionCategoriesMap = new Map(positionCategoriesData?.map(pc => [pc.id, pc.name]) || []);

      // Fetch companies
      const companyIds = departmentsResult.data?.map(d => d.company_id).filter(Boolean) || [];
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      
      const companiesMap = new Map(companiesData?.map(c => [c.id, c.name]) || []);

      // Получаем роли
      const userIds = usersData.map((u) => u.id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map<string, string[]>();
      rolesData?.forEach((r) => {
        if (!rolesMap.has(r.user_id)) {
          rolesMap.set(r.user_id, []);
        }
        rolesMap.get(r.user_id)?.push(r.role);
      });

      // Фильтруем только employee и manager
      const validUsers = usersData.filter((user) => {
        const roles = rolesMap.get(user.id) || [];
        const hasValidRole = roles.includes('employee') || roles.includes('manager');
        const hasInvalidRole = roles.includes('hr_bp') || roles.includes('admin');
        return hasValidRole && !hasInvalidRole;
      });

      // Получаем существующие assignments
      const { data: existingAssignments } = await supabase
        .from('survey_360_assignments')
        .select('evaluating_user_id')
        .eq('evaluated_user_id', evaluatedUserId)
        .in('status', ['pending', 'approved', 'completed']);

      const existingUserIds = new Set(
        existingAssignments?.map((a) => a.evaluating_user_id) || []
      );

      // Фильтруем пользователей, которые еще не назначены
      const availableUsers = validUsers.filter(
        (user) => !existingUserIds.has(user.id)
      );

      // Расшифровываем имена и добавляем должности
      const decryptedUsers = await Promise.all(
        availableUsers.map(async (user: any) => {
          try {
            const decryptedData = await decryptUserData({
              first_name: user.first_name,
              last_name: user.last_name,
              middle_name: user.middle_name,
              email: user.email,
            });
            
            const positionInfo = user.position_id ? positionsMap.get(user.position_id) : undefined;
            const position = positionInfo?.name;
            const positionCategory = positionInfo?.position_category_id ? positionCategoriesMap.get(positionInfo.position_category_id) : undefined;
            const departmentInfo = user.department_id ? departmentsMap.get(user.department_id) : undefined;
            const department = departmentInfo?.name;
            const company = departmentInfo?.company_id ? companiesMap.get(departmentInfo.company_id) : undefined;
            
            return {
              id: user.id,
              first_name: decryptedData.first_name,
              last_name: decryptedData.last_name,
              middle_name: decryptedData.middle_name,
              email: decryptedData.email,
              position,
              position_category: positionCategory,
              company,
              department
            };
          } catch (error) {
            console.error('Error decrypting user data:', error);
            return {
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              middle_name: user.middle_name,
              email: user.email,
              position: undefined,
              position_category: undefined,
              company: undefined,
              department: undefined
            };
          }
        })
      );

      setUsers(decryptedUsers);
      setFilteredUsers(decryptedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Ошибка при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleAddRespondents = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Выберите хотя бы одного сотрудника');
      return;
    }

    try {
      setSubmitting(true);

      // Создаем assignments со статусом approved и added_by_manager=true
      const assignments = Array.from(selectedUsers).map((userId) => ({
        evaluated_user_id: evaluatedUserId,
        evaluating_user_id: userId,
        diagnostic_stage_id: diagnosticStageId,
        assignment_type: 'peer',
        status: 'approved',
        added_by_manager: true,
        approved_by: managerId,
        approved_at: new Date().toISOString(),
      }));

      const { data: createdAssignments, error: assignmentsError } = await supabase
        .from('survey_360_assignments')
        .insert(assignments)
        .select();

      if (assignmentsError) throw assignmentsError;

      // Создаем задачи для оценивающих
      const { data: evaluatedUser } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', evaluatedUserId)
        .single();

      const evaluatedUserName = evaluatedUser
        ? `${evaluatedUser.last_name} ${evaluatedUser.first_name}`
        : 'Сотрудник';

      await supabase.functions.invoke('create-peer-evaluation-tasks', {
        body: {
          approvedAssignments: createdAssignments,
          diagnosticStageId,
          evaluatedUserName,
        },
      });

      toast.success(`Добавлено респондентов: ${selectedUsers.size}`);
      setSelectedUsers(new Set());
      setSearchQuery('');
      onRespondentAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding respondents:', error);
      toast.error('Ошибка при добавлении респондентов');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Добавить оценивающих</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Поиск по имени, email или должности..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {searchQuery ? 'Пользователи не найдены' : 'Нет доступных пользователей'}
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/5 cursor-pointer"
                    onClick={() => handleToggleUser(user.id)}
                  >
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {user.last_name} {user.first_name}{' '}
                        {user.middle_name && user.middle_name}
                      </p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {user.email && <p>{user.email}</p>}
                        {user.position && <p>{user.position}</p>}
                        {user.position_category && <p>Категория должности: {user.position_category}</p>}
                        {user.company && <p>Компания: {user.company}</p>}
                        {user.department && <p>Подразделение: {user.department}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Выбрано: {selectedUsers.size}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={handleAddRespondents}
                  disabled={selectedUsers.size === 0 || submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Добавить респондентов
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
