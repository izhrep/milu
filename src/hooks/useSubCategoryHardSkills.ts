import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubCategoryHardSkill {
  id: string;
  category_hard_skill_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const useSubCategoryHardSkills = (categoryId?: string) => {
  const queryClient = useQueryClient();

  const { data: subCategories = [], isLoading, error } = useQuery({
    queryKey: ['sub_category_hard_skills', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('sub_category_hard_skills')
        .select('*')
        .order('name');

      if (categoryId) {
        query = query.eq('category_hard_skill_id', categoryId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as SubCategoryHardSkill[];
    },
  });

  const createSubCategory = useMutation({
    mutationFn: async (newSubCategory: Omit<SubCategoryHardSkill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('sub_category_hard_skills')
        .insert(newSubCategory)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub_category_hard_skills'] });
      toast.success('Подкатегория создана');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка создания подкатегории: ${error.message}`);
    },
  });

  const updateSubCategory = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SubCategoryHardSkill> & { id: string }) => {
      const { data, error } = await supabase
        .from('sub_category_hard_skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub_category_hard_skills'] });
      toast.success('Подкатегория обновлена');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка обновления подкатегории: ${error.message}`);
    },
  });

  const deleteSubCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sub_category_hard_skills')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub_category_hard_skills'] });
      toast.success('Подкатегория удалена');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка удаления подкатегории: ${error.message}`);
    },
  });

  return {
    subCategories,
    isLoading,
    error,
    createSubCategory,
    updateSubCategory,
    deleteSubCategory,
  };
};
