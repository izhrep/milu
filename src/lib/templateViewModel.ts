/**
 * View-model builder: transforms raw DiagnosticConfigTemplate into
 * business-readable summaries for HRBP users.
 *
 * Single source of truth — reuse in list, detail pane, and any other context.
 */

import type { DiagnosticConfigTemplate } from '@/hooks/useDiagnosticConfigTemplates';

export interface TemplateSummary {
  /** "Включены" | "Выключены" */
  hardSkillsLabel: string;
  /** e.g. "5 уровней (0–4), реверс: выкл" or "Не участвует" */
  hardScaleLabel: string;
  /** e.g. "6 уровней (0–5), реверс: вкл" */
  softScaleLabel: string;
  /** e.g. "Обязательны: нет" + extra info */
  commentsLabel: string;
  /** Number of individual overrides in comment_rules */
  commentExceptions: number;
  /** e.g. "Активных: 3, обязательных: 1" */
  openQuestionsLabel: string;
  /** Total open questions count */
  openQuestionsTotal: number;
  /** Required open questions count */
  openQuestionsRequired: number;
  /** Johari rules summary label, e.g. "open ≤20%, grey 20–25%, blind/hidden >25%" */
  johariLabel: string;
  /** Plain-text explanation of what the template controls */
  detailsText: string;
  /** Business-readable explanation of reverse interpretation, or null if no reverse is active */
  reverseExplanation: string | null;
}

function formatScaleLabel(
  min: number,
  max: number,
  reversed: boolean,
): string {
  const levels = max - min + 1;
  const reverseText = reversed ? 'вкл' : 'выкл';
  return `${levels} ${pluralLevels(levels)} (${min}–${max}), реверс: ${reverseText}`;
}

function pluralLevels(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'уровень';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'уровня';
  return 'уровней';
}

function parseCommentRules(rules: Record<string, any>): {
  required: boolean;
  exceptions: number;
} {
  if (!rules || typeof rules !== 'object') {
    return { required: false, exceptions: 0 };
  }

  const required = !!rules.comment_required;
  // Count per-question overrides
  const overrides = rules.overrides;
  const exceptions =
    overrides && typeof overrides === 'object'
      ? Object.keys(overrides).length
      : 0;

  return { required, exceptions };
}

function parseOpenQuestions(config: any[]): {
  total: number;
  required: number;
} {
  if (!Array.isArray(config)) return { total: 0, required: 0 };
  const total = config.length;
  const required = config.filter(
    (q: any) => q && q.is_required === true,
  ).length;
  return { total, required };
}

function formatJohariLabel(rules: Record<string, any> | undefined): string {
  if (!rules || typeof rules !== 'object' || !rules.open_delta_pct) {
    return 'Не настроены';
  }
  const openPct = Math.round((rules.open_delta_pct as number) * 100);
  const bhPct = Math.round((rules.blind_hidden_delta_pct as number) * 100);
  return `Открытая зона ≤${openPct}%, Серая зона ${openPct}–${bhPct}%, Слепая/Скрытая зона >${bhPct}%`;
}

export function buildTemplateSummary(
  tpl: DiagnosticConfigTemplate,
): TemplateSummary {
  // Hard skills
  const hardSkillsLabel = tpl.hard_skills_enabled ? 'Включены' : 'Выключены';
  const hardScaleLabel = tpl.hard_skills_enabled
    ? formatScaleLabel(tpl.hard_scale_min, tpl.hard_scale_max, tpl.hard_scale_reversed)
    : 'Не участвует';

  // Soft skills
  const softScaleLabel = formatScaleLabel(
    tpl.soft_scale_min,
    tpl.soft_scale_max,
    tpl.soft_scale_reversed,
  );

  // Comments
  const { required, exceptions } = parseCommentRules(
    tpl.comment_rules as Record<string, any>,
  );
  const commentsLabel = `Обязательны: ${required ? 'да' : 'нет'}`;
  const commentExceptions = exceptions;

  // Open questions
  const oq = parseOpenQuestions(tpl.open_questions_config as any[]);
  const openQuestionsLabel =
    oq.total > 0
      ? `Активных: ${oq.total}, обязательных: ${oq.required}`
      : 'Нет';

  // Johari
  const johariLabel = formatJohariLabel(tpl.johari_rules as Record<string, any>);

  // Details text
  const detailsText =
    'Этот шаблон определяет правила оценки, которые будут применены при создании нового этапа диагностики. ' +
    'При активации этапа конфигурация фиксируется и не может быть изменена, чтобы обеспечить целостность результатов.';

  // Reverse explanation for business users
  const hardReversed = tpl.hard_skills_enabled && tpl.hard_scale_reversed;
  const softReversed = tpl.soft_scale_reversed;
  let reverseExplanation: string | null = null;

  if (hardReversed || softReversed) {
    const parts: string[] = [];
    if (hardReversed) {
      const effMin = tpl.hard_scale_min + tpl.hard_scale_max - tpl.hard_scale_max; // = min
      const effMax = tpl.hard_scale_min + tpl.hard_scale_max - tpl.hard_scale_min; // = max
      parts.push(
        `Hard-навыки: респондент ставит балл ${tpl.hard_scale_max} как максимальный, но в аналитике это будет интерпретировано как ${effMin} (минимум). ` +
        `Формула: итоговый балл = ${tpl.hard_scale_min} + ${tpl.hard_scale_max} − ответ.`
      );
    }
    if (softReversed) {
      parts.push(
        `Soft-навыки: респондент ставит балл ${tpl.soft_scale_max} как максимальный, но в аналитике это будет интерпретировано как ${tpl.soft_scale_min} (минимум). ` +
        `Формула: итоговый балл = ${tpl.soft_scale_min} + ${tpl.soft_scale_max} − ответ.`
      );
    }
    reverseExplanation = parts.join(' ');
  }

  return {
    hardSkillsLabel,
    hardScaleLabel,
    softScaleLabel,
    commentsLabel,
    commentExceptions,
    openQuestionsLabel,
    openQuestionsTotal: oq.total,
    openQuestionsRequired: oq.required,
    johariLabel,
    detailsText,
    reverseExplanation,
  };
}
