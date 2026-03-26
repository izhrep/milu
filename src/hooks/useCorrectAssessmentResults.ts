import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompetencyFilterType, SkillSetFilterType } from '@/components/CompetencyFilter';
import { getHardSkillsRoleVisibility, getSoftSkillsRoleVisibility } from './useSkillRoleVisibility';
import type { SnapshotContext } from './useSnapshotContext';

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
  peers_by_position_category?: Record<string, { average: number; count: number; name: string }>;
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

// Normalized result after dual-path fetch
interface NormalizedHardResult {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  assignment_id: string | null;
  question_id: string;
  _skill_id: string | undefined;
  _numeric_value: number;
}

interface NormalizedSoftResult {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  assignment_id: string | null;
  question_id: string;
  _quality_id: string | undefined;
  _numeric_value: number;
}

export const useCorrectAssessmentResults = (
  userId: string | undefined,
  filterType: CompetencyFilterType,
  positionCategoryFilter: string = 'all',
  skillSetFilter: SkillSetFilterType = 'all',
  diagnosticStageId?: string | null,
  snapshotContext?: SnapshotContext | null,
  snapshotResolved: boolean = true
) => {
  const [radarData, setRadarData] = useState<AssessmentDataWithCounts[]>([]);
  const [overallResults, setOverallResults] = useState<AssessmentDataWithCounts | null>(null);
  const [skillResults, setSkillResults] = useState<CompetencyDetailedResult[]>([]);
  const [qualityResults, setQualityResults] = useState<CompetencyDetailedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxValue, setMaxValue] = useState(5);
  const [managerPositionCategory, setManagerPositionCategory] = useState<string | null>(null);
  const [evaluatorsInfo, setEvaluatorsInfo] = useState<Map<string, EvaluatorInfo>>(new Map());

  // Stable snapshot identifier to avoid re-fetches on object reference changes
  const snapshotId = snapshotContext?.snapshotId ?? null;

  useEffect(() => {
    // Guard: wait for snapshot resolution before fetching
    if (!snapshotResolved) return;
    if (userId) {
      fetchCorrectResults();
    }
  }, [userId, filterType, positionCategoryFilter, skillSetFilter, diagnosticStageId, snapshotId, snapshotResolved]);

  const fetchCorrectResults = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      

      // Получаем grade_id пользователя (из снапшота или live)
      let gradeId: string;
      let managerId: string | null = null;

      if (snapshotContext && snapshotContext.evaluatedUser) {
        // SNAPSHOT MODE: grade_id из snapshot user context
        gradeId = snapshotContext.evaluatedUser.gradeId || '';
        if (!gradeId) {
          resetState();
          return;
        }
        // Manager position category из snapshot
        // Ищем manager assignment в snapshot
        snapshotContext.assignmentsMap.forEach((a) => {
          if (a.assignmentType === 'manager' && a.evaluatorPositionCategoryName) {
            setManagerPositionCategory(a.evaluatorPositionCategoryName);
          }
        });
      } else {
        // LIVE MODE
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

        gradeId = userData.grade_id;
        managerId = userData.manager_id;

        // Получаем категорию должности руководителя
        if (managerId) {
          const { data: managerData } = await supabase
            .from('users')
            .select('position_id, positions(position_category_id, position_categories(name))')
            .eq('id', managerId)
            .single();

          if (managerData?.positions?.position_categories?.name) {
            setManagerPositionCategory(managerData.positions.position_categories.name);
          }
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

  // ============= DUAL-PATH HELPERS =============
  // These helpers fetch results from hard_skill_results / soft_skill_results
  // using snapshot-only queries (no live JOINs) when snapshotContext is present,
  // or standard live JOINs when not.

  const fetchRawHardResults = async (
    userId: string, skillIds: string[], stageId?: string | null
  ): Promise<NormalizedHardResult[]> => {
    if (snapshotContext) {
      // Build question_id → skill_id map from snapshot
      const questionSkillMap = new Map<string, string>();
      snapshotContext.hardQuestionsMap.forEach((q, qId) => {
        if (q.skillId && skillIds.includes(q.skillId)) {
          questionSkillMap.set(qId, q.skillId);
        }
      });
      const questionIds = [...questionSkillMap.keys()];
      if (questionIds.length === 0) return [];

      let query = supabase
        .from('hard_skill_results')
        .select('id, evaluated_user_id, evaluating_user_id, assignment_id, question_id, raw_numeric_value, answer_option_id')
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .in('question_id', questionIds);
      if (stageId) query = query.eq('diagnostic_stage_id', stageId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => {
        // Resolve numeric value: raw_numeric_value > snapshot answer option > 0
        let numericValue = r.raw_numeric_value;
        if (numericValue == null && r.answer_option_id) {
          const snapshotOption = snapshotContext.hardAnswerOptionsMap.get(r.answer_option_id);
          numericValue = snapshotOption?.numericValue;
        }
        return {
          id: r.id,
          evaluated_user_id: r.evaluated_user_id,
          evaluating_user_id: r.evaluating_user_id,
          assignment_id: r.assignment_id,
          question_id: r.question_id,
          _skill_id: questionSkillMap.get(r.question_id),
          _numeric_value: numericValue ?? 0,
        };
      });
    } else {
      let query = supabase
        .from('hard_skill_results')
        .select(`
          id, evaluated_user_id, evaluating_user_id, assignment_id, question_id,
          hard_skill_questions!inner(skill_id),
          hard_skill_answer_options(numeric_value)
        `)
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .in('hard_skill_questions.skill_id', skillIds);
      if (stageId) query = query.eq('diagnostic_stage_id', stageId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        evaluated_user_id: r.evaluated_user_id,
        evaluating_user_id: r.evaluating_user_id,
        assignment_id: r.assignment_id,
        question_id: r.question_id,
        _skill_id: r.hard_skill_questions?.skill_id,
        _numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
      }));
    }
  };

  const fetchRawSoftResults = async (
    userId: string, qualityIds: string[], stageId?: string | null
  ): Promise<NormalizedSoftResult[]> => {
    if (snapshotContext) {
      const questionQualityMap = new Map<string, string>();
      snapshotContext.softQuestionsMap.forEach((q, qId) => {
        if (q.qualityId && qualityIds.includes(q.qualityId)) {
          questionQualityMap.set(qId, q.qualityId);
        }
      });
      const questionIds = [...questionQualityMap.keys()];
      if (questionIds.length === 0) return [];

      let query = supabase
        .from('soft_skill_results')
        .select('id, evaluated_user_id, evaluating_user_id, assignment_id, question_id, raw_numeric_value, answer_option_id')
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .in('question_id', questionIds);
      if (stageId) query = query.eq('diagnostic_stage_id', stageId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => {
        // Resolve numeric value: raw_numeric_value > snapshot answer option > 0
        let numericValue = r.raw_numeric_value;
        if (numericValue == null && r.answer_option_id) {
          const snapshotOption = snapshotContext.softAnswerOptionsMap.get(r.answer_option_id);
          numericValue = snapshotOption?.numericValue;
        }
        return {
          id: r.id,
          evaluated_user_id: r.evaluated_user_id,
          evaluating_user_id: r.evaluating_user_id,
          assignment_id: r.assignment_id,
          question_id: r.question_id,
          _quality_id: questionQualityMap.get(r.question_id),
          _numeric_value: numericValue ?? 0,
        };
      });
    } else {
      let query = supabase
        .from('soft_skill_results')
        .select(`
          id, evaluated_user_id, evaluating_user_id, assignment_id, question_id,
          soft_skill_questions!inner(quality_id),
          soft_skill_answer_options(numeric_value)
        `)
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .in('soft_skill_questions.quality_id', qualityIds);
      if (stageId) query = query.eq('diagnostic_stage_id', stageId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        evaluated_user_id: r.evaluated_user_id,
        evaluating_user_id: r.evaluating_user_id,
        assignment_id: r.assignment_id,
        question_id: r.question_id,
        _quality_id: r.soft_skill_questions?.quality_id,
        _numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
      }));
    }
  };

  // Helper: resolve assignments map from snapshot or live
  const resolveAssignmentsMap = async (rawResults: any[]): Promise<Map<string, string>> => {
    const assignmentsMap = new Map<string, string>();
    if (snapshotContext) {
      snapshotContext.assignmentsMap.forEach((a, id) => {
        if (a.assignmentType) assignmentsMap.set(id, a.assignmentType);
      });
    } else {
      const assignmentIds = [...new Set(rawResults.map((r: any) => r.assignment_id).filter(Boolean))];
      if (assignmentIds.length > 0) {
        const { data: assignments } = await supabase
          .from('survey_360_assignments')
          .select('id, assignment_type')
          .in('id', assignmentIds);
        (assignments || []).forEach((a: any) => {
          assignmentsMap.set(a.id, a.assignment_type);
        });
      }
    }
    return assignmentsMap;
  };

  // Helper: resolve evaluators info from snapshot or live
  const resolveEvalInfo = async (rawResults: any[]): Promise<Map<string, EvaluatorInfo>> => {
    if (snapshotContext) {
      const evalInfo = new Map<string, EvaluatorInfo>();
      snapshotContext.usersMap.forEach((u, id) => {
        evalInfo.set(id, {
          id,
          position_category_id: null,
          position_category_name: u.positionCategoryName
        });
      });
      return evalInfo;
    } else {
      const evaluatorIds = [...new Set(rawResults.map((r: any) => r.evaluating_user_id))];
      return fetchEvaluatorsInfo(evaluatorIds);
    }
  };

  // Helper: map normalized result to RawScore
  const toRawScore = (
    r: any,
    evalInfo: Map<string, EvaluatorInfo>,
    assignmentsMap: Map<string, string>
  ): RawScore => {
    const info = evalInfo.get(r.evaluating_user_id);
    const assignmentType = r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined;
    return {
      evaluating_user_id: r.evaluating_user_id,
      evaluated_user_id: r.evaluated_user_id,
      numeric_value: r._numeric_value,
      assignment_type: assignmentType,
      evaluator_position_category_id: info?.position_category_id || undefined,
      evaluator_position_category_name: info?.position_category_name || undefined
    };
  };

  // Helper: snapshot-only visibility map for "Назначенные всем ролям"
  // completed stage -> context only from snapshot (no live lookup)
  type SnapshotVisibilityQuestion = {
    skillId?: string | null;
    qualityId?: string | null;
    visibilityRestrictionEnabled: boolean | null;
    visibilityRestrictionType: string | null;
  };

  const isVisibleForRole = (
    restrictionEnabled: boolean | null,
    restrictionType: string | null,
    role: 'self' | 'manager' | 'peer'
  ) => !restrictionEnabled || restrictionType !== role;

  const buildAssignedToAllRolesMapFromSnapshot = (
    competencyIds: string[],
    questions: SnapshotVisibilityQuestion[],
    key: 'skillId' | 'qualityId'
  ): Map<string, { assignedToAllRoles: boolean }> => {
    const result = new Map<string, {
      visibleToSelf: boolean;
      visibleToManager: boolean;
      visibleToPeer: boolean;
      assignedToAllRoles: boolean;
    }>();

    competencyIds.forEach((id) => {
      result.set(id, {
        visibleToSelf: false,
        visibleToManager: false,
        visibleToPeer: false,
        assignedToAllRoles: false,
      });
    });

    questions.forEach((q) => {
      const competencyId = q[key];
      if (!competencyId) return;
      const current = result.get(competencyId);
      if (!current) return;

      const visibleToSelf = isVisibleForRole(
        q.visibilityRestrictionEnabled,
        q.visibilityRestrictionType,
        'self'
      );
      const visibleToManager = isVisibleForRole(
        q.visibilityRestrictionEnabled,
        q.visibilityRestrictionType,
        'manager'
      );
      const visibleToPeer = isVisibleForRole(
        q.visibilityRestrictionEnabled,
        q.visibilityRestrictionType,
        'peer'
      );

      result.set(competencyId, {
        visibleToSelf: current.visibleToSelf || visibleToSelf,
        visibleToManager: current.visibleToManager || visibleToManager,
        visibleToPeer: current.visibleToPeer || visibleToPeer,
        assignedToAllRoles: false,
      });
    });

    const finalMap = new Map<string, { assignedToAllRoles: boolean }>();
    result.forEach((value, id) => {
      finalMap.set(id, {
        assignedToAllRoles:
          value.visibleToSelf && value.visibleToManager && value.visibleToPeer,
      });
    });

    return finalMap;
  };

  // ============= HARD SKILLS =============
  const fetchHardSkills = async (userId: string, gradeId: string, stageId?: string | null) => {
    // 1. Получаем навыки из грейда (из снапшота или live)
    let gradeSkills: any[];
    if (snapshotContext) {
      gradeSkills = snapshotContext.gradeSkills.map(gs => {
        const skill = snapshotContext.hardSkillsMap.get(gs.skillId);
        return {
          skill_id: gs.skillId,
          hard_skills: {
            id: gs.skillId,
            name: skill?.name || '',
            category_id: skill?.categoryId,
            category_hard_skills: skill?.categoryName ? { name: skill.categoryName } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_skills')
        .select('skill_id, hard_skills(id, name, category_id, category_hard_skills(name))')
        .eq('grade_id', gradeId);
      gradeSkills = data || [];
    }

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    // 2. Получаем исходные оценки (snapshot-safe: без live JOINs в snapshot-mode)
    const rawResults = await fetchRawHardResults(userId, skillIds, stageId);

    // 3. Получаем информацию об assignments (из снапшота или live)
    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    // 4. Получаем информацию об оценивающих (из снапшота или live)
    const evalInfo = await resolveEvalInfo(rawResults);
    setEvaluatorsInfo(evalInfo);

    console.log('[fetchHardSkills] rawResults count:', rawResults.length);
    console.log('[fetchHardSkills] assignmentsMap:', Object.fromEntries(assignmentsMap));

    // 5. Получаем информацию о видимости навыков для фильтра "Назначенные всем ролям"
    let visibilityMap: Map<string, { assignedToAllRoles: boolean }> | null = null;
    if (skillSetFilter === 'assigned_to_all') {
      if (snapshotContext) {
        visibilityMap = buildAssignedToAllRolesMapFromSnapshot(
          skillIds,
          Array.from(snapshotContext.hardQuestionsMap.values()),
          'skillId'
        );
      } else {
        visibilityMap = await getHardSkillsRoleVisibility(skillIds);
      }
    }

    // 6. Получаем информацию о подкатегориях для навыков (из снапшота или live)
    const subcategoryMap = new Map<string, string>();
    if (snapshotContext) {
      snapshotContext.hardSkillsMap.forEach((s, id) => {
        if (s.subcategoryName) subcategoryMap.set(id, s.subcategoryName);
      });
    } else {
      const skillIdsForSubcategories = gradeSkills.map((gs: any) => gs.hard_skills.id);
      const { data: skillsWithSubcategories } = await supabase
        .from('hard_skills')
        .select('id, sub_category_id, sub_category_hard_skills(name)')
        .in('id', skillIdsForSubcategories);
      (skillsWithSubcategories || []).forEach((s: any) => {
        if (s.sub_category_hard_skills?.name) {
          subcategoryMap.set(s.id, s.sub_category_hard_skills.name);
        }
      });
    }

    // 7. Обрабатываем по каждому навыку
    const skillsData: AssessmentDataWithCounts[] = [];
    const skillsDetailed: CompetencyDetailedResult[] = [];
    let allScores: RawScore[] = [];

    for (const gs of gradeSkills) {
      const skill = (gs as any).hard_skills;
      
      // Фильтр "Назначенные всем ролям"
      if (skillSetFilter === 'assigned_to_all' && visibilityMap) {
        const visibility = visibilityMap.get(skill.id);
        if (!visibility?.assignedToAllRoles) {
          continue;
        }
      }

      const skillScores = rawResults.filter((r) => 
        r._skill_id === skill.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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

      if (normalized.startsWith(normalizeCategory('Платформа'))) {
        return HARD_SKILLS_CATEGORY_ORDER.findIndex((c) => normalizeCategory(c) === normalizeCategory('Платформа'));
      }

      return -1;
    };

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
    // 1. Получаем качества из грейда (из снапшота или live)
    let gradeQualities: any[];
    if (snapshotContext) {
      gradeQualities = snapshotContext.gradeQualities.map(gq => {
        const quality = snapshotContext.softSkillsMap.get(gq.qualityId);
        return {
          quality_id: gq.qualityId,
          soft_skills: {
            id: gq.qualityId,
            name: quality?.name || '',
            category_id: quality?.categoryId,
            category_soft_skills: quality?.categoryName ? { name: quality.categoryName } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_qualities')
        .select('quality_id, soft_skills(id, name, category_id, category_soft_skills(name))')
        .eq('grade_id', gradeId);
      gradeQualities = data || [];
    }

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    // 2. Получаем исходные оценки (snapshot-safe)
    const rawResults = await fetchRawSoftResults(userId, qualityIds, stageId);

    // 3. Получаем информацию об assignments (из снапшота или live)
    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    // 4. Получаем информацию об оценивающих (из снапшота или live)
    const evalInfo = await resolveEvalInfo(rawResults);
    setEvaluatorsInfo(evalInfo);

    // 5. Получаем информацию о видимости качеств для фильтра "Назначенные всем ролям"
    let visibilityMap: Map<string, { assignedToAllRoles: boolean }> | null = null;
    if (skillSetFilter === 'assigned_to_all') {
      if (snapshotContext) {
        visibilityMap = buildAssignedToAllRolesMapFromSnapshot(
          qualityIds,
          Array.from(snapshotContext.softQuestionsMap.values()),
          'qualityId'
        );
      } else {
        visibilityMap = await getSoftSkillsRoleVisibility(qualityIds);
      }
    }

    // 6. Получаем информацию о подкатегориях для качеств (из снапшота или live)
    const subcategoryMap = new Map<string, string>();
    if (snapshotContext) {
      snapshotContext.softSkillsMap.forEach((s, id) => {
        if (s.subcategoryName) subcategoryMap.set(id, s.subcategoryName);
      });
    } else {
      const qualityIdsForSubcategories = gradeQualities.map((gq: any) => gq.soft_skills.id);
      const { data: qualitiesWithSubcategories } = await supabase
        .from('soft_skills')
        .select('id, sub_category_id, sub_category_soft_skills(name)')
        .in('id', qualityIdsForSubcategories);
      (qualitiesWithSubcategories || []).forEach((q: any) => {
        if (q.sub_category_soft_skills?.name) {
          subcategoryMap.set(q.id, q.sub_category_soft_skills.name);
        }
      });
    }

    // 7. Обрабатываем по каждому качеству
    const qualitiesData: AssessmentDataWithCounts[] = [];
    const qualitiesDetailed: CompetencyDetailedResult[] = [];
    let allScores: RawScore[] = [];

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      
      if (skillSetFilter === 'assigned_to_all' && visibilityMap) {
        const visibility = visibilityMap.get(quality.id);
        if (!visibility?.assignedToAllRoles) {
          continue;
        }
      }

      const qualityScores = rawResults.filter((r) => 
        r._quality_id === quality.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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

    // Сортировка
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

    const overallAggregated = aggregateScores(allScores, userId, positionCategoryFilter);

    setRadarData(qualitiesData);
    setSkillResults([]);
    setQualityResults(qualitiesDetailed);
    setOverallResults({ name: 'Общая оценка', ...overallAggregated });
    setMaxValue(5);
  };

  // ============= HARD CATEGORIES =============
  const fetchHardCategories = async (userId: string, gradeId: string, stageId?: string | null) => {
    let gradeSkills: any[];
    if (snapshotContext) {
      gradeSkills = snapshotContext.gradeSkills.map(gs => {
        const skill = snapshotContext.hardSkillsMap.get(gs.skillId);
        return {
          skill_id: gs.skillId,
          hard_skills: {
            id: gs.skillId,
            name: skill?.name || '',
            category_id: skill?.categoryId,
            category_hard_skills: skill?.categoryId ? { id: skill.categoryId, name: skill.categoryName || '' } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_skills')
        .select(`skill_id, hard_skills(id, name, category_id, category_hard_skills(id, name))`)
        .eq('grade_id', gradeId);
      gradeSkills = data || [];
    }

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    // Получаем исходные оценки (snapshot-safe)
    const rawResults = await fetchRawHardResults(userId, skillIds, stageId);

    // Получаем assignments (из снапшота или live)
    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    // Получаем информацию об оценивающих (из снапшота или live)
    const evalInfo = await resolveEvalInfo(rawResults);
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

      const skillScores = rawResults.filter((r) => 
        r._skill_id === skill.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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
    let gradeQualities: any[];
    if (snapshotContext) {
      gradeQualities = snapshotContext.gradeQualities.map(gq => {
        const quality = snapshotContext.softSkillsMap.get(gq.qualityId);
        return {
          quality_id: gq.qualityId,
          soft_skills: {
            id: gq.qualityId,
            name: quality?.name || '',
            category_id: quality?.categoryId,
            category_soft_skills: quality?.categoryId ? { id: quality.categoryId, name: quality.categoryName || '' } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_qualities')
        .select(`quality_id, soft_skills(id, name, category_id, category_soft_skills(id, name))`)
        .eq('grade_id', gradeId);
      gradeQualities = data || [];
    }

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    const rawResults = await fetchRawSoftResults(userId, qualityIds, stageId);

    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    const evalInfo = await resolveEvalInfo(rawResults);
    setEvaluatorsInfo(evalInfo);

    const categoryMap = new Map<string, { name: string; scores: RawScore[]; qualitiesDetailed: CompetencyDetailedResult[] }>();

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      const category = quality.category_soft_skills;
      if (!category) continue;

      const qualityScores = rawResults.filter((r) => 
        r._quality_id === quality.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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
    let gradeSkills: any[];
    if (snapshotContext) {
      gradeSkills = snapshotContext.gradeSkills.map(gs => {
        const skill = snapshotContext.hardSkillsMap.get(gs.skillId);
        const subcat = skill?.subCategoryId ? snapshotContext.hardSubcategoriesMap.get(skill.subCategoryId) : null;
        return {
          skill_id: gs.skillId,
          hard_skills: {
            id: gs.skillId,
            name: skill?.name || '',
            sub_category_id: skill?.subCategoryId,
            sub_category_hard_skills: subcat ? { id: skill!.subCategoryId, name: subcat.name } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_skills')
        .select(`skill_id, hard_skills(id, name, sub_category_id, sub_category_hard_skills(id, name))`)
        .eq('grade_id', gradeId);
      gradeSkills = data || [];
    }

    if (!gradeSkills || gradeSkills.length === 0) {
      resetState();
      return;
    }

    const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

    const rawResults = await fetchRawHardResults(userId, skillIds, stageId);

    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    const evalInfo = await resolveEvalInfo(rawResults);
    setEvaluatorsInfo(evalInfo);

    const subcategoryMap = new Map<string, { name: string; scores: RawScore[]; skillsDetailed: CompetencyDetailedResult[] }>();

    for (const gs of gradeSkills) {
      const skill = (gs as any).hard_skills;
      const subcategory = skill.sub_category_hard_skills;
      if (!subcategory) continue;

      const skillScores = rawResults.filter((r) => 
        r._skill_id === skill.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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
    let gradeQualities: any[];
    if (snapshotContext) {
      gradeQualities = snapshotContext.gradeQualities.map(gq => {
        const quality = snapshotContext.softSkillsMap.get(gq.qualityId);
        const subcat = quality?.subCategoryId ? snapshotContext.softSubcategoriesMap.get(quality.subCategoryId) : null;
        return {
          quality_id: gq.qualityId,
          soft_skills: {
            id: gq.qualityId,
            name: quality?.name || '',
            sub_category_id: quality?.subCategoryId,
            sub_category_soft_skills: subcat ? { id: quality!.subCategoryId, name: subcat.name } : null
          }
        };
      });
    } else {
      const { data } = await supabase
        .from('grade_qualities')
        .select(`quality_id, soft_skills(id, name, sub_category_id, sub_category_soft_skills(id, name))`)
        .eq('grade_id', gradeId);
      gradeQualities = data || [];
    }

    if (!gradeQualities || gradeQualities.length === 0) {
      resetState();
      return;
    }

    const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

    const rawResults = await fetchRawSoftResults(userId, qualityIds, stageId);

    const assignmentsMap = await resolveAssignmentsMap(rawResults);

    const evalInfo = await resolveEvalInfo(rawResults);
    setEvaluatorsInfo(evalInfo);

    const subcategoryMap = new Map<string, { name: string; scores: RawScore[]; qualitiesDetailed: CompetencyDetailedResult[] }>();

    for (const gq of gradeQualities) {
      const quality = (gq as any).soft_skills;
      const subcategory = quality.sub_category_soft_skills;
      if (!subcategory) continue;

      const qualityScores = rawResults.filter((r) => 
        r._quality_id === quality.id
      ).map((r) => toRawScore(r, evalInfo, assignmentsMap));

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
    const selfScores: number[] = [];
    const managerScores: number[] = [];
    const peerScores: number[] = [];
    
    const selfUsers = new Set<string>();
    const managerUsers = new Set<string>();
    const peerUsers = new Set<string>();

    const peersByCategory = new Map<string, { scores: number[]; users: Set<string>; name: string }>();

    scores.forEach(score => {
      if (score.numeric_value === 0) return;

      const isSelf = score.evaluating_user_id === evaluatedUserId || score.assignment_type === 'self';
      const isManager = score.assignment_type === 'manager';
      const isPeer = !isSelf && (score.assignment_type === 'peer' || (!isManager && score.evaluating_user_id !== evaluatedUserId));

      if (isSelf) {
        selfScores.push(score.numeric_value);
        selfUsers.add(score.evaluating_user_id);
      } else if (isManager) {
        managerScores.push(score.numeric_value);
        managerUsers.add(score.evaluating_user_id);
      } else if (isPeer) {
        const categoryId = score.evaluator_position_category_id || 'unknown';
        const categoryName = score.evaluator_position_category_name || 'Без категории';

        if (positionCategoryFilter === 'all' || positionCategoryFilter === categoryId) {
          peerScores.push(score.numeric_value);
          peerUsers.add(score.evaluating_user_id);
        }

        if (!peersByCategory.has(categoryId)) {
          peersByCategory.set(categoryId, { scores: [], users: new Set(), name: categoryName });
        }
        const catData = peersByCategory.get(categoryId)!;
        catData.scores.push(score.numeric_value);
        catData.users.add(score.evaluating_user_id);
      }
    });

    const self_assessment = selfScores.length > 0 
      ? selfScores.reduce((sum, val) => sum + val, 0) / selfScores.length 
      : null;

    const manager_assessment = managerScores.length > 0
      ? managerScores.reduce((sum, val) => sum + val, 0) / managerScores.length
      : null;

    const peers_average = peerScores.length > 0
      ? peerScores.reduce((sum, val) => sum + val, 0) / peerScores.length
      : null;

    const allExceptSelfScores = [...managerScores, ...peerScores];
    const all_except_self = allExceptSelfScores.length > 0
      ? allExceptSelfScores.reduce((sum, val) => sum + val, 0) / allExceptSelfScores.length
      : null;

    const allScores = [...selfScores, ...managerScores, ...peerScores];
    const all_average = allScores.length > 0
      ? allScores.reduce((sum, val) => sum + val, 0) / allScores.length
      : null;

    const allExceptSelfUsers = new Set([...managerUsers, ...peerUsers]);
    const allUsers = new Set([...selfUsers, ...managerUsers, ...peerUsers]);

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
