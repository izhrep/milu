import { supabase } from '@/integrations/supabase/client';
import type {
  SnapshotContext,
  SnapshotUserContext,
  SnapshotAssignment,
  SnapshotSkill,
  SnapshotQuestion,
  SnapshotAnswerOption,
  SnapshotCategory,
  SnapshotSubcategory,
  SnapshotGradeSkill,
  SnapshotGradeQuality,
  SnapshotAnswerCategory,
} from '@/hooks/useSnapshotContext';

/**
 * Imperative (non-hook) loader for snapshot context.
 * Picks ANY current snapshot for the given stage to access shared reference data
 * (questions, skills, answer options, categories).
 * Returns null when no snapshot exists.
 */
export async function loadSnapshotForStage(
  stageId: string
): Promise<SnapshotContext | null> {
  // 1. Find any current snapshot for this stage
  const { data: header, error: headerError } = await supabase
    .from('diagnostic_result_snapshots')
    .select('id, evaluated_user_id')
    .eq('stage_id', stageId)
    .eq('is_current', true)
    .limit(1)
    .maybeSingle();

  if (headerError) throw headerError;
  if (!header) return null;

  const diagnosticId = header.id;

  // 2. Load all 15 snapshot tables in parallel
  const [
    usersRes, assignmentsRes, answerCatsRes,
    gradeSkillsRes, gradeQualitiesRes,
    hardCatsRes, hardSubcatsRes, hardSkillsRes, hardQuestionsRes, hardOptionsRes,
    softCatsRes, softSubcatsRes, softSkillsRes, softQuestionsRes, softOptionsRes,
  ] = await Promise.all([
    supabase.from('diagnostic_user_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('survey_assignment_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('answer_category_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('grade_skill_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('grade_quality_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('hard_skill_category_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('hard_skill_subcategory_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('hard_skill_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('hard_skill_question_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('hard_skill_answer_option_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('soft_skill_category_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('soft_skill_subcategory_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('soft_skill_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('soft_skill_question_snapshots').select('*').eq('diagnostic_id', diagnosticId),
    supabase.from('soft_skill_answer_option_snapshots').select('*').eq('diagnostic_id', diagnosticId),
  ]);

  // 3. Build Maps (same logic as useSnapshotContext hook)
  const usersMap = new Map<string, SnapshotUserContext>();
  (usersRes.data || []).forEach((u: any) => {
    usersMap.set(u.entity_id, {
      entityId: u.entity_id, lastName: u.last_name, firstName: u.first_name,
      middleName: u.middle_name, gradeId: u.grade_id, gradeName: u.grade_name,
      positionName: u.position_name, departmentName: u.department_name,
      positionCategoryName: u.position_category_name,
    });
  });

  const assignmentsMap = new Map<string, SnapshotAssignment>();
  (assignmentsRes.data || []).forEach((a: any) => {
    assignmentsMap.set(a.entity_id, {
      entityId: a.entity_id, evaluatingUserId: a.evaluating_user_id,
      assignmentType: a.assignment_type, evaluatorLastName: a.evaluator_last_name,
      evaluatorFirstName: a.evaluator_first_name,
      evaluatorPositionCategoryName: a.evaluator_position_category_name,
    });
  });

  const answerCategoriesMap = new Map<string, SnapshotAnswerCategory>();
  (answerCatsRes.data || []).forEach((ac: any) => {
    answerCategoriesMap.set(ac.entity_id, {
      entityId: ac.entity_id, name: ac.name,
      questionType: ac.question_type, commentRequired: ac.comment_required,
    });
  });

  const gradeSkills: SnapshotGradeSkill[] = (gradeSkillsRes.data || []).map((gs: any) => ({
    entityId: gs.entity_id, skillId: gs.skill_id, gradeId: gs.grade_id, targetLevel: gs.target_level,
  }));

  const gradeQualities: SnapshotGradeQuality[] = (gradeQualitiesRes.data || []).map((gq: any) => ({
    entityId: gq.entity_id, qualityId: gq.quality_id, gradeId: gq.grade_id, targetLevel: gq.target_level,
  }));

  const buildCategoryMap = (data: any[]) => {
    const m = new Map<string, SnapshotCategory>();
    data.forEach((c: any) => m.set(c.entity_id, { entityId: c.entity_id, name: c.name, description: c.description }));
    return m;
  };

  const buildSubcategoryMap = (data: any[]) => {
    const m = new Map<string, SnapshotSubcategory>();
    data.forEach((sc: any) => m.set(sc.entity_id, {
      entityId: sc.entity_id, name: sc.name, categoryId: sc.category_id, categoryName: sc.category_name,
    }));
    return m;
  };

  const buildSkillMap = (data: any[]) => {
    const m = new Map<string, SnapshotSkill>();
    data.forEach((s: any) => m.set(s.entity_id, {
      entityId: s.entity_id, name: s.name, description: s.description,
      categoryId: s.category_id, categoryName: s.category_name,
      subCategoryId: s.sub_category_id, subcategoryName: s.subcategory_name,
    }));
    return m;
  };

  const buildOptionMap = (data: any[]) => {
    const m = new Map<string, SnapshotAnswerOption>();
    data.forEach((o: any) => m.set(o.entity_id, {
      entityId: o.entity_id, answerCategoryId: o.answer_category_id,
      numericValue: o.numeric_value, levelValue: o.level_value,
      title: o.title, description: o.description, orderIndex: o.order_index,
    }));
    return m;
  };

  const hardQuestionsMap = new Map<string, SnapshotQuestion>();
  (hardQuestionsRes.data || []).forEach((q: any) => {
    hardQuestionsMap.set(q.entity_id, {
      entityId: q.entity_id, questionText: q.question_text,
      skillId: q.skill_id, answerCategoryId: q.answer_category_id,
      orderIndex: q.order_index, commentRequiredOverride: q.comment_required_override,
      visibilityRestrictionEnabled: q.visibility_restriction_enabled,
      visibilityRestrictionType: q.visibility_restriction_type,
    });
  });

  const softQuestionsMap = new Map<string, SnapshotQuestion>();
  (softQuestionsRes.data || []).forEach((q: any) => {
    softQuestionsMap.set(q.entity_id, {
      entityId: q.entity_id, questionText: q.question_text,
      skillId: null, qualityId: q.quality_id, answerCategoryId: q.answer_category_id,
      category: q.category, orderIndex: q.order_index,
      behavioralIndicators: q.behavioral_indicators,
      commentRequiredOverride: q.comment_required_override,
      visibilityRestrictionEnabled: q.visibility_restriction_enabled,
      visibilityRestrictionType: q.visibility_restriction_type,
    });
  });

  const evaluatedUser = usersMap.get(header.evaluated_user_id) || null;

  return {
    snapshotId: diagnosticId,
    isHistorical: true,
    evaluatedUser,
    usersMap,
    assignmentsMap,
    hardSkillsMap: buildSkillMap(hardSkillsRes.data || []),
    softSkillsMap: buildSkillMap(softSkillsRes.data || []),
    hardQuestionsMap,
    softQuestionsMap,
    hardAnswerOptionsMap: buildOptionMap(hardOptionsRes.data || []),
    softAnswerOptionsMap: buildOptionMap(softOptionsRes.data || []),
    hardCategoriesMap: buildCategoryMap(hardCatsRes.data || []),
    softCategoriesMap: buildCategoryMap(softCatsRes.data || []),
    hardSubcategoriesMap: buildSubcategoryMap(hardSubcatsRes.data || []),
    softSubcategoriesMap: buildSubcategoryMap(softSubcatsRes.data || []),
    gradeSkills,
    gradeQualities,
    answerCategoriesMap,
  };
}
