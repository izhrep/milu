import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Quality {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  sub_category_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const useQualities = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: qualities, isLoading } = useQuery({
    queryKey: ['soft_skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soft_skills')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Quality[];
    },
  });

  const createQualityMutation = useMutation({
    mutationFn: async (quality: Omit<Quality, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('soft_skills')
        .insert(quality)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft_skills'] });
      toast({ title: 'Soft Skill создан успешно' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateQualityMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quality> & { id: string }) => {
      const { data, error } = await supabase
        .from('soft_skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft_skills'] });
      toast({ title: 'Soft Skill обновлен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteQualityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('soft_skills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft_skills'] });
      toast({ title: 'Soft Skill удален' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    qualities,
    isLoading,
    createQuality: createQualityMutation.mutate,
    updateQuality: updateQualityMutation.mutate,
    deleteQuality: deleteQualityMutation.mutate,
  };
};