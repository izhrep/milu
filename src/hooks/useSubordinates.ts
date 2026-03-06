import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useSubordinates = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['subordinates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('manager_id', user.id)
        .order('last_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return {
    subordinates: query.data || [],
    isLoading: query.isLoading,
    isManager: (query.data?.length ?? 0) > 0,
  };
};
