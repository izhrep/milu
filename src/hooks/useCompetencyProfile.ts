import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompetencyResult {
  id: string;
  name: string;
  current_level: number;
  target_level?: number;
  gap: number;
  source: 'self' | 'supervisor' | '360' | 'mixed';
  category: string;
  last_assessed?: string;
}

export interface CompetencyProfile {
  skills: CompetencyResult[];
  qualities: CompetencyResult[];
  overall_score: number;
  total_gap: number;
}

export const useCompetencyProfile = (userId?: string) => {
  const [profile, setProfile] = useState<CompetencyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchCompetencyProfile();
    }
  }, [userId]);

  const fetchCompetencyProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем все данные параллельно для оптимизации
      const [
        { data: userData, error: userError },
        { data: skillResults, error: skillError },
        { data: qualityData, error: qualityError }
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, position_id')
          .eq('id', userId)
          .single(),
        supabase
          .from('hard_skill_results')
          .select(`
            *,
            hard_skill_questions!inner (
              skill_id,
              hard_skills:skill_id (
                name,
                description
              )
            ),
            hard_skill_answer_options (
              numeric_value
            )
          `)
          .eq('evaluated_user_id', userId),
        supabase
          .from('user_qualities')
          .select(`
            *,
            soft_skills:quality_id (
              name,
              description
            )
          `)
          .eq('user_id', userId)
      ]);

      if (userError) throw userError;
      if (skillError) throw skillError;
      if (qualityError) throw qualityError;

      if (!userData) {
        throw new Error('Пользователь не найден');
      }

      // Получаем требования для позиции только если есть position_id
      const positionQueries = [];
      // TODO: Update to use grade_skills and grade_qualities instead of position_skills/position_qualities
      /*
      if (userData.position_id) {
        positionQueries.push(
          supabase
            .from('grade_skills')
            .select(`
              skill_id,
              skills (
                name,
                category
              )
            `)
            .eq('position_id', userData.position_id),
          supabase
            .from('grade_qualities')
            .select(`
              quality_id,
              qualities (
                name,
                description
              )
            `)
            .eq('position_id', userData.position_id)
        );
      }
      */

      const positionResults = positionQueries.length > 0 
        ? await Promise.all(positionQueries)
        : [{ data: [] }, { data: [] }];

      const [
        { data: positionSkills = [] },
        { data: positionQualities = [] }
      ] = positionResults;

      // Агрегируем навыки
      const skillAggregations: { [key: string]: { scores: number[], name: string } } = {};
      
      skillResults?.forEach((result: any) => {
        const skillId = (result as any).hard_skill_questions.skill_id;
        const skillName = (result as any).hard_skill_questions.hard_skills.name;
        const score = (result as any).raw_numeric_value ?? (result as any).hard_skill_answer_options?.numeric_value;

        if (!skillAggregations[skillId]) {
          skillAggregations[skillId] = {
            scores: [],
            name: skillName
          };
        }
        skillAggregations[skillId].scores.push(score);
      });

      const skills: CompetencyResult[] = Object.entries(skillAggregations).map(([skillId, data]) => {
        const current_level = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
        const target_level = 4; // Целевой уровень для Hard Skills (максимум в системе опросов)
        const gap = Math.max(0, target_level - current_level);
        
        return {
          id: skillId,
          name: data.name,
          current_level: Number(current_level.toFixed(1)),
          target_level,
          gap: Number(gap.toFixed(1)),
          source: 'mixed' as const,
          category: 'Навыки',
          last_assessed: skillResults?.[0]?.created_at
        };
      });

      // Агрегируем качества
      const qualities: CompetencyResult[] = (qualityData || []).map((quality: any) => {
        const target_level = quality.target_level || 5;
        const gap = Math.max(0, target_level - quality.current_level);
        
        return {
          id: quality.quality_id,
          name: quality.soft_skills?.name || 'Unknown Quality',
          current_level: quality.current_level,
          target_level,
          gap: Number(gap.toFixed(1)),
          source: '360' as const,
          category: 'Качества',
          last_assessed: quality.last_assessed_at
        };
      });

      // Добавляем недостающие навыки и качества из требований позиции
      const existingSkillIds = new Set(skills.map(s => s.id));
      const existingQualityIds = new Set(qualities.map(q => q.id));

      positionSkills?.forEach((ps: any) => {
        if (!existingSkillIds.has(ps.skill_id)) {
          skills.push({
            id: ps.skill_id,
            name: ps.skills.name,
            current_level: 0,
            target_level: 4,
            gap: 4,
            source: 'mixed' as const,
            category: 'Навыки',
          });
        }
      });

      positionQualities?.forEach((pq: any) => {
        if (!existingQualityIds.has(pq.quality_id)) {
          qualities.push({
            id: pq.quality_id,
            name: pq.qualities.name,
            current_level: 0,
            target_level: 5,
            gap: 5,
            source: '360' as const,
            category: 'Качества',
          });
        }
      });

      // Сортируем по убыванию gap
      skills.sort((a, b) => b.gap - a.gap);
      qualities.sort((a, b) => b.gap - a.gap);

      const overall_score = [...skills, ...qualities].reduce((sum, item) => sum + item.current_level, 0) / (skills.length + qualities.length);
      const total_gap = [...skills, ...qualities].reduce((sum, item) => sum + item.gap, 0);

      setProfile({
        skills,
        qualities,
        overall_score: Number(overall_score.toFixed(1)),
        total_gap: Number(total_gap.toFixed(1))
      });

    } catch (err) {
      console.error('Error fetching competency profile:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке профиля компетенций');
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    error,
    refetch: fetchCompetencyProfile
  };
};