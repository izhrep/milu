import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserGradeSkill {
  skill_id: string;
  skill_name: string;
  target_level: number;
  current_level: number | null;
  last_assessed: string | null;
}

export const useUserGradeSkills = () => {
  const { user } = useAuth();
  const [skills, setSkills] = useState<UserGradeSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserGradeSkills = async () => {
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
          setSkills([]);
          setLoading(false);
          return;
        }

        // Получаем навыки из грейда
        const { data: gradeSkills, error: gradeSkillsError } = await supabase
          .from('grade_skills')
          .select(`
            skill_id,
            target_level,
            hard_skills (
              name
            )
          `)
          .eq('grade_id', userData.grade_id);

        if (gradeSkillsError) throw gradeSkillsError;

        // Получаем средние уровни из user_assessment_results
        const { data: assessmentResults, error: assessmentError } = await supabase
          .from('user_assessment_results')
          .select('skill_id, self_assessment, peers_average, manager_assessment, assessment_date')
          .eq('user_id', userData.id)
          .not('skill_id', 'is', null)
          .order('assessment_date', { ascending: false });

        if (assessmentError) throw assessmentError;

        // Создаем Map для быстрого поиска текущих уровней
        // Используем среднее между самооценкой и оценкой руководителя
        const currentLevelsMap = new Map<string, { level: number; date: string }>();
        assessmentResults?.forEach((result) => {
          if (result.skill_id && !currentLevelsMap.has(result.skill_id)) {
            const avgLevel = (
              (result.self_assessment || 0) +
              (result.manager_assessment || 0) +
              (result.peers_average || 0)
            ) / 3;
            currentLevelsMap.set(result.skill_id, {
              level: avgLevel,
              date: result.assessment_date,
            });
          }
        });

        // Объединяем данные
        const combinedSkills: UserGradeSkill[] = (gradeSkills || []).map((gs: any) => {
          const currentData = currentLevelsMap.get(gs.skill_id);
          return {
            skill_id: gs.skill_id,
            skill_name: gs.hard_skills?.name || 'Неизвестный навык',
            target_level: gs.target_level,
            current_level: currentData?.level || null,
            last_assessed: currentData?.date || null,
          };
        });

        setSkills(combinedSkills);
      } catch (err) {
        console.error('Error fetching user grade skills:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchUserGradeSkills();
  }, [user?.id]);

  return { skills, loading, error };
};
