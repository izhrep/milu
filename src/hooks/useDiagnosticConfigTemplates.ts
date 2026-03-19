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
  johari_rules: Record<string, any>;
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
  johari_rules?: Record<string, any>;
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

  const approveTemplate = useCallback(async (id: string) => {
    // Try local cache first, then fetch from DB to avoid stale-state issues
    let tpl = templates.find(t => t.id === id);
    if (!tpl) {
      const { data, error: fetchErr } = await supabase
        .from('diagnostic_config_templates' as any)
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !data) {
        toast.error('Шаблон не найден');
        return false;
      }
      tpl = data as any as DiagnosticConfigTemplate;
    }

    const errors = validateTemplateForApproval(tpl);
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
