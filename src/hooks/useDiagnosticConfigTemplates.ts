import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DiagnosticConfigTemplate {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: 'draft' | 'approved' | 'archived';
  hard_scale_min: number;
  hard_scale_max: number;
  soft_scale_min: number;
  soft_scale_max: number;
  hard_scale_reversed: boolean;
  soft_scale_reversed: boolean;
  hard_skills_enabled: boolean;
  comment_rules: Record<string, any>;
  open_questions_config: any[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateScaleLabel {
  id: string;
  template_id: string;
  skill_type: 'hard' | 'soft';
  level_value: number;
  label_text: string;
  order_index: number;
}

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
  comment_rules?: Record<string, any>;
  open_questions_config?: any[];
}

/** Client-side approval validation matching DB trigger logic */
export function validateTemplateForApproval(
  template: DiagnosticConfigTemplate,
  labels: TemplateScaleLabel[]
): string[] {
  const errors: string[] = [];

  // Soft labels — always required
  const softLabels = labels.filter(l => l.skill_type === 'soft');
  const softExpected = template.soft_scale_max - template.soft_scale_min + 1;
  const softValues = new Set(softLabels.map(l => l.level_value));
  
  if (softValues.size !== softExpected) {
    errors.push(`Soft: ожидается ${softExpected} уровней, найдено ${softValues.size}`);
  }
  const softMin = Math.min(...softLabels.map(l => l.level_value));
  const softMax = Math.max(...softLabels.map(l => l.level_value));
  if (softLabels.length > 0 && (softMin !== template.soft_scale_min || softMax !== template.soft_scale_max)) {
    errors.push(`Soft: диапазон [${softMin}..${softMax}] не совпадает с [${template.soft_scale_min}..${template.soft_scale_max}]`);
  }

  // Hard labels — only if enabled
  if (template.hard_skills_enabled) {
    const hardLabels = labels.filter(l => l.skill_type === 'hard');
    const hardExpected = template.hard_scale_max - template.hard_scale_min + 1;
    const hardValues = new Set(hardLabels.map(l => l.level_value));

    if (hardValues.size !== hardExpected) {
      errors.push(`Hard: ожидается ${hardExpected} уровней, найдено ${hardValues.size}`);
    }
    const hardMin = Math.min(...hardLabels.map(l => l.level_value));
    const hardMax = Math.max(...hardLabels.map(l => l.level_value));
    if (hardLabels.length > 0 && (hardMin !== template.hard_scale_min || hardMax !== template.hard_scale_max)) {
      errors.push(`Hard: диапазон [${hardMin}..${hardMax}] не совпадает с [${template.hard_scale_min}..${template.hard_scale_max}]`);
    }
  }

  return errors;
}

export const useDiagnosticConfigTemplates = () => {
  const [templates, setTemplates] = useState<DiagnosticConfigTemplate[]>([]);
  const [labels, setLabels] = useState<TemplateScaleLabel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnostic_config_templates' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTemplates((data as any[]) || []);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLabels = useCallback(async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('template_scale_labels' as any)
        .select('*')
        .eq('template_id', templateId)
        .order('level_value', { ascending: true });
      if (error) throw error;
      setLabels((data as any[]) || []);
      return (data as any[]) || [];
    } catch (err: any) {
      console.error('Error fetching labels:', err);
      toast.error('Ошибка загрузки лейблов шкалы');
      return [];
    }
  }, []);

  const createTemplate = useCallback(async (input: CreateTemplateInput, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('diagnostic_config_templates' as any)
        .insert({ ...input, created_by: userId } as any)
        .select()
        .single();
      if (error) throw error;
      toast.success('Шаблон создан');
      await fetchTemplates();
      return data as any as DiagnosticConfigTemplate;
    } catch (err: any) {
      console.error('Error creating template:', err);
      toast.error(err.message || 'Ошибка создания шаблона');
      return null;
    }
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CreateTemplateInput>) => {
    try {
      const { error } = await supabase
        .from('diagnostic_config_templates' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон обновлён');
      await fetchTemplates();
    } catch (err: any) {
      console.error('Error updating template:', err);
      toast.error(err.message || 'Ошибка обновления шаблона');
    }
  }, [fetchTemplates]);

  const approveTemplate = useCallback(async (id: string, templateLabels: TemplateScaleLabel[]) => {
    // Find the template
    const tpl = templates.find(t => t.id === id);
    if (!tpl) {
      toast.error('Шаблон не найден');
      return false;
    }

    // Client-side pre-validation
    const errors = validateTemplateForApproval(tpl, templateLabels);
    if (errors.length > 0) {
      errors.forEach(e => toast.error(e));
      return false;
    }

    try {
      const { error } = await supabase
        .from('diagnostic_config_templates' as any)
        .update({ status: 'approved' } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон утверждён');
      await fetchTemplates();
      return true;
    } catch (err: any) {
      console.error('Error approving template:', err);
      toast.error(err.message || 'Ошибка утверждения шаблона');
      return false;
    }
  }, [templates, fetchTemplates]);

  const archiveTemplate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('diagnostic_config_templates' as any)
        .update({ status: 'archived' } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Шаблон архивирован');
      await fetchTemplates();
    } catch (err: any) {
      console.error('Error archiving template:', err);
      toast.error(err.message || 'Ошибка архивирования');
    }
  }, [fetchTemplates]);

  const upsertLabel = useCallback(async (label: Omit<TemplateScaleLabel, 'id'> & { id?: string }) => {
    try {
      const { error } = await supabase
        .from('template_scale_labels' as any)
        .upsert(label as any, { onConflict: 'template_id,skill_type,level_value' });
      if (error) throw error;
    } catch (err: any) {
      console.error('Error upserting label:', err);
      toast.error(err.message || 'Ошибка сохранения лейбла');
    }
  }, []);

  const deleteLabel = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('template_scale_labels' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting label:', err);
      toast.error(err.message || 'Ошибка удаления лейбла');
    }
  }, []);

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
  };
};
