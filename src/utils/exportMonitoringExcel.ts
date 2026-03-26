import { supabase } from '@/integrations/supabase/client';
import { getFullName } from '@/hooks/useUsers';
import { loadSnapshotForStage } from '@/utils/loadSnapshotForStage';
import type { SnapshotContext } from '@/hooks/useSnapshotContext';
import type { User } from '@/hooks/useUsers';

interface ExportRow {
  'Оцениваемый': string;
  'Оценивающий': string;
  'Роль оценщика': string;
  'Дата и время': string;
  'Тип компетенции': string;
  'Категория': string;
  'Подкатегория': string;
  'Компетенция': string;
  'Вопрос': string;
  'Ответ': string;
  'Балл': number | string;
  'Комментарий': string;
  'Анонимно': string;
}

// ── Resolve evaluator display name ──────────────────────────
function resolveEvaluatorName(
  evaluatingUserId: string | null,
  snapshot: SnapshotContext | null,
  liveUsers: User[],
): string {
  if (!evaluatingUserId) return 'Не указано';
  if (snapshot) {
    const su = snapshot.usersMap.get(evaluatingUserId);
    if (su) return [su.lastName, su.firstName, su.middleName].filter(Boolean).join(' ') || 'Не указано';
  }
  const u = liveUsers.find(u => u.id === evaluatingUserId);
  return getFullName(u) || 'Не указано';
}

// ── Resolve evaluator role via snapshot assignments or fallback ──
function resolveEvaluatorRole(
  participantUserId: string,
  evaluatingUserId: string | null,
  snapshot: SnapshotContext | null,
): string {
  if (!evaluatingUserId) return 'Коллега';
  if (participantUserId === evaluatingUserId) return 'Самооценка';

  if (snapshot) {
    for (const [, a] of snapshot.assignmentsMap) {
      if (a.evaluatingUserId === evaluatingUserId) {
        if (a.assignmentType === 'self') return 'Самооценка';
        if (a.assignmentType === 'manager') return 'Руководитель';
        return 'Коллега';
      }
    }
  }
  return 'Коллега';
}

// ── Resolve answer title from snapshot answer options map ──
function resolveAnswerTitle(
  rawValue: number | null,
  answerCategoryId: string | null,
  optionsMap: SnapshotContext['hardAnswerOptionsMap'],
): string {
  if (rawValue == null || !answerCategoryId) return 'Не указано';
  for (const [, opt] of optionsMap) {
    if (opt.answerCategoryId === answerCategoryId && opt.numericValue === rawValue) {
      return opt.title;
    }
  }
  return 'Не указано';
}

// ── Build rows for a single participant in SNAPSHOT mode ──
async function buildSnapshotRows(
  participantUserId: string,
  participantName: string,
  stageId: string,
  snapshot: SnapshotContext,
  liveUsers: User[],
): Promise<ExportRow[]> {
  const [hardRes, softRes] = await Promise.all([
    supabase
      .from('hard_skill_results')
      .select('question_id, raw_numeric_value, evaluating_user_id, created_at, comment, is_anonymous_comment, is_skip')
      .eq('evaluated_user_id', participantUserId)
      .eq('diagnostic_stage_id', stageId),
    supabase
      .from('soft_skill_results')
      .select('question_id, raw_numeric_value, evaluating_user_id, created_at, comment, is_anonymous_comment, is_skip')
      .eq('evaluated_user_id', participantUserId)
      .eq('diagnostic_stage_id', stageId),
  ]);

  const rows: ExportRow[] = [];

  for (const r of hardRes.data || []) {
    const q = snapshot.hardQuestionsMap.get(r.question_id);
    const skill = q?.skillId ? snapshot.hardSkillsMap.get(q.skillId) : null;
    const isSkipped = r.is_skip === true;

    rows.push({
      'Оцениваемый': participantName,
      'Оценивающий': resolveEvaluatorName(r.evaluating_user_id, snapshot, liveUsers),
      'Роль оценщика': resolveEvaluatorRole(participantUserId, r.evaluating_user_id, snapshot),
      'Дата и время': r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : 'Не указано',
      'Тип компетенции': 'Навык',
      'Категория': skill?.categoryName || 'Без категории',
      'Подкатегория': skill?.subcategoryName || '',
      'Компетенция': skill?.name || 'Не указано',
      'Вопрос': q?.questionText || 'Не указано',
      'Ответ': isSkipped ? 'Не могу ответить' : resolveAnswerTitle(r.raw_numeric_value, q?.answerCategoryId ?? null, snapshot.hardAnswerOptionsMap),
      'Балл': isSkipped ? '' : (r.raw_numeric_value ?? 0),
      'Комментарий': r.comment || '',
      'Анонимно': r.is_anonymous_comment ? 'Да' : 'Нет',
    });
  }

  for (const r of softRes.data || []) {
    const q = snapshot.softQuestionsMap.get(r.question_id);
    const quality = q?.qualityId ? snapshot.softSkillsMap.get(q.qualityId) : null;
    const isSkipped = r.is_skip === true;

    rows.push({
      'Оцениваемый': participantName,
      'Оценивающий': resolveEvaluatorName(r.evaluating_user_id, snapshot, liveUsers),
      'Роль оценщика': resolveEvaluatorRole(participantUserId, r.evaluating_user_id, snapshot),
      'Дата и время': r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : 'Не указано',
      'Тип компетенции': 'Качество',
      'Категория': quality?.categoryName || 'Без категории',
      'Подкатегория': quality?.subcategoryName || '',
      'Компетенция': quality?.name || 'Не указано',
      'Вопрос': q?.questionText || 'Не указано',
      'Ответ': isSkipped ? 'Не могу ответить' : resolveAnswerTitle(r.raw_numeric_value, q?.answerCategoryId ?? null, snapshot.softAnswerOptionsMap),
      'Балл': isSkipped ? '' : (r.raw_numeric_value ?? 0),
      'Комментарий': r.comment || '',
      'Анонимно': r.is_anonymous_comment ? 'Да' : 'Нет',
    });
  }

  return rows;
}

// ── Build rows for a single participant in LIVE mode ──
async function buildLiveRows(
  participantUserId: string,
  participantName: string,
  stageId: string,
  liveUsers: User[],
): Promise<ExportRow[]> {
  const [hardRes, softRes] = await Promise.all([
    supabase
      .from('hard_skill_results')
      .select(`
        question_id, answer_option_id, raw_numeric_value, evaluating_user_id,
        created_at, comment, is_anonymous_comment, is_skip,
        hard_skill_questions!inner (
          question_text, skill_id,
          hard_skills!inner ( name, sub_category_id,
            category_hard_skills ( name )
          )
        ),
        hard_skill_answer_options ( title, numeric_value )
      `)
      .eq('evaluated_user_id', participantUserId)
      .eq('diagnostic_stage_id', stageId),
    supabase
      .from('soft_skill_results')
      .select(`
        question_id, answer_option_id, raw_numeric_value, evaluating_user_id,
        created_at, comment, is_anonymous_comment, is_skip,
        soft_skill_questions!inner (
          question_text, quality_id,
          soft_skills!soft_skill_questions_soft_skill_id_fkey (
            name, sub_category_id,
            category_soft_skills ( name )
          )
        ),
        soft_skill_answer_options ( title, numeric_value )
      `)
      .eq('evaluated_user_id', participantUserId)
      .eq('diagnostic_stage_id', stageId),
  ]);

  const rows: ExportRow[] = [];

  for (const result of hardRes.data || []) {
    const question = result.hard_skill_questions as any;
    const answer = result.hard_skill_answer_options as any;
    const skill = question?.hard_skills as any;
    const isSkipped = (result as any).is_skip === true;
    const evaluatingUser = liveUsers.find(u => u.id === result.evaluating_user_id);
    const isSelf = participantUserId === result.evaluating_user_id;

    rows.push({
      'Оцениваемый': participantName,
      'Оценивающий': getFullName(evaluatingUser) || 'Не указано',
      'Роль оценщика': isSelf ? 'Самооценка' : 'Коллега',
      'Дата и время': result.created_at ? new Date(result.created_at).toLocaleString('ru-RU') : 'Не указано',
      'Тип компетенции': 'Навык',
      'Категория': skill?.category_hard_skills?.name || 'Без категории',
      'Подкатегория': '',
      'Компетенция': skill?.name || 'Не указано',
      'Вопрос': question?.question_text || 'Не указано',
      'Ответ': isSkipped ? 'Не могу ответить' : (answer?.title || 'Не указано'),
      'Балл': isSkipped ? '' : (result.raw_numeric_value ?? answer?.numeric_value ?? 0),
      'Комментарий': result.comment || '',
      'Анонимно': result.is_anonymous_comment ? 'Да' : 'Нет',
    });
  }

  for (const result of softRes.data || []) {
    const question = result.soft_skill_questions as any;
    const answer = result.soft_skill_answer_options as any;
    const quality = question?.soft_skills as any;
    const isSkipped = (result as any).is_skip === true;
    const evaluatingUser = liveUsers.find(u => u.id === result.evaluating_user_id);
    const isSelf = participantUserId === result.evaluating_user_id;

    rows.push({
      'Оцениваемый': participantName,
      'Оценивающий': getFullName(evaluatingUser) || 'Не указано',
      'Роль оценщика': isSelf ? 'Самооценка' : 'Коллега',
      'Дата и время': result.created_at ? new Date(result.created_at).toLocaleString('ru-RU') : 'Не указано',
      'Тип компетенции': 'Качество',
      'Категория': quality?.category_soft_skills?.name || 'Без категории',
      'Подкатегория': '',
      'Компетенция': quality?.name || 'Не указано',
      'Вопрос': question?.question_text || 'Не указано',
      'Ответ': isSkipped ? 'Не могу ответить' : (answer?.title || 'Не указано'),
      'Балл': isSkipped ? '' : (result.raw_numeric_value ?? answer?.numeric_value ?? 0),
      'Комментарий': result.comment || '',
      'Анонимно': result.is_anonymous_comment ? 'Да' : 'Нет',
    });
  }

  return rows;
}

// ── Main export function ────────────────────────────────────
export async function exportMonitoringExcel(
  stageId: string,
  participantUserIds: string[],
  liveUsers: User[],
  periodLabel: string,
): Promise<ExportRow[]> {
  // Step 1: resolve snapshot/live mode FIRST
  const snapshot = await loadSnapshotForStage(stageId);

  const allRows: ExportRow[] = [];

  for (const uid of participantUserIds) {
    // Resolve participant name: prefer snapshot, fallback to live
    let participantName: string;
    if (snapshot) {
      const su = snapshot.usersMap.get(uid);
      participantName = su
        ? [su.lastName, su.firstName, su.middleName].filter(Boolean).join(' ') || 'Не указано'
        : getFullName(liveUsers.find(u => u.id === uid)) || 'Не указано';
    } else {
      participantName = getFullName(liveUsers.find(u => u.id === uid)) || 'Не указано';
    }

    const rows = snapshot
      ? await buildSnapshotRows(uid, participantName, stageId, snapshot, liveUsers)
      : await buildLiveRows(uid, participantName, stageId, liveUsers);

    allRows.push(...rows);
  }

  return allRows;
}
