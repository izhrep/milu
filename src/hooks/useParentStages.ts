import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface ParentStage {
  id: string;
  period: string;
  start_date: string;
  end_date: string;
  reminder_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useParentStages = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: stages, isLoading } = useQuery({
    queryKey: ['parent-stages'],
    queryFn: async () => {
      // Автозавершение этапов выполняется серверным планировщиком (pg_cron)
      // каждые 5 минут, независимо от UI
      
      const { data, error } = await supabase
        .from('parent_stages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ParentStage[];
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<ParentStage, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('parent_stages')
        .insert({ ...stage, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-stages'] });
      toast({ title: 'Родительский этап создан' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ParentStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('parent_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-stages'] });
      toast({ title: 'Этап обновлен' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from('parent_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-stages'] });
      toast({ title: 'Этап удален' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    stages,
    isLoading,
    createStage: createStageMutation.mutate,
    updateStage: updateStageMutation.mutate,
    deleteStage: deleteStageMutation.mutate,
  };
};
