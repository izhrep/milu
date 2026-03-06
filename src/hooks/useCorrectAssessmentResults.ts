import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompetencyFilterType, SkillSetFilterType } from '@/components/CompetencyFilter';
import { getHardSkillsRoleVisibility, getSoftSkillsRoleVisibility } from './useSkillRoleVisibility';

export interface AssessmentDataWithCounts {
  name: string;
  self_assessment: number | null;
  peers_average: number | null;
  manager_assessment: number | null;
  all_except_self: number | null;
  all_average: number | null;
  self_count: number;
  peers_count: number;
  manager_count: number;
  all_except_self_count: number;
  all_count: number;
  // Новые поля для peer по категориям должностей
  peers_by_position_category?: Record<string, { average: number; count: number; name: string }>;
  // Поля для сортировки и отображения категорий
  category_name?: string;
  subcategory_name?: string;
}

export interface CompetencyDetailedResult {
  competency_id: string;
  competency_name: string;
  competency_type: 'skill' | 'quality';
  category_name?: string;
  subcategory_name?: string;
  data: AssessmentDataWithCounts;
}

interface RawScore {
  evaluating_user_id: string;
  evaluated_user_id: string;
  numeric_value: number;
  assignment_type?: string;
  evaluator_position_category_id?: string;
  evaluator_position_category_name?: string;
}

interface EvaluatorInfo {
  id: string;
  position_category_id: string | null;
  position_category_name: string | null;
}

export const useCorrectAssessmentResults = (
  userId: string | undefined,
  filterType: CompetencyFilterType,
  positionCategoryFilter: string = 'all',
  skillSetFilter: SkillSetFilterType = 'all',
  diagnosticStageId?: string | null
) => {
  const [radarData, setRadarData] = useState<AssessmentDataWithCounts[]>([]);
  const [overallResults, setOverallResults] = useState<AssessmentDataWithCounts | null>(null);
  const [skillResults, setSkillResults] = useState<CompetencyDetailedResult[]>([]);
  const [qualityResults, setQualityResults] = useState<CompetencyDetailedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxValue, setMaxValue] = useState(5);
  const [managerPositionCategory, setManagerPositionCategory] = useState<string | null>(null);
  const [evaluatorsInfo, setEvaluatorsInfo] = useState<Map<string, EvaluatorInfo>>(new Map());

  useEffect(() => {
    if (userId) {
      fetchCorrectResults();
    }
  }, [userId, filterType, positionCategoryFilter, skillSetFilter, diagnosticStageId]);

  const fetchCorrectResults = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Получаем grade_id пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('grade_id, manager_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!userData?.grade_id) {
        resetState();
        return;
      }

      const gradeId = userData.grade_id;

      // Получаем категорию должности руководителя
      if (userData.manager_id) {
        const { data: managerData } = await supabase
          .from('users')
          .select('position_id, positions(position_category_id, position_categories(name))')
          .eq('id', userData.manager_id)
          .single();

        if (managerData?.positions?.position_categories?.name) {
          setManagerPositionCategory(managerData.positions.position_categories.name);
        }
      }

      // Получаем данные в зависимости от фильтра
      switch (filterType) {
        case 'hard_skills':
          await fetchHardSkills(userId, gradeId, diagnosticStageId);
          break;
        case 'soft_skills':
          await fetchSoftSkills(userId, gradeId, diagnosticStageId);
          break;
        case 'hard_categories':
          await fetchHardCategories(userId, gradeId, diagnosticStageId);
          break;
        case 'soft_categories':
          await fetchSoftCategories(userId, gradeId, diagnosticStageId);
          break;
        case 'hard_subcategories':
          await fetchHardSubcategories(userId, gradeId, diagnosticStageId);
          break;
        case 'soft_subcategories':
          await fetchSoftSubcategories(userId, gradeId, diagnosticStageId);
          break;
      }
    } catch (error) {
      console.error('Error fetching correct assessment results:', error);
      resetState();
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setRadarData([]);
    setOverallResults(null);
    setSkillResults([]);
    setQualityResults([]);
  };

  // Получить информацию об оценивающих (категории должностей)
  const fetchEvaluatorsInfo = async (evaluatorIds: string[]): Promise<Map<string, EvaluatorInfo>> => {
    if (evaluatorIds.length === 0) return new Map();

    // Use SECURITY DEFINER RPC to bypass RLS restrictions on users table
    const { data: profiles, error } = await supabase
      .rpc('get_respondent_profiles', { p_user_ids: evaluatorIds });

    console.log('[fetchEvaluatorsInfo] evaluatorIds:', evaluatorIds);
    console.log('[fetchEvaluatorsInfo] raw response:', profiles);
    if (error) console.error('[fetchEvaluatorsInfo] error:', error);

    const infoMap = new Map<string, EvaluatorInfo>();
    
    (profiles || []).forEach((p: any) => {
      const info = {
        id: p.id,
        position_category_id: p.position_category_id || null,
        position_category_name: p.position_category_name || null
      };
      console.log('[fetchEvaluatorsInfo] mapping:', p.id, '->', info);
      infoMap.set(p.id, info);
    });

    return infoMap;
  };

  // ============= HARD SKILLS =============
  const fetchHardSkills = async (userId: string, gradeId: string, stageId?: string | null) => {
    // 1. Получаем навыки из грейда
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select('skill_id, hard_skills(id, name, category_id, category_hard_skills(name))')
      .eq('grade_id', gradeId);

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    // 2. Получаем исходные оценки с явным запросом assignment_type
    let query = supabase
      .from('hard_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        question_id,
        hard_skill_questions!inner(skill_id),
        hard_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('hard_skill_questions.skill_id', skillIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults, error: resultsError } = await query;

    if (resultsError) {
      console.error('Error fetching hard skill results:', resultsError);
      resetState();
      return;
    }

    // 3. Получаем информацию об assignments отдельно
    const assignmentIds = [...new Set((rawResults || [])
      .map((r: any) => r.assignment_id)
      .filter(Boolean))];
    
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase
        .from('survey_360_assignments')
        .select('id, assignment_type')
        .in('id', assignmentIds);
      
      (assignments || []).forEach((a: any) => {
        assignmentsMap.set(a.id, a.assignment_type);
      });
    }

    // 4. Получаем информацию об оценивающих
    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    // 5. Получаем информацию о видимости навыков для фильтра "Назначенные всем ролям"
    let visibilityMap: Map<string, { assignedToAllRoles: boolean }> | null = null;
    if (skillSetFilter === 'assigned_to_all') {
      visibilityMap = await getHardSkillsRoleVisibility(skillIds);
    }

    // 6. Обрабатываем по каждому навыку
    const skillsData: AssessmentDataWithCounts[] = [];
    const skillsDetailed: CompetencyDetailedResult[] = [];
    let allScores: RawScore[] = [];

    console.log('[fetchHardSkills] rawResults count:', rawResults?.length);
    console.log('[fetchHardSkills] assignmentsMap:', Object.fromEntries(assignmentsMap));

    // Получаем информацию о подкатегориях для навыков
    const skillIdsForSubcategories = gradeSkills.map((gs: any) => gs.hard_skills.id);
    const { data: skillsWithSubcategories } = await supabase
      .from('hard_skills')
      .select('id, sub_category_id, sub_category_hard_skills(name)')
      .in('id', skillIdsForSubcategories);
    
    const subcategoryMap = new Map<string, string>();
    (skillsWithSubcategories || []).forEach((s: any) => {
      if (s.sub_category_hard_skills?.name) {
        subcategoryMap.set(s.id, s.sub_category_hard_skills.name);
      }
    });

    for (const gs of gradeSkills) {
      const skill = (gs as any).hard_skills;
      
      // Фильтр "Назначенные всем ролям"
      if (skillSetFilter === 'assigned_to_all' && visibilityMap) {
        const visibility = visibilityMap.get(skill.id);
        if (!visibility?.assignedToAllRoles) {
          continue; // Пропускаем навык, если он не назначен всем ролям
        }
      }

      const skillScores = (rawResults || []).filter((r: any) => 
        r.hard_skill_questions?.skill_id === skill.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      // Пропускаем навыки без результатов
      if (skillScores.length === 0) {
        continue;
      }

      const categoryName = skill.category_hard_skills?.name || 'Без категории';
      const subcategoryName = subcategoryMap.get(skill.id) || undefined;

      const aggregated = aggregateScores(skillScores, userId, positionCategoryFilter);
      
      skillsData.push({
        name: skill.name,
        category_name: categoryName,
        subcategory_name: subcategoryName,
        ...aggregated
      });

      skillsDetailed.push({
        competency_id: skill.id,
        competency_name: skill.name,
        competency_type: 'skill',
        category_name: categoryName,
        subcategory_name: subcategoryName,
        data: {
          name: skill.name,
          category_name: categoryName,
          subcategory_name: subcategoryName,
          ...aggregated
        }
      });

      allScores = allScores.concat(skillScores);
    }

    // Кастомный порядок категорий для Hard-скиллов
    // Важно: в БД могут быть варианты названий (например, "Платформа 1С"), поэтому используем нормализацию.
    const HARD_SKILLS_CATEGORY_ORDER = [
      'Знания типовых конфигураций',
      'Предметная область',
      'Платформа',
      'Работа над требованиями'
    ];

    const normalizeCategory = (value?: string) => (value ?? '').trim().toLowerCase();

    const getHardCategoryOrderIndex = (category?: string) => {
      const normalized = normalizeCategory(category);
      const direct = HARD_SKILLS_CATEGORY_ORDER.findIndex((c) => normalizeCategory(c) === normalized);
      if (direct !== -1) return direct;

      // Поддержка вариантов типа "Платформа 1С" → "Платформа"
      if (normalized.startsWith(normalizeCategory('Платформа'))) {
        return HARD_SKILLS_CATEGORY_ORDER.findIndex((c) => normalizeCategory(c) === normalizeCategory('Платформа'));
      }

      return -1;
    };

    // Сортировка: сначала по кастомному порядку категорий, затем по алфавиту
    const sortByCategory = (a: any, b: any) => {
      const indexA = getHardCategoryOrderIndex(a.category_name);
      const indexB = getHardCategoryOrderIndex(b.category_name);

      if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
      if (indexA !== -1 && indexB === -1) return -1;
      if (indexA === -1 && indexB !== -1) return 1;

      const catA = normalizeCategory(a.category_name || 'Яяя');
      const catB = normalizeCategory(b.category_name || 'Яяя');
      if (catA !== catB) return catA.localeCompare(catB, 'ru');

      return normalizeCategory(a.name).localeCompare(normalizeCategory(b.name), 'ru');
    };

    skillsData.sort(sortByCategory);
    skillsDetailed.sort((a, b) => {
      const indexA = getHardCategoryOrderIndex(a.category_name);
      const indexB = getHardCategoryOrderIndex(b.category_name);

      if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
      if (indexA !== -1 && indexB === -1) return -1;
      if (indexA === -1 && indexB !== -1) return 1;

      const catA = normalizeCategory(a.category_name || 'Яяя');
      const catB = normalizeCategory(b.category_name || 'Яяя');
      if (catA !== catB) return catA.localeCompare(catB, 'ru');

      return normalizeCategory(a.competency_name).localeCompare(normalizeCategory(b.competency_name), 'ru');
    });

    // Общие результаты
    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(skillsData);
    setSkillResults(skillsDetailed);
    setQualityResults([]);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(4);
  };

  // ============= SOFT SKILLS =============
  const fetchSoftSkills = async (userId: string, gradeId: string, stageId?: string | null) => {
    // 1. Получаем качества из грейда
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select('quality_id, soft_skills(id, name, category_id, category_soft_skills(name))')
      .eq('grade_id', gradeId);

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    // 2. Получаем исходные оценки с явным запросом
    let query = supabase
      .from('soft_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        question_id,
        soft_skill_questions!inner(quality_id),
        soft_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('soft_skill_questions.quality_id', qualityIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults, error: resultsError } = await query;

    if (resultsError) {
      console.error('Error fetching soft skill results:', resultsError);
      resetState();
      return;
    }

    // 3. Получаем информацию об assignments отдельно
    const assignmentIds = [...new Set((rawResults || [])
      .map((r: any) => r.assignment_id)
      .filter(Boolean))];
    
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase
        .from('survey_360_assignments')
        .select('id, assignment_type')
        .in('id', assignmentIds);
      
      (assignments || []).forEach((a: any) => {
        assignmentsMap.set(a.id, a.assignment_type);
      });
    }

    // 4. Получаем информацию об оценивающих
    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    // 5. Получаем информацию о видимости качеств для фильтра "Назначенные всем ролям"
    let visibilityMap: Map<string, { assignedToAllRoles: boolean }> | null = null;
    if (skillSetFilter === 'assigned_to_all') {
      visibilityMap = await getSoftSkillsRoleVisibility(qualityIds);
    }

    // 6. Получаем информацию о подкатегориях для качеств
    const qualityIdsForSubcategories = gradeQualities.map((gq: any) => gq.soft_skills.id);
    const { data: qualitiesWithSubcategories } = await supabase
      .from('soft_skills')
      .select('id, sub_category_id, sub_category_soft_skills(name)')
      .in('id', qualityIdsForSubcategories);
    
    const subcategoryMap = new Map<string, string>();
    (qualitiesWithSubcategories || []).forEach((q: any) => {
      if (q.sub_category_soft_skills?.name) {
        subcategoryMap.set(q.id, q.sub_category_soft_skills.name);
      }
    });

    // 7. Обрабатываем по каждому качеству
    const qualitiesData: AssessmentDataWithCounts[] = [];
    const qualitiesDetailed: CompetencyDetailedResult[] = [];
    let allScores: RawScore[] = [];

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      
      // Фильтр "Назначенные всем ролям"
      if (skillSetFilter === 'assigned_to_all' && visibilityMap) {
        const visibility = visibilityMap.get(quality.id);
        if (!visibility?.assignedToAllRoles) {
          continue; // Пропускаем качество, если оно не назначено всем ролям
        }
      }

      const qualityScores = (rawResults || []).filter((r: any) => 
        r.soft_skill_questions?.quality_id === quality.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      // Пропускаем качества без результатов
      if (qualityScores.length === 0) {
        continue;
      }

      const categoryName = quality.category_soft_skills?.name || 'Без категории';
      const subcategoryName = subcategoryMap.get(quality.id) || undefined;

      const aggregated = aggregateScores(qualityScores, userId, positionCategoryFilter);
      qualitiesData.push({
        name: quality.name,
        category_name: categoryName,
        subcategory_name: subcategoryName,
        ...aggregated
      });

      qualitiesDetailed.push({
        competency_id: quality.id,
        competency_name: quality.name,
        competency_type: 'quality',
        category_name: categoryName,
        subcategory_name: subcategoryName,
        data: {
          name: quality.name,
          category_name: categoryName,
          subcategory_name: subcategoryName,
          ...aggregated
        }
      });

      allScores = allScores.concat(qualityScores);
    }

    // Сортировка: сначала по категории А-Я, затем по названию А-Я
    const sortByCategory = (a: any, b: any) => {
      const catA = (a.category_name || 'Яяя').toLowerCase();
      const catB = (b.category_name || 'Яяя').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, 'ru');
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase(), 'ru');
    };

    qualitiesData.sort(sortByCategory);
    qualitiesDetailed.sort((a, b) => {
      const catA = (a.category_name || 'Яяя').toLowerCase();
      const catB = (b.category_name || 'Яяя').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, 'ru');
      return a.competency_name.toLowerCase().localeCompare(b.competency_name.toLowerCase(), 'ru');
    });

    // Общие результаты
    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(qualitiesData);
    setSkillResults([]);
    setQualityResults(qualitiesDetailed);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(5);
  };

  // ============= HARD CATEGORIES =============
  const fetchHardCategories = async (userId: string, gradeId: string, stageId?: string | null) => {
    // Получаем навыки с категориями
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select(`
        skill_id,
        hard_skills(id, name, category_id, category_hard_skills(id, name))
      `)
      .eq('grade_id', gradeId);

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    // Получаем исходные оценки
    let query = supabase
      .from('hard_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        hard_skill_questions!inner(skill_id),
        hard_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('hard_skill_questions.skill_id', skillIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults } = await query;

    // Получаем assignments отдельно
    const assignmentIds = [...new Set((rawResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase.from('survey_360_assignments').select('id, assignment_type').in('id', assignmentIds);
      (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
    }

    // Получаем информацию об оценивающих
    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    // Группируем по категориям
    const categoryMap = new Map<string, {
      name: string;
      scores: RawScore[];
      skillsDetailed: CompetencyDetailedResult[];
    }>();

    for (const gs of gradeSkills) {
      const skill = (gs as any).hard_skills;
      const category = skill.category_hard_skills;
      
      if (!category) continue;

      const skillScores = (rawResults || []).filter((r: any) => 
        r.hard_skill_questions?.skill_id === skill.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, { name: category.name, scores: [], skillsDetailed: [] });
      }

      const catData = categoryMap.get(category.id)!;
      catData.scores.push(...skillScores);
      
      const skillAggregated = aggregateScores(skillScores, userId, positionCategoryFilter);
      catData.skillsDetailed.push({
        competency_id: skill.id,
        competency_name: skill.name,
        competency_type: 'skill',
        category_name: category.name,
        data: { name: skill.name, ...skillAggregated }
      });
    }

    // Агрегируем по категориям
    const categoriesData: AssessmentDataWithCounts[] = [];
    let allScores: RawScore[] = [];
    let allSkillsDetailed: CompetencyDetailedResult[] = [];

    for (const [_, catData] of categoryMap) {
      const aggregated = aggregateScores(catData.scores, userId, positionCategoryFilter);
      categoriesData.push({ name: catData.name, ...aggregated });
      allScores.push(...catData.scores);
      allSkillsDetailed.push(...catData.skillsDetailed);
    }

    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(categoriesData);
    setSkillResults(allSkillsDetailed);
    setQualityResults([]);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(4);
  };

  // ============= SOFT CATEGORIES =============
  const fetchSoftCategories = async (userId: string, gradeId: string, stageId?: string | null) => {
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select(`quality_id, soft_skills(id, name, category_id, category_soft_skills(id, name))`)
      .eq('grade_id', gradeId);

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    let query = supabase
      .from('soft_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        soft_skill_questions!inner(quality_id),
        soft_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('soft_skill_questions.quality_id', qualityIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults } = await query;

    const assignmentIds = [...new Set((rawResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase.from('survey_360_assignments').select('id, assignment_type').in('id', assignmentIds);
      (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
    }

    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    const categoryMap = new Map<string, { name: string; scores: RawScore[]; qualitiesDetailed: CompetencyDetailedResult[] }>();

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      const category = quality.category_soft_skills;
      if (!category) continue;

      const qualityScores = (rawResults || []).filter((r: any) => 
        r.soft_skill_questions?.quality_id === quality.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, { name: category.name, scores: [], qualitiesDetailed: [] });
      }

      const catData = categoryMap.get(category.id)!;
      catData.scores.push(...qualityScores);
      
      const qualityAggregated = aggregateScores(qualityScores, userId, positionCategoryFilter);
      catData.qualitiesDetailed.push({
        competency_id: quality.id,
        competency_name: quality.name,
        competency_type: 'quality',
        category_name: category.name,
        data: { name: quality.name, ...qualityAggregated }
      });
    }

    const categoriesData: AssessmentDataWithCounts[] = [];
    let allScores: RawScore[] = [];
    let allQualitiesDetailed: CompetencyDetailedResult[] = [];

    for (const [_, catData] of categoryMap) {
      const aggregated = aggregateScores(catData.scores, userId, positionCategoryFilter);
      categoriesData.push({ name: catData.name, ...aggregated });
      allScores.push(...catData.scores);
      allQualitiesDetailed.push(...catData.qualitiesDetailed);
    }

    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(categoriesData);
    setSkillResults([]);
    setQualityResults(allQualitiesDetailed);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(5);
  };

  // ============= HARD SUBCATEGORIES =============
  const fetchHardSubcategories = async (userId: string, gradeId: string, stageId?: string | null) => {
    const { data: gradeSkills } = await supabase
      .from('grade_skills')
      .select(`skill_id, hard_skills(id, name, sub_category_id, sub_category_hard_skills(id, name))`)
      .eq('grade_id', gradeId);

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    let query = supabase
      .from('hard_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        hard_skill_questions!inner(skill_id),
        hard_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('hard_skill_questions.skill_id', skillIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults } = await query;

    const assignmentIds = [...new Set((rawResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase.from('survey_360_assignments').select('id, assignment_type').in('id', assignmentIds);
      (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
    }

    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    const subcategoryMap = new Map<string, { name: string; scores: RawScore[]; skillsDetailed: CompetencyDetailedResult[] }>();

    for (const gs of gradeSkills) {
      const skill = (gs as any).hard_skills;
      const subcategory = skill.sub_category_hard_skills;
      if (!subcategory) continue;

      const skillScores = (rawResults || []).filter((r: any) => 
        r.hard_skill_questions?.skill_id === skill.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      if (!subcategoryMap.has(subcategory.id)) {
        subcategoryMap.set(subcategory.id, { name: subcategory.name, scores: [], skillsDetailed: [] });
      }

      const subData = subcategoryMap.get(subcategory.id)!;
      subData.scores.push(...skillScores);
      
      const skillAggregated = aggregateScores(skillScores, userId, positionCategoryFilter);
      subData.skillsDetailed.push({
        competency_id: skill.id,
        competency_name: skill.name,
        competency_type: 'skill',
        category_name: subcategory.name,
        data: { name: skill.name, ...skillAggregated }
      });
    }

    const subcategoriesData: AssessmentDataWithCounts[] = [];
    let allScores: RawScore[] = [];
    let allSkillsDetailed: CompetencyDetailedResult[] = [];

    for (const [_, subData] of subcategoryMap) {
      const aggregated = aggregateScores(subData.scores, userId, positionCategoryFilter);
      subcategoriesData.push({ name: subData.name, ...aggregated });
      allScores.push(...subData.scores);
      allSkillsDetailed.push(...subData.skillsDetailed);
    }

    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(subcategoriesData);
    setSkillResults(allSkillsDetailed);
    setQualityResults([]);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(4);
  };

  // ============= SOFT SUBCATEGORIES =============
  const fetchSoftSubcategories = async (userId: string, gradeId: string, stageId?: string | null) => {
    const { data: gradeQualities } = await supabase
      .from('grade_qualities')
      .select(`quality_id, soft_skills(id, name, sub_category_id, sub_category_soft_skills(id, name))`)
      .eq('grade_id', gradeId);

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    let query = supabase
      .from('soft_skill_results')
      .select(`
        id,
        evaluated_user_id,
        evaluating_user_id,
        assignment_id,
        soft_skill_questions!inner(quality_id),
        soft_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false')
      .in('soft_skill_questions.quality_id', qualityIds);
    
    // Фильтр по диагностическому этапу
    if (stageId) {
      query = query.eq('diagnostic_stage_id', stageId);
    }
    
    const { data: rawResults } = await query;

    const assignmentIds = [...new Set((rawResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
    let assignmentsMap = new Map<string, string>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase.from('survey_360_assignments').select('id, assignment_type').in('id', assignmentIds);
      (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
    }

    const evaluatorIds = [...new Set((rawResults || []).map((r: any) => r.evaluating_user_id))];
    const evalInfo = await fetchEvaluatorsInfo(evaluatorIds);
    setEvaluatorsInfo(evalInfo);

    const subcategoryMap = new Map<string, { name: string; scores: RawScore[]; qualitiesDetailed: CompetencyDetailedResult[] }>();

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      const subcategory = quality.sub_category_soft_skills;
      if (!subcategory) continue;

      const qualityScores = (rawResults || []).filter((r: any) => 
        r.soft_skill_questions?.quality_id === quality.id
      ).map((r: any) => {
        const info = evalInfo.get(r.evaluating_user_id);
        const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
        return {
          evaluating_user_id: r.evaluating_user_id,
          evaluated_user_id: r.evaluated_user_id,
          numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
          assignment_type: assignmentType,
          evaluator_position_category_id: info?.position_category_id || undefined,
          evaluator_position_category_name: info?.position_category_name || undefined
        };
      });

      if (!subcategoryMap.has(subcategory.id)) {
        subcategoryMap.set(subcategory.id, { name: subcategory.name, scores: [], qualitiesDetailed: [] });
      }

      const subData = subcategoryMap.get(subcategory.id)!;
      subData.scores.push(...qualityScores);
      
      const qualityAggregated = aggregateScores(qualityScores, userId, positionCategoryFilter);
      subData.qualitiesDetailed.push({
        competency_id: quality.id,
        competency_name: quality.name,
        competency_type: 'quality',
        category_name: subcategory.name,
        data: { name: quality.name, ...qualityAggregated }
      });
    }

    const subcategoriesData: AssessmentDataWithCounts[] = [];
    let allScores: RawScore[] = [];
    let allQualitiesDetailed: CompetencyDetailedResult[] = [];

    for (const [_, subData] of subcategoryMap) {
      const aggregated = aggregateScores(subData.scores, userId, positionCategoryFilter);
      subcategoriesData.push({ name: subData.name, ...aggregated });
      allScores.push(...subData.scores);
      allQualitiesDetailed.push(...subData.qualitiesDetailed);
    }

    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(subcategoriesData);
    setSkillResults([]);
    setQualityResults(allQualitiesDetailed);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(5);
  };

  // ============= АГРЕГАЦИЯ ОЦЕНОК =============
  /**
   * КРИТИЧНО: Правильный подсчёт средних значений
   * НЕ усредняем средние навыков, а считаем сумму всех оценок / количество оценок
   * С учетом фильтрации по категории должности для peer
   */
  const aggregateScores = (
    scores: RawScore[],
    evaluatedUserId: string,
    positionCategoryFilter: string = 'all'
  ): Omit<AssessmentDataWithCounts, 'name'> => {
    // Группируем оценки по типу оценивающего
    const selfScores: number[] = [];
    const managerScores: number[] = [];
    const peerScores: number[] = [];
    
    // Для подсчета уникальных пользователей
    const selfUsers = new Set<string>();
    const managerUsers = new Set<string>();
    const peerUsers = new Set<string>();

    // Для группировки peer по категориям должностей
    const peersByCategory = new Map<string, { scores: number[]; users: Set<string>; name: string }>();

    scores.forEach(score => {
      // Пропускаем нулевые значения - они не должны учитываться в расчете средних
      if (score.numeric_value === 0) return;

      // Определяем тип оценивающего
      const isSelf = score.evaluating_user_id === evaluatedUserId || score.assignment_type === 'self';
      const isManager = score.assignment_type === 'manager';
      // Всё остальное считаем peer (включая undefined assignment_type, если это не self)
      const isPeer = !isSelf && (score.assignment_type === 'peer' || (!isManager && score.evaluating_user_id !== evaluatedUserId));

      if (isSelf) {
        selfScores.push(score.numeric_value);
        selfUsers.add(score.evaluating_user_id);
      } else if (isManager) {
        managerScores.push(score.numeric_value);
        managerUsers.add(score.evaluating_user_id);
      } else if (isPeer) {
        // Фильтруем peer по категории должности
        const categoryId = score.evaluator_position_category_id || 'unknown';
        const categoryName = score.evaluator_position_category_name || 'Без категории';

        // Если фильтр "все" или совпадает с категорией
        if (positionCategoryFilter === 'all' || positionCategoryFilter === categoryId) {
          peerScores.push(score.numeric_value);
          peerUsers.add(score.evaluating_user_id);
        }

        // Всегда собираем данные по категориям для отображения
        if (!peersByCategory.has(categoryId)) {
          peersByCategory.set(categoryId, { scores: [], users: new Set(), name: categoryName });
        }
        const catData = peersByCategory.get(categoryId)!;
        catData.scores.push(score.numeric_value);
        catData.users.add(score.evaluating_user_id);
      }
    });

    // Вычисляем средние (сумма / количество)
    const self_assessment = selfScores.length > 0 
      ? selfScores.reduce((sum, val) => sum + val, 0) / selfScores.length 
      : null;

    const manager_assessment = managerScores.length > 0
      ? managerScores.reduce((sum, val) => sum + val, 0) / managerScores.length
      : null;

    const peers_average = peerScores.length > 0
      ? peerScores.reduce((sum, val) => sum + val, 0) / peerScores.length
      : null;

    // Все кроме self (manager + peers)
    const allExceptSelfScores = [...managerScores, ...peerScores];
    const all_except_self = allExceptSelfScores.length > 0
      ? allExceptSelfScores.reduce((sum, val) => sum + val, 0) / allExceptSelfScores.length
      : null;

    // Все (self + manager + peers)
    const allScores = [...selfScores, ...managerScores, ...peerScores];
    const all_average = allScores.length > 0
      ? allScores.reduce((sum, val) => sum + val, 0) / allScores.length
      : null;

    // Подсчитываем уникальных пользователей
    const allExceptSelfUsers = new Set([...managerUsers, ...peerUsers]);
    const allUsers = new Set([...selfUsers, ...managerUsers, ...peerUsers]);

    // Формируем peers_by_position_category
    const peers_by_position_category: Record<string, { average: number; count: number; name: string }> = {};
    for (const [categoryId, catData] of peersByCategory) {
      if (catData.scores.length > 0) {
        peers_by_position_category[categoryId] = {
          average: catData.scores.reduce((sum, val) => sum + val, 0) / catData.scores.length,
          count: catData.users.size,
          name: catData.name
        };
      }
    }

    return {
      self_assessment,
      manager_assessment,
      peers_average,
      all_except_self,
      all_average,
      self_count: selfUsers.size,
      manager_count: managerUsers.size,
      peers_count: peerUsers.size,
      all_except_self_count: allExceptSelfUsers.size,
      all_count: allUsers.size,
      peers_by_position_category
    };
  };

  return {
    radarData,
    overallResults,
    skillResults,
    qualityResults,
    loading,
    maxValue,
    managerPositionCategory,
    evaluatorsInfo
  };
};
