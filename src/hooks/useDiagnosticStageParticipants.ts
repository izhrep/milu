import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticStageParticipant {
  id: string;
  stage_id: string;
  user_id: string;
  created_at: string;
}

export const useDiagnosticStageParticipants = (userId?: string) => {
  const [isParticipant, setIsParticipant] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkParticipation = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Находим активный этап диагностики
      const { data: activeStages, error: stagesError } = await supabase
        .from('diagnostic_stages')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (stagesError) throw stagesError;

      if (!activeStages || activeStages.length === 0) {
        setIsParticipant(false);
        setActiveStageId(null);
        setLoading(false);
        return;
      }

      const stageId = activeStages[0].id;
      setActiveStageId(stageId);

      // Проверяем, является ли пользователь участником этого этапа
      const { data: participants, error: participantsError } = await supabase
        .from('diagnostic_stage_participants')
        .select('id')
        .eq('stage_id', stageId)
        .eq('user_id', userId)
        .limit(1);

      if (participantsError) throw participantsError;

      setIsParticipant(participants && participants.length > 0);
    } catch (err) {
      console.error('Error checking diagnostic stage participation:', err);
      setIsParticipant(false);
      setActiveStageId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkParticipation();
  }, [userId]);

  return {
    isParticipant,
    activeStageId,
    loading,
    refetch: checkParticipation
  };
};
