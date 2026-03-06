import { supabase } from '@/integrations/supabase/client';

type RoleType = 'self' | 'manager' | 'peer';

interface SkillRoleVisibility {
  skillId: string;
  visibleToSelf: boolean;
  visibleToManager: boolean;
  visibleToPeer: boolean;
  assignedToAllRoles: boolean;
}

/**
 * Проверяет, видим ли вопрос для данной роли
 * visibility_restriction_enabled = false -> видим всем
 * visibility_restriction_enabled = true AND visibility_restriction_type != role -> видим данной роли
 */
const isQuestionVisibleToRole = (
  restrictionEnabled: boolean | null,
  restrictionType: string | null,
  role: RoleType
): boolean => {
  if (!restrictionEnabled) {
    return true;
  }
  return restrictionType !== role;
};

/**
 * Получает информацию о видимости hard-навыков для всех ролей
 */
export const getHardSkillsRoleVisibility = async (
  skillIds: string[]
): Promise<Map<string, SkillRoleVisibility>> => {
  const result = new Map<string, SkillRoleVisibility>();

  if (skillIds.length === 0) return result;

  // Инициализируем все навыки как невидимые ни для кого
  skillIds.forEach(skillId => {
    result.set(skillId, {
      skillId,
      visibleToSelf: false,
      visibleToManager: false,
      visibleToPeer: false,
      assignedToAllRoles: false
    });
  });

  // Получаем все вопросы для указанных навыков
  const { data: questions, error } = await supabase
    .from('hard_skill_questions')
    .select('skill_id, visibility_restriction_enabled, visibility_restriction_type')
    .in('skill_id', skillIds);

  if (error) {
    console.error('[getHardSkillsRoleVisibility] Error:', error);
    return result;
  }

  // Анализируем каждый вопрос
  (questions || []).forEach(q => {
    if (!q.skill_id) return;

    const current = result.get(q.skill_id);
    if (!current) return;

    const visibleToSelf = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'self'
    );
    const visibleToManager = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'manager'
    );
    const visibleToPeer = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'peer'
    );

    // Если хотя бы один вопрос виден для роли, навык виден для роли
    result.set(q.skill_id, {
      skillId: q.skill_id,
      visibleToSelf: current.visibleToSelf || visibleToSelf,
      visibleToManager: current.visibleToManager || visibleToManager,
      visibleToPeer: current.visibleToPeer || visibleToPeer,
      assignedToAllRoles: false // будет вычислено ниже
    });
  });

  // Вычисляем assignedToAllRoles для каждого навыка
  result.forEach((visibility, skillId) => {
    result.set(skillId, {
      ...visibility,
      assignedToAllRoles: visibility.visibleToSelf && visibility.visibleToManager && visibility.visibleToPeer
    });
  });

  return result;
};

/**
 * Получает информацию о видимости soft-навыков для всех ролей
 */
export const getSoftSkillsRoleVisibility = async (
  qualityIds: string[]
): Promise<Map<string, SkillRoleVisibility>> => {
  const result = new Map<string, SkillRoleVisibility>();

  if (qualityIds.length === 0) return result;

  // Инициализируем все качества как невидимые ни для кого
  qualityIds.forEach(qualityId => {
    result.set(qualityId, {
      skillId: qualityId,
      visibleToSelf: false,
      visibleToManager: false,
      visibleToPeer: false,
      assignedToAllRoles: false
    });
  });

  // Получаем все вопросы для указанных качеств
  const { data: questions, error } = await supabase
    .from('soft_skill_questions')
    .select('quality_id, visibility_restriction_enabled, visibility_restriction_type')
    .in('quality_id', qualityIds);

  if (error) {
    console.error('[getSoftSkillsRoleVisibility] Error:', error);
    return result;
  }

  // Анализируем каждый вопрос
  (questions || []).forEach(q => {
    if (!q.quality_id) return;

    const current = result.get(q.quality_id);
    if (!current) return;

    const visibleToSelf = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'self'
    );
    const visibleToManager = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'manager'
    );
    const visibleToPeer = isQuestionVisibleToRole(
      q.visibility_restriction_enabled,
      q.visibility_restriction_type,
      'peer'
    );

    // Если хотя бы один вопрос виден для роли, качество видимо для роли
    result.set(q.quality_id, {
      skillId: q.quality_id,
      visibleToSelf: current.visibleToSelf || visibleToSelf,
      visibleToManager: current.visibleToManager || visibleToManager,
      visibleToPeer: current.visibleToPeer || visibleToPeer,
      assignedToAllRoles: false // будет вычислено ниже
    });
  });

  // Вычисляем assignedToAllRoles для каждого качества
  result.forEach((visibility, qualityId) => {
    result.set(qualityId, {
      ...visibility,
      assignedToAllRoles: visibility.visibleToSelf && visibility.visibleToManager && visibility.visibleToPeer
    });
  });

  return result;
};

/**
 * Фильтрует список ID навыков, оставляя только те, что назначены всем ролям
 */
export const filterSkillsAssignedToAllRoles = async (
  skillIds: string[],
  isHardSkills: boolean
): Promise<string[]> => {
  const visibility = isHardSkills
    ? await getHardSkillsRoleVisibility(skillIds)
    : await getSoftSkillsRoleVisibility(skillIds);

  return skillIds.filter(id => visibility.get(id)?.assignedToAllRoles ?? false);
};
