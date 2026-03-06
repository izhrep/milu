import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  full_name?: string; // Computed field
  email: string;
  employee_number: string;
  status: boolean;
  start_date?: string;
  manager_id?: string;
  department_id?: string;
  position_id?: string;
  hr_bp_id?: string;
  role_name?: string; // Computed from user_roles table
  department_name?: string; // Computed from departments table
  roles?: {
    name: string;
    role: string;
  }[];
  departments?: {
    name: string;
    company_id?: string;
  } | null;
  positions?: {
    name: string;
    position_categories?: {
      name: string;
    } | null;
  } | null;
  manager?: {
    last_name: string;
    first_name: string;
    middle_name?: string;
  } | null;
}

export function getFullName(user: { last_name?: string; first_name?: string; middle_name?: string } | null | undefined): string {
  if (!user) return '';
  return [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ');
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch encrypted users from Supabase (оптимизированный запрос с ограничением полей)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, last_name, first_name, middle_name, email, employee_number, status, start_date, manager_id, department_id, position_id, hr_bp_id')
        .eq('status', true);

      if (usersError) throw usersError;

      // Data is now stored unencrypted, use directly
      const transformedUsersData = usersData || [];

      // Fetch related data separately from Supabase
      const [departmentsData, positionsData, userRolesData] = await Promise.all([
        supabase.from('departments').select('id, name, company_id'),
        supabase.from('positions').select('id, name, position_categories(id, name)'),
        supabase.from('user_roles').select('user_id, role')
      ]);

      const departments = departmentsData.data || [];
      const positions = positionsData.data || [];
      const userRoles = userRolesData.data || [];

      // Transform data to include joined information
      const transformedUsers = transformedUsersData.map((user: any) => {
        const department = departments.find(d => d.id === user.department_id);
        const position = positions.find(p => p.id === user.position_id);
        const manager = transformedUsersData.find((u: any) => u.id === user.manager_id);
        const userRoleRecords = userRoles.filter(ur => ur.user_id === user.id);
        
        // Map role enum to Russian name
        const roleNameMap: Record<string, string> = {
          'admin': 'Администратор',
          'manager': 'Руководитель',
          'employee': 'Сотрудник',
          'hr_bp': 'HR BP',
          'hr': 'HR BP'
        };

        return {
          ...user,
          full_name: getFullName(user),
          role_name: userRoleRecords.length > 0 ? (roleNameMap[userRoleRecords[0].role] || userRoleRecords[0].role) : undefined,
          department_name: department?.name || 'Не указан',
          departments: department ? { name: department.name, company_id: department.company_id } : null,
          positions: position ? { 
            name: position.name,
            position_categories: (position as any).position_categories || null
          } : null,
          roles: userRoleRecords.map(ur => ({
            name: roleNameMap[ur.role] || ur.role,
            role: ur.role
          })),
          manager: manager ? { 
            last_name: manager.last_name, 
            first_name: manager.first_name, 
            middle_name: manager.middle_name 
          } : null,
        };
      });
      
      setUsers(transformedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUser = () => {
    // Return null - current user should be determined by auth context
    return null;
  };

  const getUsersByRole = (roleName: string) => {
    return users.filter(user => user.roles?.some(r => r.name === roleName));
  };

  const getUsersByDepartment = (departmentId: string) => {
    return users.filter(user => user.department_id === departmentId);
  };

  const getSupervisor = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user?.manager_id) return null;
    return users.find(u => u.id === user.manager_id);
  };

  const getColleagues = (excludeUserId?: string) => {
    return users.filter(user => user.id !== excludeUserId);
  };

  // Получить коллег (пользователей с тем же руководителем)
  const getColleaguesWithSameSupervisor = (userId: string): User[] => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.manager_id) return [];
    
    return users.filter(u => 
      u.manager_id === user.manager_id && 
      u.id !== userId
    );
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    getCurrentUser,
    getUsersByRole,
    getUsersByDepartment,
    getSupervisor,
    getColleagues,
    getColleaguesWithSameSupervisor,
  };
};