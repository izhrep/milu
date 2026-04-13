import { describe, it, expect } from 'vitest';
import { buildTemplateSummary } from './templateViewModel';
import type { DiagnosticConfigTemplate } from '@/hooks/useDiagnosticConfigTemplates';

function makeTemplate(overrides: Partial<DiagnosticConfigTemplate> = {}): DiagnosticConfigTemplate {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    version: 1,
    status: 'draft',
    description: null,
    hard_scale_min: 0,
    hard_scale_max: 4,
    soft_scale_min: 0,
    soft_scale_max: 5,
    hard_scale_reversed: false,
    soft_scale_reversed: false,
    hard_skills_enabled: true,
    comment_rules: {},
    open_questions_config: [],
    johari_rules: {},
    created_at: '',
    updated_at: '',
    created_by: null,
    ...overrides,
  };
}

describe('buildTemplateSummary', () => {
  it('hard skills enabled → shows scale info', () => {
    const summary = buildTemplateSummary(makeTemplate());
    expect(summary.hardSkillsLabel).toBe('Включены');
    expect(summary.hardScaleLabel).toContain('5 уровней');
    expect(summary.hardScaleLabel).toContain('0–4');
    expect(summary.hardScaleLabel).toContain('реверс: выкл');
  });

  it('hard skills disabled → "Не участвует"', () => {
    const summary = buildTemplateSummary(makeTemplate({ hard_skills_enabled: false }));
    expect(summary.hardSkillsLabel).toBe('Выключены');
    expect(summary.hardScaleLabel).toBe('Не участвует');
  });

  it('soft scale label shows correct info', () => {
    const summary = buildTemplateSummary(makeTemplate({
      soft_scale_min: 1,
      soft_scale_max: 3,
      soft_scale_reversed: true,
    }));
    expect(summary.softScaleLabel).toContain('3 уровня');
    expect(summary.softScaleLabel).toContain('1–3');
    expect(summary.softScaleLabel).toContain('реверс: вкл');
  });

  it('johari label formats percentages correctly', () => {
    const summary = buildTemplateSummary(makeTemplate({
      johari_rules: {
        open_delta_pct: 0.20,
        blind_hidden_delta_pct: 0.25,
      },
    }));
    expect(summary.johariLabel).toContain('≤20%');
    expect(summary.johariLabel).toContain('20–25%');
    expect(summary.johariLabel).toContain('>25%');
  });

  it('no johari rules → "Не настроены"', () => {
    const summary = buildTemplateSummary(makeTemplate({ johari_rules: {} }));
    expect(summary.johariLabel).toBe('Не настроены');
  });

  it('empty comment rules → not required, 0 exceptions', () => {
    const summary = buildTemplateSummary(makeTemplate({ comment_rules: {} }));
    expect(summary.commentsLabel).toBe('Обязательны: нет');
    expect(summary.commentExceptions).toBe(0);
  });

  it('comment rules with required + overrides', () => {
    const summary = buildTemplateSummary(makeTemplate({
      comment_rules: {
        comment_required: true,
        overrides: { 'q-1': false, 'q-2': false },
      },
    }));
    expect(summary.commentsLabel).toBe('Обязательны: да');
    expect(summary.commentExceptions).toBe(2);
  });

  it('open questions count', () => {
    const summary = buildTemplateSummary(makeTemplate({
      open_questions_config: [
        { text: 'Q1', is_required: true },
        { text: 'Q2', is_required: false },
        { text: 'Q3', is_required: true },
      ],
    }));
    expect(summary.openQuestionsTotal).toBe(3);
    expect(summary.openQuestionsRequired).toBe(2);
    expect(summary.openQuestionsLabel).toContain('Активных: 3');
    expect(summary.openQuestionsLabel).toContain('обязательных: 2');
  });

  it('no open questions → "Нет"', () => {
    const summary = buildTemplateSummary(makeTemplate({ open_questions_config: [] }));
    expect(summary.openQuestionsLabel).toBe('Нет');
  });

  it('reverse explanation is null when no reverse', () => {
    const summary = buildTemplateSummary(makeTemplate());
    expect(summary.reverseExplanation).toBeNull();
  });

  it('reverse explanation present when soft reversed', () => {
    const summary = buildTemplateSummary(makeTemplate({ soft_scale_reversed: true }));
    expect(summary.reverseExplanation).not.toBeNull();
    expect(summary.reverseExplanation).toContain('Soft-навыки');
    expect(summary.reverseExplanation).toContain('Формула');
  });

  it('reverse explanation includes both when both reversed', () => {
    const summary = buildTemplateSummary(makeTemplate({
      hard_skills_enabled: true,
      hard_scale_reversed: true,
      soft_scale_reversed: true,
    }));
    expect(summary.reverseExplanation).toContain('Hard-навыки');
    expect(summary.reverseExplanation).toContain('Soft-навыки');
  });

  it('pluralizes "уровень" correctly', () => {
    // 1 level → уровень (edge case: min=max not realistic but tests plural)
    const s2 = buildTemplateSummary(makeTemplate({ soft_scale_min: 0, soft_scale_max: 1 }));
    expect(s2.softScaleLabel).toContain('2 уровня');

    const s6 = buildTemplateSummary(makeTemplate({ soft_scale_min: 0, soft_scale_max: 5 }));
    expect(s6.softScaleLabel).toContain('6 уровней');

    const s11 = buildTemplateSummary(makeTemplate({ soft_scale_min: 0, soft_scale_max: 10 }));
    expect(s11.softScaleLabel).toContain('11 уровней');

    const s21 = buildTemplateSummary(makeTemplate({ soft_scale_min: 0, soft_scale_max: 20 }));
    expect(s21.softScaleLabel).toContain('21 уровень');
  });
});
