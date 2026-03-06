import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompetencyProfile } from './useCompetencyProfile';

export interface CareerTrackStep {
  id: string;
  step_order: number;
  duration_months: number;
  description?: string;
  grade: {
    id: string;
    name: string;
    description?: string;
    level?: number;
  };
  required_skills: Array<{
    skill_id: string;
    skill_name: string;
    target_level: number;
    user_level: number;
    is_ready: boolean;
  }>;
  required_qualities: Array<{
    quality_id: string;
    quality_name: string;
    target_level: number;
    user_level: number;
    is_ready: boolean;
  }>;
  overall_readiness: number;
  compatibility_score: number;
}

export interface CareerTrack {
  id: string;
  name: string;
  description?: string;
  track_type: {
    name: string;
    description?: string;
  };
  target_position: {
    name: string;
  };
  duration_months: number;
  steps: CareerTrackStep[];
  compatibility_score: number;
  total_gap: number;
}

export const useCareerTracks = (userId?: string, competencyProfile?: CompetencyProfile) => {
  const [tracks, setTracks] = useState<CareerTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<CareerTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      console.log('useCareerTracks: fetching tracks for user', userId, 'with profile:', competencyProfile);
      fetchCareerTracks();
    }
  }, [userId, competencyProfile]);

  const fetchCareerTracks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем должность пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('position_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const userPositionId = userData?.position_id;

      // Получаем все данные одним запросом для оптимизации
      const [
        { data: tracksData, error: tracksError },
        { data: allSteps, error: stepsError },
        { data: allGradeSkills, error: skillsError },
        { data: allGradeQualities, error: qualitiesError }
      ] = await Promise.all([
        supabase
          .from('career_tracks')
          .select(`
            id,
            name,
            description,
            duration_months,
            track_types (
              name,
              description
            ),
            positions (
              name
            )
          `),
        supabase
          .from('career_track_steps')
          .select(`
            id,
            career_track_id,
            step_order,
            duration_months,
            description,
            grades (
              id,
              name,
              description,
              level,
              position_id
            )
          `)
          .order('step_order'),
        supabase
          .from('grade_skills')
          .select(`
            grade_id,
            skill_id,
            target_level,
            hard_skills:skill_id (
              name
            )
          `),
        supabase
          .from('grade_qualities')
          .select(`
            grade_id,
            quality_id,
            target_level,
            soft_skills:quality_id (
              name
            )
          `)
      ]);

      if (tracksError) throw tracksError;
      if (stepsError) throw stepsError;
      if (skillsError) throw skillsError;
      if (qualitiesError) throw qualitiesError;

      if (!tracksData || tracksData.length === 0) {
        setTracks([]);
        return;
      }

      // Создаем мапы для быстрого доступа
      const stepsMap = new Map();
      const gradeSkillsMap = new Map();
      const gradeQualitiesMap = new Map();

      allSteps?.forEach(step => {
        if (!stepsMap.has(step.career_track_id)) {
          stepsMap.set(step.career_track_id, []);
        }
        stepsMap.get(step.career_track_id).push(step);
      });

      allGradeSkills?.forEach(skill => {
        if (!gradeSkillsMap.has(skill.grade_id)) {
          gradeSkillsMap.set(skill.grade_id, []);
        }
        gradeSkillsMap.get(skill.grade_id).push(skill);
      });

      allGradeQualities?.forEach(quality => {
        if (!gradeQualitiesMap.has(quality.grade_id)) {
          gradeQualitiesMap.set(quality.grade_id, []);
        }
        gradeQualitiesMap.get(quality.grade_id).push(quality);
      });

      // Фильтруем треки: показываем те, которые:
      // 1. Имеют target_position_id равную должности пользователя, ИЛИ
      // 2. Имеют хотя бы один грейд с должностью пользователя
      const filteredTracksData = userPositionId 
        ? tracksData.filter((track: any) => {
            // Проверяем целевую должность трека
            if (track.target_position_id === userPositionId) {
              return true;
            }
            // Проверяем должности в грейдах шагов трека
            const trackSteps = stepsMap.get(track.id) || [];
            return trackSteps.some((step: any) => step.grades?.position_id === userPositionId);
          })
        : tracksData;

      // Обрабатываем треки
      const tracksWithSteps = filteredTracksData.map((track: any) => {
        const trackSteps = stepsMap.get(track.id) || [];
        
        const stepsWithRequirements = trackSteps.map((step: any) => {
          const gradeSkills = gradeSkillsMap.get(step.grades.id) || [];
          const gradeQualities = gradeQualitiesMap.get(step.grades.id) || [];

          // Сравниваем с текущими компетенциями пользователя
          const required_skills = (gradeSkills || []).map((gs: any) => {
            const userSkill = competencyProfile?.skills.find(s => s.id === gs.skill_id);
            return {
              skill_id: gs.skill_id,
              skill_name: gs.hard_skills?.name || 'Unknown',
              target_level: gs.target_level,
              user_level: userSkill?.current_level || 0,
              is_ready: (userSkill?.current_level || 0) >= gs.target_level
            };
          });

          const required_qualities = (gradeQualities || []).map((gq: any) => {
            const userQuality = competencyProfile?.qualities.find(q => q.id === gq.quality_id);
            return {
              quality_id: gq.quality_id,
              quality_name: gq.soft_skills?.name || 'Unknown',
              target_level: gq.target_level,
              user_level: userQuality?.current_level || 0,
              is_ready: (userQuality?.current_level || 0) >= gq.target_level
            };
          });

          // Рассчитываем совместимость шага (weighted score)
          const totalRequirements = required_skills.length + required_qualities.length;
          const readyRequirements = required_skills.filter(s => s.is_ready).length + 
                                  required_qualities.filter(q => q.is_ready).length;
          
          // Базовая готовность
          const basic_readiness = totalRequirements > 0 ? (readyRequirements / totalRequirements) * 100 : 0;
          
          // Детальный расчет совместимости по уровням
          let compatibility_score = 0;
          if (totalRequirements > 0) {
            const skillsMatch = required_skills.reduce((sum, skill) => {
              return sum + Math.min(skill.user_level / skill.target_level, 1);
            }, 0);
            
            const qualitiesMatch = required_qualities.reduce((sum, quality) => {
              return sum + Math.min(quality.user_level / quality.target_level, 1);
            }, 0);
            
            compatibility_score = ((skillsMatch + qualitiesMatch) / totalRequirements) * 100;
          }

          return {
            id: step.id,
            step_order: step.step_order,
            duration_months: step.duration_months,
            description: step.description,
            grade: step.grades,
            required_skills,
            required_qualities,
            overall_readiness: Number(basic_readiness.toFixed(1)),
            compatibility_score: Number(compatibility_score.toFixed(1))
          };
        });

        // Рассчитываем совместимость трека с пользователем
        const allRequiredSkills = stepsWithRequirements.flatMap(s => s.required_skills);
        const allRequiredQualities = stepsWithRequirements.flatMap(s => s.required_qualities);
        
        const totalCompatibility = allRequiredSkills.length + allRequiredQualities.length;
        const readyCompatibility = allRequiredSkills.filter(s => s.is_ready).length + 
                                 allRequiredQualities.filter(q => q.is_ready).length;
        
        const compatibility_score = totalCompatibility > 0 ? (readyCompatibility / totalCompatibility) * 100 : 0;
        
        // Рассчитываем общий gap
        const skillsGap = allRequiredSkills.reduce((sum, s) => sum + Math.max(0, s.target_level - s.user_level), 0);
        const qualitiesGap = allRequiredQualities.reduce((sum, q) => sum + Math.max(0, q.target_level - q.user_level), 0);
        const total_gap = skillsGap + qualitiesGap;

        return {
          id: track.id,
          name: track.name,
          description: track.description,
          track_type: track.track_types,
          target_position: track.positions,
          duration_months: track.duration_months,
          steps: stepsWithRequirements,
          compatibility_score: Number(compatibility_score.toFixed(1)),
          total_gap: Number(total_gap.toFixed(1))
        };
      });

      // Сортируем треки по совместимости
      tracksWithSteps.sort((a, b) => b.compatibility_score - a.compatibility_score);
      
      setTracks(tracksWithSteps);

    } catch (err) {
      console.error('Error fetching career tracks:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке карьерных треков');
    } finally {
      setLoading(false);
    }
  };

  const selectTrack = async (trackId: string, stepId?: string) => {
    try {
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      setSelectedTrack(track);

      // Деактивируем предыдущие треки пользователя
      await supabase
        .from('user_career_progress')
        .update({ status: 'inactive' })
        .eq('user_id', userId)
        .eq('status', 'active');

      // Создаём новый активный трек
      const { error } = await supabase
        .from('user_career_progress')
        .insert({
          user_id: userId,
          career_track_id: trackId,
          current_step_id: stepId,
          status: 'active'
        });

      if (error) throw error;

    } catch (err) {
      console.error('Error selecting track:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при выборе трека');
    }
  };

  return {
    tracks,
    selectedTrack,
    loading,
    error,
    selectTrack,
    refetch: fetchCareerTracks
  };
};