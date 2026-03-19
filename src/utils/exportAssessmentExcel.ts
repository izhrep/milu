import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { getHardSkillsRoleVisibility, getSoftSkillsRoleVisibility } from '@/hooks/useSkillRoleVisibility';
import type { SnapshotContext } from '@/hooks/useSnapshotContext';

// Sheet names matching the template
const SHEET1_NAME = 'Hard+Soft Skills. Коллеги';
const SHEET2_NAME = 'Hard Skills. Unit Lead';

interface ScoresBySkill {
  self: number[];
  manager: number[];
  peer: number[];
  externalPeer: number[];
}

interface AnswerLevel {
  numeric_value: number;
  title: string;
  description: string | null;
}

/**
 * Main export function — fetches raw data from DB and builds Excel file.
 * When snapshotContext is provided, all metadata (skill names, categories,
 * answer options, assignments, evaluator info) is read from snapshot tables
 * instead of live master tables.
 */
export async function exportAssessmentExcel(
  userId: string,
  stageId: string | null,
  evaluatedUserName: string,
  periodName?: string,
  snapshotContext?: SnapshotContext | null
) {
  // 1. Get user's grade
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('grade_id')
    .eq('id', userId)
    .single();

  if (userError || !userData?.grade_id) {
    throw new Error('Грейд пользователя не найден');
  }

  // 2. Fetch grade skills and qualities (from snapshot or live)
  let gradeSkills: any[];
  let gradeQualities: any[];

  if (snapshotContext) {
    gradeSkills = snapshotContext.gradeSkills.map(gs => {
      const skill = snapshotContext.hardSkillsMap.get(gs.skillId);
      return {
        skill_id: gs.skillId,
        hard_skills: {
          id: gs.skillId,
          name: skill?.name || '',
          category_hard_skills: skill?.categoryName ? { name: skill.categoryName } : null
        }
      };
    });
    gradeQualities = snapshotContext.gradeQualities.map(gq => {
      const quality = snapshotContext.softSkillsMap.get(gq.qualityId);
      return {
        quality_id: gq.qualityId,
        soft_skills: {
          id: gq.qualityId,
          name: quality?.name || ''
        }
      };
    });
  } else {
    const [gradeSkillsRes, gradeQualitiesRes] = await Promise.all([
      supabase
        .from('grade_skills')
        .select(`skill_id, hard_skills (id, name, category_hard_skills (name))`)
        .eq('grade_id', userData.grade_id),
      supabase
        .from('grade_qualities')
        .select(`quality_id, soft_skills (id, name)`)
        .eq('grade_id', userData.grade_id)
    ]);

    if (gradeSkillsRes.error) throw gradeSkillsRes.error;
    if (gradeQualitiesRes.error) throw gradeQualitiesRes.error;

    gradeSkills = gradeSkillsRes.data || [];
    gradeQualities = gradeQualitiesRes.data || [];
  }

  const skillIds = gradeSkills.map(gs => gs.skill_id).filter(Boolean);
  const qualityIds = gradeQualities.map(gq => gq.quality_id).filter(Boolean);

  // 3. Visibility filter (assigned_to_all) for Sheet1
  const [hardVisibility, softVisibility] = await Promise.all([
    getHardSkillsRoleVisibility(skillIds),
    getSoftSkillsRoleVisibility(qualityIds)
  ]);

  const assignedToAllSkillIds = new Set(
    skillIds.filter(id => hardVisibility.get(id)?.assignedToAllRoles)
  );
  const assignedToAllQualityIds = new Set(
    qualityIds.filter(id => softVisibility.get(id)?.assignedToAllRoles)
  );

  // 4. Fetch raw results from DB (dual-path for snapshot mode)
  let hardResults: any[];
  let softResults: any[];

  if (snapshotContext) {
    // SNAPSHOT MODE: query without live JOINs, resolve via snapshot maps
    const hardQuestionIds: string[] = [];
    const hardQuestionSkillMap = new Map<string, string>();
    snapshotContext.hardQuestionsMap.forEach((q, qId) => {
      if (q.skillId && skillIds.includes(q.skillId)) {
        hardQuestionIds.push(qId);
        hardQuestionSkillMap.set(qId, q.skillId);
      }
    });

    const softQuestionIds: string[] = [];
    const softQuestionQualityMap = new Map<string, string>();
    snapshotContext.softQuestionsMap.forEach((q, qId) => {
      if (q.qualityId && qualityIds.includes(q.qualityId)) {
        softQuestionIds.push(qId);
        softQuestionQualityMap.set(qId, q.qualityId);
      }
    });

    let hardQuery = supabase
      .from('hard_skill_results')
      .select('evaluating_user_id, assignment_id, question_id, raw_numeric_value')
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false');
    if (hardQuestionIds.length > 0) {
      hardQuery = hardQuery.in('question_id', hardQuestionIds);
    }
    if (stageId) hardQuery = hardQuery.eq('diagnostic_stage_id', stageId);

    let softQuery = supabase
      .from('soft_skill_results')
      .select('evaluating_user_id, assignment_id, question_id, raw_numeric_value')
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false');
    if (softQuestionIds.length > 0) {
      softQuery = softQuery.in('question_id', softQuestionIds);
    }
    if (stageId) softQuery = softQuery.eq('diagnostic_stage_id', stageId);

    const [hardRes, softRes] = await Promise.all([hardQuery, softQuery]);
    if (hardRes.error) throw hardRes.error;
    if (softRes.error) throw softRes.error;

    // Normalize: add _skill_id / _quality_id and _numeric_value
    hardResults = (hardRes.data || []).map((r: any) => ({
      ...r,
      _skill_id: hardQuestionSkillMap.get(r.question_id),
      _numeric_value: r.raw_numeric_value ?? 0,
    }));
    softResults = (softRes.data || []).map((r: any) => ({
      ...r,
      _quality_id: softQuestionQualityMap.get(r.question_id),
      _numeric_value: r.raw_numeric_value ?? 0,
    }));
  } else {
    // LIVE MODE: query with JOINs
    let hardResultsQuery = supabase
      .from('hard_skill_results')
      .select(`
        evaluating_user_id, assignment_id, question_id, raw_numeric_value,
        hard_skill_questions!inner(skill_id, answer_category_id),
        hard_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false');
    if (stageId) hardResultsQuery = hardResultsQuery.eq('diagnostic_stage_id', stageId);

    let softResultsQuery = supabase
      .from('soft_skill_results')
      .select(`
        evaluating_user_id, assignment_id, question_id, raw_numeric_value,
        soft_skill_questions!inner(quality_id, answer_category_id),
        soft_skill_answer_options(numeric_value)
      `)
      .eq('evaluated_user_id', userId)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false');
    if (stageId) softResultsQuery = softResultsQuery.eq('diagnostic_stage_id', stageId);

    const [hardResultsRes, softResultsRes] = await Promise.all([hardResultsQuery, softResultsQuery]);
    if (hardResultsRes.error) throw hardResultsRes.error;
    if (softResultsRes.error) throw softResultsRes.error;

    hardResults = (hardResultsRes.data || []).map((r: any) => ({
      ...r,
      _skill_id: r.hard_skill_questions?.skill_id,
      _numeric_value: r.raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
    }));
    softResults = (softResultsRes.data || []).map((r: any) => ({
      ...r,
      _quality_id: r.soft_skill_questions?.quality_id,
      _numeric_value: r.raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
    }));
  }

  // 5. Fetch assignments to determine evaluator types (from snapshot or live)
  const assignmentsMap = new Map<string, string>();
  if (snapshotContext) {
    snapshotContext.assignmentsMap.forEach((a, id) => {
      if (a.assignmentType) assignmentsMap.set(id, a.assignmentType);
    });
  } else {
    const allAssignmentIds = [
      ...new Set([
        ...hardResults.map((r: any) => r.assignment_id),
        ...softResults.map((r: any) => r.assignment_id)
      ].filter(Boolean))
    ];
    if (allAssignmentIds.length > 0) {
      const { data: assignments } = await supabase
        .from('survey_360_assignments')
        .select('id, assignment_type')
        .in('id', allAssignmentIds);
      (assignments || []).forEach((a: any) => {
        assignmentsMap.set(a.id, a.assignment_type);
      });
    }
  }

  // 6. Fetch evaluator position categories (from snapshot or live)
  const evaluatorPositionCategoryMap = new Map<string, string>();
  if (snapshotContext) {
    snapshotContext.usersMap.forEach((u, id) => {
      evaluatorPositionCategoryMap.set(id, u.positionCategoryName || '');
    });
  } else {
    const allEvaluatorIds = [
      ...new Set([
        ...hardResults.map((r: any) => r.evaluating_user_id),
        ...softResults.map((r: any) => r.evaluating_user_id)
      ].filter(Boolean))
    ];
    if (allEvaluatorIds.length > 0) {
      const { data: evaluators } = await supabase
        .from('users')
        .select('id, position_id, positions(position_category_id, position_categories(name))')
        .in('id', allEvaluatorIds);
      (evaluators || []).forEach((u: any) => {
        const catName = u.positions?.position_categories?.name || '';
        evaluatorPositionCategoryMap.set(u.id, catName);
      });
    }
  }

  // Helper: determine evaluator type
  const getEvaluatorType = (result: any): 'self' | 'manager' | 'peer' => {
    const assignmentType = assignmentsMap.get(result.assignment_id);
    if (assignmentType === 'self' || result.evaluating_user_id === userId) return 'self';
    if (assignmentType === 'manager') return 'manager';
    return 'peer';
  };

  const isExternalPeer = (evaluatorId: string): boolean => {
    const catName = evaluatorPositionCategoryMap.get(evaluatorId) || '';
    return catName.toLowerCase().includes('(внешний)');
  };

  // 7. Aggregate hard skill scores
  const hardScoresMap = new Map<string, ScoresBySkill>();
  hardResults.forEach((r: any) => {
    const skillId = r._skill_id;
    const numericValue = r._numeric_value;
    if (!skillId || numericValue == null || numericValue === 0) return;

    if (!hardScoresMap.has(skillId)) {
      hardScoresMap.set(skillId, { self: [], manager: [], peer: [], externalPeer: [] });
    }
    const scores = hardScoresMap.get(skillId)!;
    const evalType = getEvaluatorType(r);

    if (evalType === 'self') {
      scores.self.push(numericValue);
    } else if (evalType === 'manager') {
      scores.manager.push(numericValue);
    } else {
      scores.peer.push(numericValue);
      if (isExternalPeer(r.evaluating_user_id)) {
        scores.externalPeer.push(numericValue);
      }
    }
  });

  // 8. Aggregate soft skill scores
  const softScoresMap = new Map<string, ScoresBySkill>();
  softResults.forEach((r: any) => {
    const qualityId = r._quality_id;
    const numericValue = r._numeric_value;
    if (!qualityId || numericValue == null || numericValue === 0) return;

    if (!softScoresMap.has(qualityId)) {
      softScoresMap.set(qualityId, { self: [], manager: [], peer: [], externalPeer: [] });
    }
    const scores = softScoresMap.get(qualityId)!;
    const evalType = getEvaluatorType(r);

    if (evalType === 'self') {
      scores.self.push(numericValue);
    } else if (evalType === 'manager') {
      scores.manager.push(numericValue);
    } else {
      scores.peer.push(numericValue);
    }
  });

  // 9. Fetch answer options for level descriptions (from snapshot or live)
  const hardSkillAnswerCategoryMap = new Map<string, string>();
  const softSkillAnswerCategoryMap = new Map<string, string>();
  const hardLevelsMap = new Map<string, AnswerLevel[]>();
  const softLevelsMap = new Map<string, AnswerLevel[]>();

  if (snapshotContext) {
    // Build skill → answer_category from snapshot questions
    snapshotContext.hardQuestionsMap.forEach((q) => {
      if (q.skillId && q.answerCategoryId) {
        hardSkillAnswerCategoryMap.set(q.skillId, q.answerCategoryId);
      }
    });
    snapshotContext.softQuestionsMap.forEach((q) => {
      if (q.qualityId && q.answerCategoryId) {
        softSkillAnswerCategoryMap.set(q.qualityId, q.answerCategoryId);
      }
    });

    // Build levels from snapshot answer options
    snapshotContext.hardAnswerOptionsMap.forEach((opt) => {
      const catId = opt.answerCategoryId;
      if (!catId) return;
      if (!hardLevelsMap.has(catId)) hardLevelsMap.set(catId, []);
      hardLevelsMap.get(catId)!.push({
        numeric_value: opt.numericValue,
        title: opt.title,
        description: opt.description
      });
    });
    snapshotContext.softAnswerOptionsMap.forEach((opt) => {
      const catId = opt.answerCategoryId;
      if (!catId) return;
      if (!softLevelsMap.has(catId)) softLevelsMap.set(catId, []);
      softLevelsMap.get(catId)!.push({
        numeric_value: opt.numericValue,
        title: opt.title,
        description: opt.description
      });
    });
  } else {
    // Live: fetch from DB
    const hardAnswerCategoryIds = [
      ...new Set(hardResults.map((r: any) => r.hard_skill_questions?.answer_category_id).filter(Boolean))
    ];
    const softAnswerCategoryIds = [
      ...new Set(softResults.map((r: any) => r.soft_skill_questions?.answer_category_id).filter(Boolean))
    ];

    const [hardQuestionsRes, softQuestionsRes] = await Promise.all([
      supabase.from('hard_skill_questions').select('skill_id, answer_category_id').in('skill_id', skillIds),
      supabase.from('soft_skill_questions').select('quality_id, answer_category_id').in('quality_id', qualityIds)
    ]);

    (hardQuestionsRes.data || []).forEach((q: any) => {
      if (q.skill_id && q.answer_category_id) {
        hardSkillAnswerCategoryMap.set(q.skill_id, q.answer_category_id);
      }
    });
    (softQuestionsRes.data || []).forEach((q: any) => {
      if (q.quality_id && q.answer_category_id) {
        softSkillAnswerCategoryMap.set(q.quality_id, q.answer_category_id);
      }
    });

    const allHardCatIds = [...new Set([
      ...hardAnswerCategoryIds,
      ...Array.from(hardSkillAnswerCategoryMap.values())
    ])];
    const allSoftCatIds = [...new Set([
      ...softAnswerCategoryIds,
      ...Array.from(softSkillAnswerCategoryMap.values())
    ])];

    const [hardOptionsRes, softOptionsRes] = await Promise.all([
      allHardCatIds.length > 0
        ? supabase.from('hard_skill_answer_options').select('answer_category_id, title, description, numeric_value').in('answer_category_id', allHardCatIds).order('numeric_value')
        : Promise.resolve({ data: [], error: null }),
      allSoftCatIds.length > 0
        ? supabase.from('soft_skill_answer_options').select('answer_category_id, title, description, numeric_value').in('answer_category_id', allSoftCatIds).order('numeric_value')
        : Promise.resolve({ data: [], error: null })
    ]);

    (hardOptionsRes.data || []).forEach((opt: any) => {
      if (!opt.answer_category_id) return;
      if (!hardLevelsMap.has(opt.answer_category_id)) hardLevelsMap.set(opt.answer_category_id, []);
      hardLevelsMap.get(opt.answer_category_id)!.push({
        numeric_value: opt.numeric_value, title: opt.title, description: opt.description
      });
    });
    (softOptionsRes.data || []).forEach((opt: any) => {
      if (!opt.answer_category_id) return;
      if (!softLevelsMap.has(opt.answer_category_id)) softLevelsMap.set(opt.answer_category_id, []);
      softLevelsMap.get(opt.answer_category_id)!.push({
        numeric_value: opt.numeric_value, title: opt.title, description: opt.description
      });
    });
  }

  // Helper: get level text for a skill
  const getHardLevelText = (skillId: string, level: number): string => {
    const catId = hardSkillAnswerCategoryMap.get(skillId);
    if (!catId) return '';
    const levels = hardLevelsMap.get(catId);
    const found = levels?.find(l => l.numeric_value === level);
    if (!found) return '';
    return found.description ? `${found.title}: ${found.description}` : found.title;
  };

  const getSoftLevelText = (qualityId: string, level: number): string => {
    const catId = softSkillAnswerCategoryMap.get(qualityId);
    if (!catId) return '';
    const levels = softLevelsMap.get(catId);
    const found = levels?.find(l => l.numeric_value === level);
    if (!found) return '';
    return found.description ? `${found.title}: ${found.description}` : found.title;
  };

  const avg = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const fmtScore = (v: number | null): string | number => {
    if (v == null) return '';
    return Math.round(v * 100) / 100;
  };

  // ============ BUILD SHEET 1 ============
  const sheet1Data: any[][] = [];

  sheet1Data.push([
    'Hard-навыки (max - 4)',
    'Балл все кроме сотрудника',
    'Балл Unit-Lead',
    'Балл внешние',
    'Балл от себя',
    'Не владеет - 1',
    'Базовый уровень - 2',
    'Средний уровень - 3',
    'Эксперт - 4'
  ]);

  gradeSkills.forEach(gs => {
    if (!gs.hard_skills || !assignedToAllSkillIds.has(gs.skill_id)) return;
    const scores = hardScoresMap.get(gs.skill_id);
    const allExceptSelf = scores ? avg([...scores.manager, ...scores.peer]) : null;
    const managerScore = scores ? avg(scores.manager) : null;
    const externalScore = scores ? avg(scores.externalPeer) : null;
    const selfScore = scores ? avg(scores.self) : null;

    sheet1Data.push([
      gs.hard_skills.name,
      fmtScore(allExceptSelf),
      fmtScore(managerScore),
      fmtScore(externalScore),
      fmtScore(selfScore),
      getHardLevelText(gs.skill_id, 1),
      getHardLevelText(gs.skill_id, 2),
      getHardLevelText(gs.skill_id, 3),
      getHardLevelText(gs.skill_id, 4)
    ]);
  });

  sheet1Data.push([]);

  sheet1Data.push([
    'Soft-навыки',
    'Среднее от коллег (без ответов сотрудника) (max - 5)',
    'Не владеет - 1',
    'Начинающий - 2',
    'Базовый - 3',
    'Уверенный - 4',
    'Экспертный - 5'
  ]);

  gradeQualities.forEach(gq => {
    if (!gq.soft_skills || !assignedToAllQualityIds.has(gq.quality_id)) return;
    const scores = softScoresMap.get(gq.quality_id);
    const allExceptSelf = scores ? avg([...scores.manager, ...scores.peer]) : null;

    sheet1Data.push([
      gq.soft_skills.name,
      fmtScore(allExceptSelf),
      getSoftLevelText(gq.quality_id, 1),
      getSoftLevelText(gq.quality_id, 2),
      getSoftLevelText(gq.quality_id, 3),
      getSoftLevelText(gq.quality_id, 4),
      getSoftLevelText(gq.quality_id, 5)
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: 55 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 80 }, { wch: 80 }, { wch: 80 }, { wch: 80 },
  ];

  // ============ BUILD SHEET 2 ============
  const sheet2Data: any[][] = [];

  sheet2Data.push([
    'Компетенция', 'Hard-навык', 'Балл самооценки', 'Балл Unit-lead',
    'Не владеет - 1', 'Базовый уровень - 2', 'Средний уровень - 3', 'Эксперт - 4'
  ]);

  const skillsByCategory = new Map<string, typeof gradeSkills>();
  gradeSkills.forEach(gs => {
    if (!gs.hard_skills) return;
    const catName = gs.hard_skills.category_hard_skills?.name || 'Без категории';
    if (!skillsByCategory.has(catName)) {
      skillsByCategory.set(catName, []);
    }
    skillsByCategory.get(catName)!.push(gs);
  });

  skillsByCategory.forEach((skills, category) => {
    skills.forEach((gs, idx) => {
      if (!gs.hard_skills) return;
      const scores = hardScoresMap.get(gs.skill_id);
      const selfScore = scores ? avg(scores.self) : null;
      const managerScore = scores ? avg(scores.manager) : null;

      sheet2Data.push([
        idx === 0 ? category : '',
        gs.hard_skills.name,
        fmtScore(selfScore),
        fmtScore(managerScore),
        getHardLevelText(gs.skill_id, 1),
        getHardLevelText(gs.skill_id, 2),
        getHardLevelText(gs.skill_id, 3),
        getHardLevelText(gs.skill_id, 4)
      ]);
    });
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 40 }, { wch: 55 }, { wch: 15 }, { wch: 15 },
    { wch: 80 }, { wch: 80 }, { wch: 80 }, { wch: 80 },
  ];

  // ============ CREATE WORKBOOK & SAVE ============
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, SHEET1_NAME);
  XLSX.utils.book_append_sheet(wb, ws2, SHEET2_NAME);

  const safeName = evaluatedUserName.replace(/[^а-яА-ЯёЁa-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  const safePeriod = (periodName || 'период').replace(/[^а-яА-ЯёЁa-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  const fileName = `Результаты_360_${safeName}_${safePeriod}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
