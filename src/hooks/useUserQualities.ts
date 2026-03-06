import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserQuality {
  id: string;
  quality_id: string;
  current_level: number;
  target_level?: number;
  soft_skills: {
    name: string;
    description?: string;
  };
}

export const useUserQualities = () => {
  const [qualities, setQualities] = useState<UserQuality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchUserQualities = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        
        // Получаем данные пользователя из таблицы users
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', currentUser.email)
          .eq('status', true)
          .maybeSingle();

        if (!userData) {
          setQualities([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('user_qualities')
          .select(`
            id,
            quality_id,
            current_level,
            target_level,
            soft_skills (
              name,
              description
            )
          `)
          .eq('user_id', userData.id);

        if (fetchError) throw fetchError;
        
        // Сортируем по current_level по убыванию
        const sortedQualities = (data || []).sort((a, b) => b.current_level - a.current_level);
        setQualities(sortedQualities);
      } catch (err) {
        console.error('Error fetching user qualities:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке качеств');
      } finally {
        setLoading(false);
      }
    };

    fetchUserQualities();
  }, [currentUser]);

  return { qualities, loading, error };
};