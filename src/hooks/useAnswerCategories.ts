import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AnswerCategory {
  id: string;
  name: string;
  description: string | null;
  question_type: string | null;
  comment_required: boolean;
  created_at: string;
  updated_at: string;
}

export const useAnswerCategories = () => {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['answer-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('answer_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as AnswerCategory[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async (category: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('answer_categories')
        .insert([category])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answer-categories'] });
      toast.success('Категория создана');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка создания категории: ${error.message}`);
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AnswerCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('answer_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answer-categories'] });
      toast.success('Категория обновлена');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка обновления категории: ${error.message}`);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('answer_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answer-categories'] });
      toast.success('Категория удалена');
    },
    onError: (error: Error) => {
      if (error.message.includes('используется в вопросах')) {
        toast.error('Нельзя удалить категорию, которая используется в вопросах');
      } else {
        toast.error(`Ошибка удаления категории: ${error.message}`);
      }
    },
  });

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
