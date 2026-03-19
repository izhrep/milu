import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HARD_SKILLS_MAX_LEVEL, SOFT_SKILLS_MAX_LEVEL } from '@/lib/scoreLabels';

export interface JohariRules {
  applies_to?: string;
  open_delta_pct: number;
  blind_hidden_delta_pct: number;
  borderline_rounding_enabled: boolean;
  borderline_threshold_delta: number;
  borderline_round_down_to: number;
  borderline_round_up_to: number;
}

export interface StageTemplateConfig {
  templateId: string | null;
  templateName: string | null;
  hardScaleMin: number;
  hardScaleMax: number;
  softScaleMin: number;
  softScaleMax: number;
  hardScaleReversed: boolean;
  softScaleReversed: boolean;
  hardSkillsEnabled: boolean;
  scaleLabels: {
    hard: Array<{ level_value: number; label_text: string }>;
    soft: Array<{ level_value: number; label_text: string }>;
  };
  commentRules: Record<string, any>;
  openQuestions: any[];
  johariRules: JohariRules | null;
  isLegacy: boolean;
}

const LEGACY_DEFAULTS: StageTemplateConfig = {
  templateId: null,
  templateName: null,
  hardScaleMin: 0,
  hardScaleMax: HARD_SKILLS_MAX_LEVEL,
  softScaleMin: 0,
  softScaleMax: SOFT_SKILLS_MAX_LEVEL,
  hardScaleReversed: false,
  softScaleReversed: false,
  hardSkillsEnabled: true,
  scaleLabels: { hard: [], soft: [] },
  commentRules: {},
  openQuestions: [],
  johariRules: null,
  isLegacy: true,
};

/** Parse frozen_config JSONB into StageTemplateConfig */
function parseJohariRules(raw: any): JohariRules | null {
  if (!raw || typeof raw !== 'object' || !raw.open_delta_pct) return null;
  return {
    applies_to: raw.applies_to ?? 'soft',
    open_delta_pct: raw.open_delta_pct,
    blind_hidden_delta_pct: raw.blind_hidden_delta_pct,
    borderline_rounding_enabled: raw.borderline_rounding_enabled ?? false,
    borderline_threshold_delta: raw.borderline_threshold_delta ?? 0,
    borderline_round_down_to: raw.borderline_round_down_to ?? 0,
    borderline_round_up_to: raw.borderline_round_up_to ?? 0,
  };
}

function parseFrozenConfig(frozen: any): StageTemplateConfig {
  return {
    templateId: frozen.template_id || null,
    templateName: frozen.template_name || null,
    hardScaleMin: frozen.hard_scale_min ?? 0,
    hardScaleMax: frozen.hard_scale_max ?? HARD_SKILLS_MAX_LEVEL,
    softScaleMin: frozen.soft_scale_min ?? 0,
    softScaleMax: frozen.soft_scale_max ?? SOFT_SKILLS_MAX_LEVEL,
    hardScaleReversed: frozen.hard_scale_reversed ?? false,
    softScaleReversed: frozen.soft_scale_reversed ?? false,
    hardSkillsEnabled: frozen.hard_skills_enabled ?? true,
    scaleLabels: frozen.scale_labels ?? { hard: [], soft: [] },
    commentRules: frozen.comment_rules ?? {},
    openQuestions: frozen.open_questions ?? [],
    johariRules: parseJohariRules(frozen.johari_rules),
    isLegacy: false,
  };
}

/** Parse live template + labels into StageTemplateConfig */
function parseLiveTemplate(template: any, labels: any[]): StageTemplateConfig {
  const hardLabels = labels
    .filter((l: any) => l.skill_type === 'hard')
    .sort((a: any, b: any) => a.level_value - b.level_value)
    .map((l: any) => ({ level_value: l.level_value, label_text: l.label_text }));
  const softLabels = labels
    .filter((l: any) => l.skill_type === 'soft')
    .sort((a: any, b: any) => a.level_value - b.level_value)
    .map((l: any) => ({ level_value: l.level_value, label_text: l.label_text }));

  return {
    templateId: template.id,
    templateName: template.name,
    hardScaleMin: template.hard_scale_min,
    hardScaleMax: template.hard_scale_max,
    softScaleMin: template.soft_scale_min,
    softScaleMax: template.soft_scale_max,
    hardScaleReversed: template.hard_scale_reversed,
    softScaleReversed: template.soft_scale_reversed,
    hardSkillsEnabled: template.hard_skills_enabled,
    scaleLabels: { hard: hardLabels, soft: softLabels },
    commentRules: template.comment_rules ?? {},
    openQuestions: template.open_questions_config ?? [],
    johariRules: parseJohariRules(template.johari_rules),
    isLegacy: false,
  };
}

/**
 * Resolution chain: frozen_config → live template → legacy defaults.
 * Use this hook wherever scale/config info is needed for a diagnostic stage.
 */
export const useStageTemplateConfig = (stageId?: string) => {
  const [config, setConfig] = useState<StageTemplateConfig>(LEGACY_DEFAULTS);
  // Track which stageId was last resolved to derive loading synchronously
  const [resolvedForStageId, setResolvedForStageId] = useState<string | undefined>(undefined);

  // Loading is true when stageId is provided but config hasn't been resolved for it yet
  const loading = !!stageId && stageId !== resolvedForStageId;

  const resolve = useCallback(async () => {
    if (!stageId) {
      setConfig(LEGACY_DEFAULTS);
      setResolvedForStageId(undefined);
      return;
    }

    try {
      // Fetch stage with template columns
      const { data: stage, error } = await supabase
        .from('diagnostic_stages')
        .select('frozen_config, config_template_id')
        .eq('id', stageId)
        .single();

      if (error) throw error;

      const frozenConfig = (stage as any)?.frozen_config;
      const configTemplateId = (stage as any)?.config_template_id;

      // Priority 1: frozen_config
      if (frozenConfig && typeof frozenConfig === 'object') {
        setConfig(parseFrozenConfig(frozenConfig));
        setResolvedForStageId(stageId);
        return;
      }

      // Priority 2: live template
      if (configTemplateId) {
        const [{ data: template }, { data: labels }] = await Promise.all([
          supabase
            .from('diagnostic_config_templates' as any)
            .select('*')
            .eq('id', configTemplateId)
            .single(),
          supabase
            .from('template_scale_labels' as any)
            .select('*')
            .eq('template_id', configTemplateId)
            .order('level_value', { ascending: true }),
        ]);

        if (template) {
          setConfig(parseLiveTemplate(template, (labels as any[]) || []));
          setResolvedForStageId(stageId);
          return;
        }
      }

      // Priority 3: legacy defaults
      setConfig(LEGACY_DEFAULTS);
      setResolvedForStageId(stageId);
    } catch (err) {
      console.error('Error resolving stage template config:', err);
      setConfig(LEGACY_DEFAULTS);
      setResolvedForStageId(stageId);
    }
  }, [stageId]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  /** Calculate effective score with optional reverse */
  const getEffectiveScore = useCallback((raw: number, skillType: 'hard' | 'soft'): number => {
    const reversed = skillType === 'hard' ? config.hardScaleReversed : config.softScaleReversed;
    if (!reversed) return raw;
    const min = skillType === 'hard' ? config.hardScaleMin : config.softScaleMin;
    const max = skillType === 'hard' ? config.hardScaleMax : config.softScaleMax;
    return max + min - raw;
  }, [config]);

  /** Get label text for a given level value */
  const getLabelText = useCallback((level: number, skillType: 'hard' | 'soft'): string | undefined => {
    const labelsList = skillType === 'hard' ? config.scaleLabels.hard : config.scaleLabels.soft;
    return labelsList.find(l => l.level_value === level)?.label_text;
  }, [config]);

  return {
    config,
    loading,
    refetch: resolve,
    getEffectiveScore,
    getLabelText,
    isLegacy: config.isLegacy,
  };
};
