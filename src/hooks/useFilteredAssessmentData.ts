import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompetencyFilterType } from '@/components/CompetencyFilter';

export interface AssessmentData {
  name: string;
  self_assessment: number;
  peers_average: number;
  manager_assessment: number;
}

interface RawAssessmentData {
  skill_id: string | null;
  quality_id: string | null;
  skill_name?: string;
  quality_name?: string;
  category_id?: string | null;
  category_name?: string | null;
  subcategory_id?: string | null;
  subcategory_name?: string | null;
  self_assessment: number;
  peers_average: number;
  manager_assessment: number;
}

export const useFilteredAssessmentData = (
  userId: string | undefined,
  filterType: CompetencyFilterType
) => {
  const [data, setData] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<CompetencyFilterType[]>([
    'hard_skills',
    'soft_skills',
    'hard_categories',
    'soft_categories'
  ]);

  useEffect(() => {
    if (userId) {
      checkAvailableFilters();
      fetchFilteredData();
    }
  }, [userId, filterType]);

  const checkAvailableFilters = async () => {
    // Проверяем наличие подкатегорий
    const { count: hardSubCount } = await supabase
      .from('sub_category_hard_skills')
      .select('*', { count: 'exact', head: true });

    const { count: softSubCount } = await supabase
      .from('sub_category_soft_skills')
      .select('*', { count: 'exact', head: true });

    const filters: CompetencyFilterType[] = [
      'hard_skills',
      'soft_skills',
      'hard_categories',
      'soft_categories'
    ];

    if (hardSubCount && hardSubCount > 0) {
      filters.push('hard_subcategories');
    }

    if (softSubCount && softSubCount > 0) {
      filters.push('soft_subcategories');
    }

    setAvailableFilters(filters);
  };

  const fetchFilteredData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Получаем grade_id пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('grade_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!userData?.grade_id) {
        setData([]);
        return;
      }

      const gradeId = userData.grade_id;

      // Получаем данные в зависимости от фильтра
      let filteredData: AssessmentData[] = [];

      switch (filterType) {
        case 'hard_skills':
          filteredData = await fetchHardSkills(userId, gradeId);
          break;
        case 'soft_skills':
          filteredData = await fetchSoftSkills(userId, gradeId);
          break;
        case 'hard_categories':
          filteredData = await fetchHardCategories(userId, gradeId);
          break;
        case 'soft_categories':
          filteredData = await fetchSoftCategories(userId, gradeId);
          break;
        case 'hard_subcategories':
          filteredData = await fetchHardSubcategories(userId, gradeId);
          break;
        case 'soft_subcategories':
          filteredData = await fetchSoftSubcategories(userId, gradeId);
          break;
      }

      setData(filteredData);
    } catch (error) {
      console.error('Error fetching filtered data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHardSkills = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select('skill_id, hard_skills(id, name)')
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('skill_id', 'is', null);

    return (gradeSkills || []).map((gs: any) => {
      const skill = gs.hard_skills;
      const result = results?.find(r => r.skill_id === skill.id);
      return {
        name: skill.name,
        self_assessment: result?.self_assessment || 0,
        peers_average: result?.peers_average || 0,
        manager_assessment: result?.manager_assessment || 0,
      };
    });
  };

  const fetchSoftSkills = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select('quality_id, soft_skills(id, name)')
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('quality_id', 'is', null);

    return (gradeQualities || []).map((gq: any) => {
      const quality = gq.soft_skills;
      const result = results?.find(r => r.quality_id === quality.id);
      return {
        name: quality.name,
        self_assessment: result?.self_assessment || 0,
        peers_average: result?.peers_average || 0,
        manager_assessment: result?.manager_assessment || 0,
      };
    });
  };

  const fetchHardCategories = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    // Получаем навыки с категориями
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select(`
        skill_id,
        hard_skills(id, name, category_id, category_hard_skills(id, name))
      `)
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('skill_id', 'is', null);

    // Группируем по категориям
    const categoryMap = new Map<string, {
      name: string;
      skills: Array<{
        self: number;
        peers: number;
        manager: number;
      }>;
    }>();

    (gradeSkills || []).forEach((gs: any) => {
      const skill = gs.hard_skills;
      const category = skill.category_hard_skills;
      
      if (!category) return;

      const result = results?.find(r => r.skill_id === skill.id);
      
      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, {
          name: category.name,
          skills: []
        });
      }

      categoryMap.get(category.id)!.skills.push({
        self: result?.self_assessment || 0,
        peers: result?.peers_average || 0,
        manager: result?.manager_assessment || 0
      });
    });

    // Вычисляем средние по категориям
    return Array.from(categoryMap.values()).map(category => {
      const count = category.skills.length;
      const sumSelf = category.skills.reduce((sum, s) => sum + s.self, 0);
      const sumPeers = category.skills.reduce((sum, s) => sum + s.peers, 0);
      const sumManager = category.skills.reduce((sum, s) => sum + s.manager, 0);

      return {
        name: category.name,
        self_assessment: count > 0 ? sumSelf / count : 0,
        peers_average: count > 0 ? sumPeers / count : 0,
        manager_assessment: count > 0 ? sumManager / count : 0
      };
    });
  };

  const fetchSoftCategories = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    // Получаем качества с категориями
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select(`
        quality_id,
        soft_skills(id, name, category_id, category_soft_skills(id, name))
      `)
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('quality_id', 'is', null);

    // Группируем по категориям
    const categoryMap = new Map<string, {
      name: string;
      qualities: Array<{
        self: number;
        peers: number;
        manager: number;
      }>;
    }>();

    (gradeQualities || []).forEach((gq: any) => {
      const quality = gq.soft_skills;
      const category = quality.category_soft_skills;
      
      if (!category) return;

      const result = results?.find(r => r.quality_id === quality.id);
      
      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, {
          name: category.name,
          qualities: []
        });
      }

      categoryMap.get(category.id)!.qualities.push({
        self: result?.self_assessment || 0,
        peers: result?.peers_average || 0,
        manager: result?.manager_assessment || 0
      });
    });

    // Вычисляем средние по категориям
    return Array.from(categoryMap.values()).map(category => {
      const count = category.qualities.length;
      const sumSelf = category.qualities.reduce((sum, q) => sum + q.self, 0);
      const sumPeers = category.qualities.reduce((sum, q) => sum + q.peers, 0);
      const sumManager = category.qualities.reduce((sum, q) => sum + q.manager, 0);

      return {
        name: category.name,
        self_assessment: count > 0 ? sumSelf / count : 0,
        peers_average: count > 0 ? sumPeers / count : 0,
        manager_assessment: count > 0 ? sumManager / count : 0
      };
    });
  };

  const fetchHardSubcategories = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    // Получаем навыки с подкатегориями
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select(`
        skill_id,
        hard_skills(id, name, sub_category_id, sub_category_hard_skills(id, name))
      `)
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('skill_id', 'is', null);

    // Группируем по подкатегориям
    const subcategoryMap = new Map<string, {
      name: string;
      skills: Array<{
        self: number;
        peers: number;
        manager: number;
      }>;
    }>();

    (gradeSkills || []).forEach((gs: any) => {
      const skill = gs.hard_skills;
      const subcategory = skill.sub_category_hard_skills;
      
      if (!subcategory) return;

      const result = results?.find(r => r.skill_id === skill.id);
      
      if (!subcategoryMap.has(subcategory.id)) {
        subcategoryMap.set(subcategory.id, {
          name: subcategory.name,
          skills: []
        });
      }

      subcategoryMap.get(subcategory.id)!.skills.push({
        self: result?.self_assessment || 0,
        peers: result?.peers_average || 0,
        manager: result?.manager_assessment || 0
      });
    });

    // Вычисляем средние по подкатегориям
    return Array.from(subcategoryMap.values()).map(subcategory => {
      const count = subcategory.skills.length;
      const sumSelf = subcategory.skills.reduce((sum, s) => sum + s.self, 0);
      const sumPeers = subcategory.skills.reduce((sum, s) => sum + s.peers, 0);
      const sumManager = subcategory.skills.reduce((sum, s) => sum + s.manager, 0);

      return {
        name: subcategory.name,
        self_assessment: count > 0 ? sumSelf / count : 0,
        peers_average: count > 0 ? sumPeers / count : 0,
        manager_assessment: count > 0 ? sumManager / count : 0
      };
    });
  };

  const fetchSoftSubcategories = async (userId: string, gradeId: string): Promise<AssessmentData[]> => {
    // Получаем качества с подкатегориями
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select(`
        quality_id,
        soft_skills(id, name, sub_category_id, sub_category_soft_skills(id, name))
      `)
      .eq('grade_id', gradeId);

    const { data: results } = await supabase
      .from('user_assessment_results')
      .select('*')
      .eq('user_id', userId)
      .not('quality_id', 'is', null);

    // Группируем по подкатегориям
    const subcategoryMap = new Map<string, {
      name: string;
      qualities: Array<{
        self: number;
        peers: number;
        manager: number;
      }>;
    }>();

    (gradeQualities || []).forEach((gq: any) => {
      const quality = gq.soft_skills;
      const subcategory = quality.sub_category_soft_skills;
      
      if (!subcategory) return;

      const result = results?.find(r => r.quality_id === quality.id);
      
      if (!subcategoryMap.has(subcategory.id)) {
        subcategoryMap.set(subcategory.id, {
          name: subcategory.name,
          qualities: []
        });
      }

      subcategoryMap.get(subcategory.id)!.qualities.push({
        self: result?.self_assessment || 0,
        peers: result?.peers_average || 0,
        manager: result?.manager_assessment || 0
      });
    });

    // Вычисляем средние по подкатегориям
    return Array.from(subcategoryMap.values()).map(subcategory => {
      const count = subcategory.qualities.length;
      const sumSelf = subcategory.qualities.reduce((sum, q) => sum + q.self, 0);
      const sumPeers = subcategory.qualities.reduce((sum, q) => sum + q.peers, 0);
      const sumManager = subcategory.qualities.reduce((sum, q) => sum + q.manager, 0);

      return {
        name: subcategory.name,
        self_assessment: count > 0 ? sumSelf / count : 0,
        peers_average: count > 0 ? sumPeers / count : 0,
        manager_assessment: count > 0 ? sumManager / count : 0
      };
    });
  };

  return { data, loading, availableFilters };
};
