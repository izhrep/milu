import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserGradeQuality {
  quality_id: string;
  quality_name: string;
  target_level: number;
  current_level: number | null;
  last_assessed: string | null;
}

export const useUserGradeQualities = () => {
  const { user } = useAuth();
  const [qualities, setQualities] = useState<UserGradeQuality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserGradeQualities = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Получаем пользователя с грейдом
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, grade_id')
          .eq('id', user.id)
          .eq('status', true)
          .single();

        if (userError) throw userError;
        if (!userData?.grade_id) {
          setQualities([]);
          setLoading(false);
          return;
        }

        // Получаем качества из грейда
        const { data: gradeQualities, error: gradeQualitiesError } = await supabase
          .from('grade_qualities')
          .select(`
            quality_id,
            target_level,
            soft_skills (
              name
            )
          `)
          .eq('grade_id', userData.grade_id);

        if (gradeQualitiesError) throw gradeQualitiesError;

        // Получаем средние уровни из user_assessment_results
        const { data: assessmentResults, error: assessmentError } = await supabase
          .from('user_assessment_results')
          .select('quality_id, self_assessment, peers_average, manager_assessment, assessment_date')
          .eq('user_id', userData.id)
          .not('quality_id', 'is', null)
          .order('assessment_date', { ascending: false });

        if (assessmentError) throw assessmentError;

        // Создаем Map для быстрого поиска текущих уровней
        // Используем среднее между всеми оценками
        const currentLevelsMap = new Map<string, { level: number; date: string }>();
        assessmentResults?.forEach((result) => {
          if (result.quality_id && !currentLevelsMap.has(result.quality_id)) {
            const avgLevel = (
              (result.self_assessment || 0) +
              (result.manager_assessment || 0) +
              (result.peers_average || 0)
            ) / 3;
            currentLevelsMap.set(result.quality_id, {
              level: avgLevel,
              date: result.assessment_date,
            });
          }
        });

        // Объединяем данные
        const combinedQualities: UserGradeQuality[] = (gradeQualities || []).map((gq: any) => {
          const currentData = currentLevelsMap.get(gq.quality_id);
          return {
            quality_id: gq.quality_id,
            quality_name: gq.soft_skills?.name || 'Неизвестное качество',
            target_level: gq.target_level,
            current_level: currentData?.level || null,
            last_assessed: currentData?.date || null,
          };
        });

        setQualities(combinedQualities);
      } catch (err) {
        console.error('Error fetching user grade qualities:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchUserGradeQualities();
  }, [user?.id]);

  return { qualities, loading, error };
};
