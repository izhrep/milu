import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export interface SubordinateUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  manager_id: string | null;
  position_id: string | null;
  department_id: string | null;
  status: boolean | null;
  email: string | null;
  positions: { name: string; position_categories: { name: string } | null } | null;
  departments: { name: string } | null;
}

export interface SubordinateGroup {
  managerId: string;
  managerName: string;
  isDirect: boolean;
  members: SubordinateUser[];
}

export const useSubordinateTree = (managerId?: string) => {
  const { user } = useAuth();
  const effectiveManagerId = managerId || user?.id;

  // Get all subtree IDs via RPC
  const { data: subtreeIds, isLoading: loadingIds } = useQuery({
    queryKey: ['management-subtree-ids', effectiveManagerId],
    queryFn: async () => {
      if (!effectiveManagerId) return [];
      const { data, error } = await supabase
        .rpc('get_management_subtree_ids', { _manager_id: effectiveManagerId });
      if (error) throw error;
      return (data as string[]) || [];
    },
    enabled: !!effectiveManagerId,
  });

  // Fetch user details for all subtree IDs
  const { data: subtreeUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['management-subtree-users', subtreeIds],
    queryFn: async () => {
      if (!subtreeIds || subtreeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, first_name, last_name, middle_name, manager_id,
          position_id, department_id, status, email,
          positions(name, position_categories(name)),
          departments(name)
        `)
        .in('id', subtreeIds)
        .order('last_name');
      if (error) throw error;
      return (data || []) as SubordinateUser[];
    },
    enabled: !!subtreeIds && subtreeIds.length > 0,
  });

  // Group users by their immediate manager
  const grouped = useMemo(() => {
    if (!subtreeUsers || !effectiveManagerId) return [];

    const groups: Map<string, SubordinateUser[]> = new Map();
    
    subtreeUsers.forEach(u => {
      const mgr = u.manager_id || 'unknown';
      if (!groups.has(mgr)) groups.set(mgr, []);
      groups.get(mgr)!.push(u);
    });

    const result: SubordinateGroup[] = [];

    // Direct reports first
    const directReports = groups.get(effectiveManagerId) || [];
    if (directReports.length > 0) {
      result.push({
        managerId: effectiveManagerId,
        managerName: 'Прямые подчинённые',
        isDirect: true,
        members: directReports,
      });
    }

    // Indirect reports grouped by their immediate manager
    groups.forEach((members, mgrId) => {
      if (mgrId === effectiveManagerId) return;
      // Find manager name from subtreeUsers or direct reports
      const mgrUser = subtreeUsers.find(u => u.id === mgrId);
      const mgrName = mgrUser
        ? `${mgrUser.last_name || ''} ${mgrUser.first_name || ''}`.trim()
        : 'Неизвестный руководитель';
      result.push({
        managerId: mgrId,
        managerName: `Подчинённые: ${mgrName}`,
        isDirect: false,
        members,
      });
    });

    return result;
  }, [subtreeUsers, effectiveManagerId]);

  const isDirect = useMemo(() => {
    return (userId: string) => {
      const directGroup = grouped.find(g => g.isDirect);
      return directGroup?.members.some(m => m.id === userId) ?? false;
    };
  }, [grouped]);

  const allSubtreeUsers = subtreeUsers || [];
  const allSubtreeIds = subtreeIds || [];

  return {
    allSubtreeUsers,
    allSubtreeIds,
    groupedByManager: grouped,
    isDirect,
    isLoading: loadingIds || loadingUsers,
    directCount: grouped.find(g => g.isDirect)?.members.length || 0,
    indirectCount: allSubtreeUsers.length - (grouped.find(g => g.isDirect)?.members.length || 0),
  };
};
