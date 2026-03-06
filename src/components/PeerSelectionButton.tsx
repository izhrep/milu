import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { ColleagueSelectionDialog } from './ColleagueSelectionDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PeerSelectionButtonProps {
  currentUserId: string;
  managerId?: string;
  diagnosticStageId?: string;
  taskId?: string;
  onSelectionComplete?: () => void;
}

export const PeerSelectionButton: React.FC<PeerSelectionButtonProps> = ({
  currentUserId,
  managerId,
  diagnosticStageId,
  taskId,
  onSelectionComplete
}) => {
  const [showDialog, setShowDialog] = useState(false);

  const handleConfirm = async (selectedColleagues: string[]) => {
    try {
      // Создание назначений происходит в ColleagueSelectionDialog
      // Здесь только уведомление об успехе
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    } catch (error) {
      console.error('Error in peer selection:', error);
      toast.error('Ошибка при выборе оценивающих');
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
      >
        <Users className="w-4 h-4 mr-2" />
        Выбрать респондентов
      </Button>

      <ColleagueSelectionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onConfirm={handleConfirm}
        currentUserId={currentUserId}
        managerId={managerId}
        diagnosticStageId={diagnosticStageId}
      />
    </>
  );
};
