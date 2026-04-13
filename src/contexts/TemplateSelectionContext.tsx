import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TemplateContext } from '@/components/admin/QuestionAnswerOptionsManager';

interface TemplateSelectionState {
  /** Currently selected template id (from context switch or CTA). */
  selectedTemplateId: string | null;
  /** Resolved template data for the selected id. */
  templateContext: TemplateContext | null;
  /** Answer category to highlight/scroll-to in the questions tab. */
  focusedAnswerCategoryId: string | null;
  /** Whether we're still loading template data. */
  loading: boolean;
  /** Select a template by id (fetches data automatically). */
  selectTemplate: (id: string) => void;
  /** Set answer category to focus. */
  setFocusedAnswerCategoryId: (id: string | null) => void;
  /** Clear selection. */
  clearSelection: () => void;
}

const TemplateSelectionContext = createContext<TemplateSelectionState | null>(null);

export const useTemplateSelection = (): TemplateSelectionState => {
  const ctx = useContext(TemplateSelectionContext);
  if (!ctx) throw new Error('useTemplateSelection must be used inside TemplateSelectionProvider');
  return ctx;
};

export const TemplateSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateContext, setTemplateContext] = useState<TemplateContext | null>(null);
  const [focusedAnswerCategoryId, setFocusedAnswerCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch template data when selectedTemplateId changes
  useEffect(() => {
    if (!selectedTemplateId) {
      // If no explicit selection, load latest approved as fallback
      const fetchApproved = async () => {
        setLoading(true);
        try {
          const { data } = await supabase
            .from('diagnostic_config_templates')
            .select('id, name, version, hard_scale_min, hard_scale_max, soft_scale_min, soft_scale_max, hard_skills_enabled, hard_scale_reversed, soft_scale_reversed')
            .eq('status', 'approved')
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) {
            setTemplateContext(data as TemplateContext);
          } else {
            setTemplateContext(null);
          }
        } catch {
          setTemplateContext(null);
        } finally {
          setLoading(false);
        }
      };
      fetchApproved();
      return;
    }

    const fetchById = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('diagnostic_config_templates')
          .select('id, name, version, hard_scale_min, hard_scale_max, soft_scale_min, soft_scale_max, hard_skills_enabled, hard_scale_reversed, soft_scale_reversed')
          .eq('id', selectedTemplateId)
          .single();
        if (data) {
          setTemplateContext(data as TemplateContext);
        }
      } catch {
        setTemplateContext(null);
      } finally {
        setLoading(false);
      }
    };
    fetchById();
  }, [selectedTemplateId]);

  const selectTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTemplateId(null);
    setTemplateContext(null);
    setFocusedAnswerCategoryId(null);
  }, []);

  return (
    <TemplateSelectionContext.Provider value={{
      selectedTemplateId,
      templateContext,
      focusedAnswerCategoryId,
      loading,
      selectTemplate,
      setFocusedAnswerCategoryId,
      clearSelection,
    }}>
      {children}
    </TemplateSelectionContext.Provider>
  );
};
