import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  sub_category_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const useSkills = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: skills, isLoading } = useQuery({
    queryKey: ['hard_skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hard_skills')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Skill[];
    },
  });

  const createSkillMutation = useMutation({
    mutationFn: async (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('hard_skills')
        .insert(skill)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_skills'] });
      toast({ title: 'Hard Skill создан успешно' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Skill> & { id: string }) => {
      const { data, error } = await supabase
        .from('hard_skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_skills'] });
      toast({ title: 'Hard Skill обновлен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hard_skills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_skills'] });
      toast({ title: 'Hard Skill удален' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    skills,
    isLoading,
    createSkill: createSkillMutation.mutate,
    updateSkill: updateSkillMutation.mutate,
    deleteSkill: deleteSkillMutation.mutate,
  };
};