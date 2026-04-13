import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  DiagnosticConfigTemplateRow,
  DiagnosticConfigTemplateInsert,
  DiagnosticConfigTemplateUpdate,
  DiagnosticConfigTemplateStatus,
  TemplateScaleLabelRow,
  TemplateScaleLabelInsert,
} from '@/integrations/supabase/types-extensions';

// Re-export row types so consumers don't need to import from two places
export type DiagnosticConfigTemplate = DiagnosticConfigTemplateRow;
export type TemplateScaleLabel = TemplateScaleLabelRow;

export interface CreateTemplateInput {
  name: string;
  description?: string;
  hard_scale_min?: number;
  hard_scale_max?: number;
  soft_scale_min?: number;
  soft_scale_max?: number;
  hard_scale_reversed?: boolean;
  soft_scale_reversed?: boolean;
  hard_skills_enabled?: boolean;
  comment_rules?: Record<string, unknown>;
  open_questions_config?: unknown[];
  johari_rules?: Record<string, unknown>;
}

/** Client-side approval validation — checks template params only.
 *  Label coverage is validated in "Questions & Answers" context. */
export function validateTemplateForApproval(
  template: DiagnosticConfigTemplate,
): string[] {
  const errors: string[] = [];

  if (template.hard_skills_enabled) {
    if (template.hard_scale_min < 0 || template.hard_scale_max <= template.hard_scale_min) {
      errors.push(`Hard: некорректный диапазон [${template.hard_scale_min}..${template.hard_scale_max}]`);
    }
  }

  if (template.soft_scale_min < 0 || template.soft_scale_max <= template.soft_scale_min) {
    errors.push(`Soft: некорректный диапазон [${template.soft_scale_min}..${template.soft_scale_max}]`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Helpers to cast Supabase generic responses to our narrowed types.
// The generated SDK returns `string` for `status` / `skill_type` columns;
// we know the DB CHECK constraints guarantee narrower values.
// ---------------------------------------------------------------------------

function toTemplateRow(row: Record<string, unknown>): DiagnosticConfigTemplateRow {
  return row as unknown as DiagnosticConfigTemplateRow;
}

function toTemplateRows(rows: Record<string, unknown>[]): DiagnosticConfigTemplateRow[] {
  return rows.map(toTemplateRow);
}

function toLabelRows(rows: Record<string, unknown>[]): TemplateScaleLabelRow[] {
  return rows as unknown as TemplateScaleLabelRow[];
}

export const useDiagnosticConfigTemplates = () => {
  const [templates, setTemplates] = useState<DiagnosticConfigTemplateRow[]>([]);
  const [labels, setLabels] = useState<TemplateScaleLabelRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnostic_config_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTemplates(data ? toTemplateRows(data) : []);
    } catch (err: unknown) {
      console.error('Error fetching templates:', err);
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLabels = useCallback(async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('template_scale_labels')
        .select('*')
        .eq('template_id', templateId)
        .order('level_value', { ascending: true });
      if (error) throw error;
      const typed = data ? toLabelRows(data) : [];
      setLabels(typed);
      return typed;
    } catch (err: unknown) {
      console.error('Error fetching labels:', err);
      toast.error('Ошибка загрузки лейблов шкалы');
      return [];
    }
  }, []);

  const createTemplate = useCallback(async (input: CreateTemplateInput, userId: string) => {
    try {
      const payload: DiagnosticConfigTemplateInsert = {
        name: input.name,
        description: input.description,
        hard_scale_min: input.hard_scale_min,
        hard_scale_max: input.hard_scale_max,
        soft_scale_min: input.soft_scale_min,
        soft_scale_max: input.soft_scale_max,
        hard_scale_reversed: input.hard_scale_reversed,
        soft_scale_reversed: input.soft_scale_reversed,
        hard_skills_enabled: input.hard_skills_enabled,
        comment_rules: input.comment_rules ? JSON.parse(JSON.stringify(input.comment_rules)) : undefined,
        open_questions_config: input.open_questions_config ? JSON.parse(JSON.stringify(input.open_questions_config)) : undefined,
        johari_rules: input.johari_rules ? JSON.parse(JSON.stringify(input.johari_rules)) : undefined,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('diagnostic_config_templates')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      toast.success('Шаблон создан');
      await fetchTemplates();
      return data ? toTemplateRow(data) : null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка создания шаблона';
      console.error('Error creating template:', err);
      toast.error(message);
      return null;
    }
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CreateTemplateInput>) => {
    try {
      const payload: DiagnosticConfigTemplateUpdate = {
        name: updates.name,
        description: updates.description,
        hard_scale_min: updates.hard_scale_min,
        hard_scale_max: updates.hard_scale_max,
        soft_scale_min: updates.soft_scale_min,
        soft_scale_max: updates.soft_scale_max,
        hard_scale_reversed: updates.hard_scale_reversed,
        soft_scale_reversed: updates.soft_scale_reversed,
        hard_skills_enabled: updates.hard_skills_enabled,
        comment_rules: updates.comment_rules ? JSON.parse(JSON.stringify(updates.comment_rules)) : undefined,
        open_questions_config: updates.open_questions_config ? JSON.parse(JSON.stringify(updates.open_questions_config)) : undefined,
        johari_rules: updates.johari_rules ? JSON.parse(JSON.stringify(updates.johari_rules)) : undefined,
      };

      const { error } = await supabase
        .from('diagnostic_config_templates')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон обновлён');
      await fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления шаблона';
      console.error('Error updating template:', err);
      toast.error(message);
    }
  }, [fetchTemplates]);

  const approveTemplate = useCallback(async (id: string) => {
    let tpl = templates.find(t => t.id === id);
    if (!tpl) {
      const { data, error: fetchErr } = await supabase
        .from('diagnostic_config_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !data) {
        toast.error('Шаблон не найден');
        return false;
      }
      tpl = toTemplateRow(data);
    }

    const errors = validateTemplateForApproval(tpl);
    if (errors.length > 0) {
      errors.forEach(e => toast.error(e));
      return false;
    }

    try {
      const statusUpdate: DiagnosticConfigTemplateUpdate = { status: 'approved' as DiagnosticConfigTemplateStatus };
      const { error } = await supabase
        .from('diagnostic_config_templates')
        .update(statusUpdate)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон утверждён');
      await fetchTemplates();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка утверждения шаблона';
      console.error('Error approving template:', err);
      toast.error(message);
      return false;
    }
  }, [templates, fetchTemplates]);

  const archiveTemplate = useCallback(async (id: string) => {
    try {
      const statusUpdate: DiagnosticConfigTemplateUpdate = { status: 'archived' as DiagnosticConfigTemplateStatus };
      const { error } = await supabase
        .from('diagnostic_config_templates')
        .update(statusUpdate)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон архивирован');
      await fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка архивирования';
      console.error('Error archiving template:', err);
      toast.error(message);
    }
  }, [fetchTemplates]);

  const upsertLabel = useCallback(async (label: Omit<TemplateScaleLabelInsert, 'id'> & { id?: string }) => {
    try {
      const { error } = await supabase
        .from('template_scale_labels')
        .upsert(label, { onConflict: 'template_id,skill_type,level_value' });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения лейбла';
      console.error('Error upserting label:', err);
      toast.error(message);
    }
  }, []);

  const deleteLabel = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('template_scale_labels')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка удаления лейбла';
      console.error('Error deleting label:', err);
      toast.error(message);
    }
  }, []);

  /**
   * Fetch coverage analysis for a template.
   *
   * SCOPED FALLBACK: There is no direct FK between answer_categories and
   * diagnostic_config_templates. We check ALL non-archived answer_categories
   * whose question_type matches (hard → hard_skill_answer_options, soft →
   * soft_skill_answer_options) against the template's scale range. This is
   * the best available approximation until a direct link is added.
   */
  const fetchTemplateCoverage = useCallback(async (templateId: string) => {
    // 1. Get the template
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return null;

    // 2. Get answer categories (hard + soft)
    const { data: cats, error: catsErr } = await supabase
      .from('answer_categories')
      .select('id, name, question_type');
    if (catsErr || !cats) return null;

    type CategoryCoverage = {
      categoryId: string;
      categoryName: string;
      skillType: 'hard' | 'soft';
      requiredLevels: number[];
      existingLevels: number[];
      missingLevels: number[];
      extraLevels: number[];
      isComplete: boolean;
    };

    const results: CategoryCoverage[] = [];

    // Helper to build required range
    const buildRange = (min: number, max: number) => {
      const r: number[] = [];
      for (let i = min; i <= max; i++) r.push(i);
      return r;
    };

    // 3. For each skill type, fetch options and compute coverage
    const processType = async (
      skillType: 'hard' | 'soft',
      table: 'hard_skill_answer_options' | 'soft_skill_answer_options',
      scaleMin: number,
      scaleMax: number,
      enabled: boolean,
    ) => {
      if (!enabled) return;
      const relevantCats = cats.filter(c =>
        c.question_type === skillType || c.question_type === 'both'
      );
      if (relevantCats.length === 0) return;

      const catIds = relevantCats.map(c => c.id);
      const { data: opts, error: optsErr } = await supabase
        .from(table)
        .select('answer_category_id, level_value')
        .in('answer_category_id', catIds);
      if (optsErr || !opts) return;

      const requiredLevels = buildRange(scaleMin, scaleMax);

      for (const cat of relevantCats) {
        const catOpts = opts.filter(o => o.answer_category_id === cat.id);
        const existing = [...new Set(catOpts.map(o => o.level_value))].sort((a, b) => a - b);
        const existingSet = new Set(existing);
        const missing = requiredLevels.filter(l => !existingSet.has(l));
        const extra = existing.filter(l => l < scaleMin || l > scaleMax);

        results.push({
          categoryId: cat.id,
          categoryName: cat.name,
          skillType,
          requiredLevels,
          existingLevels: existing,
          missingLevels: missing,
          extraLevels: extra,
          isComplete: missing.length === 0 && extra.length === 0,
        });
      }
    };

    await Promise.all([
      processType('hard', 'hard_skill_answer_options', tpl.hard_scale_min, tpl.hard_scale_max, tpl.hard_skills_enabled),
      processType('soft', 'soft_skill_answer_options', tpl.soft_scale_min, tpl.soft_scale_max, true),
    ]);

    const allComplete = results.every(r => r.isComplete);
    const hasWarnings = results.some(r => r.extraLevels.length > 0);
    const hasErrors = results.some(r => r.missingLevels.length > 0);

    return { categories: results, allComplete, hasWarnings, hasErrors };
  }, [templates]);

  return {
    templates,
    labels,
    loading,
    fetchTemplates,
    fetchLabels,
    createTemplate,
    updateTemplate,
    approveTemplate,
    archiveTemplate,
    upsertLabel,
    deleteLabel,
    fetchTemplateCoverage,
  };
};
