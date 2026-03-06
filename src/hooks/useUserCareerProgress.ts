import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserCareerProgress {
  id: string;
  user_id: string;
  career_track_id: string;
  current_step_id?: string;
  selected_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const useUserCareerProgress = () => {
  const [progress, setProgress] = useState<UserCareerProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUserProgress();
    }
  }, [user]);

  const fetchUserProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        throw new Error('Пользователь не авторизован');
      }

      // Получаем активный прогресс карьерного трека
      const { data: progressData, error: progressError } = await supabase
        .from('user_career_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('selected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (progressError && progressError.code !== 'PGRST116') {
        throw progressError;
      }

      setProgress(progressData || null);
    } catch (err) {
      console.error('Error fetching user career progress:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке прогресса');
    } finally {
      setLoading(false);
    }
  };

  const selectTrack = async (careerTrackId: string, currentStepId?: string) => {
    try {
      setError(null);

      if (!user?.id) {
        throw new Error('Пользователь не авторизован');
      }

      // Деактивируем предыдущий прогресс
      if (progress) {
        await supabase
          .from('user_career_progress')
          .update({ status: 'inactive' })
          .eq('id', progress.id);
      }

      // Создаем новый прогресс
      const { data: newProgress, error } = await supabase
        .from('user_career_progress')
        .insert({
          user_id: user.id,
          career_track_id: careerTrackId,
          current_step_id: currentStepId,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProgress(newProgress);
      return newProgress;
    } catch (err) {
      console.error('Error selecting track:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при выборе трека');
      throw err;
    }
  };

  const selectStep = async (stepId: string) => {
    if (!progress) {
      throw new Error('Не выбран карьерный трек');
    }

    try {
      setError(null);

      const { data: updatedProgress, error } = await supabase
        .from('user_career_progress')
        .update({ current_step_id: stepId })
        .eq('id', progress.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProgress(updatedProgress);
      return updatedProgress;
    } catch (err) {
      console.error('Error selecting step:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при выборе шага');
      throw err;
    }
  };

  return {
    progress,
    loading,
    error,
    selectTrack,
    selectStep,
    refetch: fetchUserProgress
  };
};