import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EmployeeForMeetings {
  id: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
  department_name: string | null;
  manager_name: string | null;
}

/**
 * Hook for admin/hr_bp to fetch all active employees for the "Встречи сотрудников" tab.
 * Does NOT rely on management subtree — uses the full user list.
 */
export const useAllEmployeesForMeetings = (enabled: boolean) => {
  const { user } = useAuth();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['all-employees-for-meetings'],
    queryFn: async () => {
      // Fetch all active users with department and manager info
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, first_name, last_name, manager_id,
          departments(name)
        `)
        .eq('status', true)
        .order('last_name');

      if (error) throw error;

      const users = data || [];

      // Build a map for manager names
      const userMap = new Map(users.map(u => [u.id, u]));

      return users
        .filter(u => u.id !== user?.id) // exclude current user from list
        .map(u => ({
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          manager_id: u.manager_id,
          department_name: (u.departments as any)?.name || null,
          manager_name: u.manager_id
            ? (() => {
                const mgr = userMap.get(u.manager_id);
                return mgr ? `${mgr.last_name || ''} ${mgr.first_name || ''}`.trim() : null;
              })()
            : null,
        })) as EmployeeForMeetings[];
    },
    enabled: enabled && !!user,
  });

  return { employees: employees || [], isLoading };
};
