import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserSkill {
  id: string;
  skill_id: string;
  current_level: number;
  target_level?: number;
  hard_skills: {
    name: string;
    description?: string;
  };
}

export const useUserSkills = () => {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchUserSkills = async () => {
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
          setSkills([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('user_skills')
          .select(`
            id,
            skill_id,
            current_level,
            target_level,
            hard_skills (
              name,
              description
            )
          `)
          .eq('user_id', userData.id);

        if (fetchError) throw fetchError;
        
        // Сортируем по current_level по убыванию
        const sortedSkills = (data || []).sort((a, b) => b.current_level - a.current_level);
        setSkills(sortedSkills);
      } catch (err) {
        console.error('Error fetching user skills:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке навыков');
      } finally {
        setLoading(false);
      }
    };

    fetchUserSkills();
  }, [currentUser]);

  return { skills, loading, error };
};