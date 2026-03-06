import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PeerSelectionUser {
  id: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  email?: string;
  department_id?: string;
  position_id?: string;
  position_name?: string;
  position_category?: string;
}

/**
 * Hook for fetching users available for peer selection
 * Uses SECURITY DEFINER function to limit exposed PII
 */
export const usePeerSelectionUsers = () => {
  const [users, setUsers] = useState<PeerSelectionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (currentUserId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Use SECURITY DEFINER function that returns only minimal fields
      const { data, error: fetchError } = await supabase
        .rpc('get_users_for_peer_selection', {
          _current_user_id: currentUserId
        });

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setUsers([]);
        return [];
      }

      // Fetch position names for the users
      const positionIds = [...new Set(data.map((u: any) => u.position_id).filter(Boolean))];
      
      let positionMap: Record<string, { name: string; category: string }> = {};
      
      if (positionIds.length > 0) {
        const { data: positions } = await supabase
          .from('positions')
          .select('id, name, position_categories(name)')
          .in('id', positionIds);
        
        if (positions) {
          positionMap = positions.reduce((acc: any, p: any) => {
            acc[p.id] = {
              name: p.name,
              category: (p.position_categories as any)?.name || ''
            };
            return acc;
          }, {});
        }
      }

      const enrichedUsers: PeerSelectionUser[] = data.map((user: any) => ({
        id: user.id,
        last_name: user.last_name || '',
        first_name: user.first_name || '',
        middle_name: user.middle_name || undefined,
        email: user.email || undefined,
        department_id: user.department_id || undefined,
        position_id: user.position_id || undefined,
        position_name: user.position_id ? positionMap[user.position_id]?.name : undefined,
        position_category: user.position_id ? positionMap[user.position_id]?.category : undefined,
      }));

      setUsers(enrichedUsers);
      return enrichedUsers;
    } catch (err) {
      console.error('Error fetching peer selection users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки пользователей';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers
  };
};
