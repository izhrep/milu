import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CategorySoftSkill {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useCategorySoftSkills = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['category_soft_skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_soft_skills')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as CategorySoftSkill[];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (category: Omit<CategorySoftSkill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('category_soft_skills')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category_soft_skills'] });
      toast({ title: 'Категория создана успешно' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CategorySoftSkill> & { id: string }) => {
      const { data, error } = await supabase
        .from('category_soft_skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category_soft_skills'] });
      toast({ title: 'Категория обновлена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('category_soft_skills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category_soft_skills'] });
      toast({ title: 'Категория удалена' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    categories,
    isLoading,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
  };
};
