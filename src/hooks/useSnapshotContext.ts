import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================
// Snapshot Context Hook
// Loads frozen snapshot data from 16 normalized snapshot tables
// when viewing a completed diagnostic stage.
// ============================================================

export interface SnapshotUserContext {
  entityId: string;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  positionName: string | null;
  departmentName: string | null;
  positionCategoryName: string | null;
}

export interface SnapshotAssignment {
  entityId: string;
  evaluatingUserId: string | null;
  assignmentType: string | null;
  evaluatorLastName: string | null;
  evaluatorFirstName: string | null;
  evaluatorPositionCategoryName: string | null;
}

export interface SnapshotSkill {
  entityId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subCategoryId: string | null;
  subcategoryName: string | null;
}

export interface SnapshotQuestion {
  entityId: string;
  questionText: string;
  skillId: string | null;
  qualityId?: string | null;
  answerCategoryId: string | null;
  orderIndex: number | null;
  category?: string | null;
  behavioralIndicators?: string | null;
  commentRequiredOverride: boolean | null;
  visibilityRestrictionEnabled: boolean | null;
  visibilityRestrictionType: string | null;
}

export interface SnapshotAnswerOption {
  entityId: string;
  answerCategoryId: string | null;
  numericValue: number;
  levelValue: number | null;
  title: string;
  description: string | null;
  orderIndex: number | null;
}

export interface SnapshotCategory {
  entityId: string;
  name: string;
  description: string | null;
}

export interface SnapshotSubcategory {
  entityId: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface SnapshotGradeSkill {
  entityId: string;
  skillId: string;
  gradeId: string;
  targetLevel: number;
}

export interface SnapshotGradeQuality {
  entityId: string;
  qualityId: string;
  gradeId: string;
  targetLevel: number;
}

export interface SnapshotAnswerCategory {
  entityId: string;
  name: string;
  questionType: string | null;
  commentRequired: boolean | null;
}

export interface SnapshotContext {
  snapshotId: string;
  isHistorical: true;
  evaluatedUser: SnapshotUserContext | null;
  usersMap: Map<string, SnapshotUserContext>;
  assignmentsMap: Map<string, SnapshotAssignment>;
  hardSkillsMap: Map<string, SnapshotSkill>;
  softSkillsMap: Map<string, SnapshotSkill>;
  hardQuestionsMap: Map<string, SnapshotQuestion>;
  softQuestionsMap: Map<string, SnapshotQuestion>;
  hardAnswerOptionsMap: Map<string, SnapshotAnswerOption>;
  softAnswerOptionsMap: Map<string, SnapshotAnswerOption>;
  hardCategoriesMap: Map<string, SnapshotCategory>;
  softCategoriesMap: Map<string, SnapshotCategory>;
  hardSubcategoriesMap: Map<string, SnapshotSubcategory>;
  softSubcategoriesMap: Map<string, SnapshotSubcategory>;
  gradeSkills: SnapshotGradeSkill[];
  gradeQualities: SnapshotGradeQuality[];
  answerCategoriesMap: Map<string, SnapshotAnswerCategory>;
}

export type SnapshotContextResult = {
  snapshotContext: SnapshotContext | null;
  isHistorical: boolean;
  loading: boolean;
  error: string | null;
};

export function useSnapshotContext(
  stageId: string | null,
  userId: string | undefined
): SnapshotContextResult {
  // 1. Fetch snapshot header (always, regardless of stage status)
  const { data: snapshotHeader, isLoading: headerLoading } = useQuery({
    queryKey: ['snapshot-header', stageId, userId],
    queryFn: async () => {
      if (!stageId || !userId) return null;
      const { data, error } = await supabase
        .from('diagnostic_result_snapshots')
        .select('id')
        .eq('stage_id', stageId)
        .eq('evaluated_user_id', userId)
        .eq('is_current', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!stageId && !!userId,
  });

  const diagnosticId = snapshotHeader?.id;
  const isHistorical = !!snapshotHeader;

  // 2. Fetch all 16 snapshot tables in parallel
  const { data: snapshotData, isLoading: dataLoading, error: dataError } = useQuery({
    queryKey: ['snapshot-data', diagnosticId],
    queryFn: async () => {
      if (!diagnosticId) return null;

      const [
        usersRes,
        assignmentsRes,
        answerCatsRes,
        gradeSkillsRes,
        gradeQualitiesRes,
        hardCatsRes,
        hardSubcatsRes,
        hardSkillsRes,
        hardQuestionsRes,
        hardOptionsRes,
        softCatsRes,
        softSubcatsRes,
        softSkillsRes,
        softQuestionsRes,
        softOptionsRes,
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

      // Build Maps
      const usersMap = new Map<string, SnapshotUserContext>();
      (usersRes.data || []).forEach((u: any) => {
        usersMap.set(u.entity_id, {
          entityId: u.entity_id,
          lastName: u.last_name,
          firstName: u.first_name,
          middleName: u.middle_name,
          gradeId: u.grade_id,
          gradeName: u.grade_name,
          positionName: u.position_name,
          departmentName: u.department_name,
          positionCategoryName: u.position_category_name,
        });
      });

      const assignmentsMap = new Map<string, SnapshotAssignment>();
      (assignmentsRes.data || []).forEach((a: any) => {
        assignmentsMap.set(a.entity_id, {
          entityId: a.entity_id,
          evaluatingUserId: a.evaluating_user_id,
          assignmentType: a.assignment_type,
          evaluatorLastName: a.evaluator_last_name,
          evaluatorFirstName: a.evaluator_first_name,
          evaluatorPositionCategoryName: a.evaluator_position_category_name,
        });
      });

      const answerCategoriesMap = new Map<string, SnapshotAnswerCategory>();
      (answerCatsRes.data || []).forEach((ac: any) => {
        answerCategoriesMap.set(ac.entity_id, {
          entityId: ac.entity_id,
          name: ac.name,
          questionType: ac.question_type,
          commentRequired: ac.comment_required,
        });
      });

      const gradeSkills: SnapshotGradeSkill[] = (gradeSkillsRes.data || []).map((gs: any) => ({
        entityId: gs.entity_id,
        skillId: gs.skill_id,
        gradeId: gs.grade_id,
        targetLevel: gs.target_level,
      }));

      const gradeQualities: SnapshotGradeQuality[] = (gradeQualitiesRes.data || []).map((gq: any) => ({
        entityId: gq.entity_id,
        qualityId: gq.quality_id,
        gradeId: gq.grade_id,
        targetLevel: gq.target_level,
      }));

      const hardCategoriesMap = new Map<string, SnapshotCategory>();
      (hardCatsRes.data || []).forEach((c: any) => {
        hardCategoriesMap.set(c.entity_id, { entityId: c.entity_id, name: c.name, description: c.description });
      });

      const hardSubcategoriesMap = new Map<string, SnapshotSubcategory>();
      (hardSubcatsRes.data || []).forEach((sc: any) => {
        hardSubcategoriesMap.set(sc.entity_id, {
          entityId: sc.entity_id, name: sc.name, categoryId: sc.category_id, categoryName: sc.category_name,
        });
      });

      const hardSkillsMap = new Map<string, SnapshotSkill>();
      (hardSkillsRes.data || []).forEach((hs: any) => {
        hardSkillsMap.set(hs.entity_id, {
          entityId: hs.entity_id, name: hs.name, description: hs.description,
          categoryId: hs.category_id, categoryName: hs.category_name,
          subCategoryId: hs.sub_category_id, subcategoryName: hs.subcategory_name,
        });
      });

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

      const hardAnswerOptionsMap = new Map<string, SnapshotAnswerOption>();
      (hardOptionsRes.data || []).forEach((o: any) => {
        hardAnswerOptionsMap.set(o.entity_id, {
          entityId: o.entity_id, answerCategoryId: o.answer_category_id,
          numericValue: o.numeric_value, levelValue: o.level_value,
          title: o.title, description: o.description, orderIndex: o.order_index,
        });
      });

      const softCategoriesMap = new Map<string, SnapshotCategory>();
      (softCatsRes.data || []).forEach((c: any) => {
        softCategoriesMap.set(c.entity_id, { entityId: c.entity_id, name: c.name, description: c.description });
      });

      const softSubcategoriesMap = new Map<string, SnapshotSubcategory>();
      (softSubcatsRes.data || []).forEach((sc: any) => {
        softSubcategoriesMap.set(sc.entity_id, {
          entityId: sc.entity_id, name: sc.name, categoryId: sc.category_id, categoryName: sc.category_name,
        });
      });

      const softSkillsMap = new Map<string, SnapshotSkill>();
      (softSkillsRes.data || []).forEach((ss: any) => {
        softSkillsMap.set(ss.entity_id, {
          entityId: ss.entity_id, name: ss.name, description: ss.description,
          categoryId: ss.category_id, categoryName: ss.category_name,
          subCategoryId: ss.sub_category_id, subcategoryName: ss.subcategory_name,
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

      const softAnswerOptionsMap = new Map<string, SnapshotAnswerOption>();
      (softOptionsRes.data || []).forEach((o: any) => {
        softAnswerOptionsMap.set(o.entity_id, {
          entityId: o.entity_id, answerCategoryId: o.answer_category_id,
          numericValue: o.numeric_value, levelValue: o.level_value,
          title: o.title, description: o.description, orderIndex: o.order_index,
        });
      });

      const evaluatedUser = userId ? usersMap.get(userId) || null : null;

      return {
        snapshotId: diagnosticId!,
        isHistorical: true as const,
        evaluatedUser,
        usersMap,
        assignmentsMap,
        hardSkillsMap,
        softSkillsMap,
        hardQuestionsMap,
        softQuestionsMap,
        hardAnswerOptionsMap,
        softAnswerOptionsMap,
        hardCategoriesMap,
        softCategoriesMap,
        hardSubcategoriesMap,
        softSubcategoriesMap,
        gradeSkills,
        gradeQualities,
        answerCategoriesMap,
      } satisfies SnapshotContext;
    },
    enabled: !!diagnosticId,
    staleTime: 5 * 60 * 1000, // Snapshots are immutable, cache for 5 min
  });

  const loading = headerLoading || dataLoading;

  if (!stageId || !userId || !snapshotData) {
    return {
      snapshotContext: null,
      isHistorical,
      loading,
      error: dataError ? String(dataError) : null,
    };
  }

  return {
    snapshotContext: snapshotData,
    isHistorical: true,
    loading,
    error: dataError ? String(dataError) : null,
  };
}
