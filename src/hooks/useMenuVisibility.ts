import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from './usePermission';

interface MenuVisibility {
  showCareerTrack: boolean;
  showMeetings: boolean;
  loading: boolean;
}

export const useMenuVisibility = (userId: string | undefined, userRole: string | undefined): MenuVisibility => {
  const [visibility, setVisibility] = useState<MenuVisibility>({
    showCareerTrack: false,
    showMeetings: false,
    loading: true,
  });

  // Permission-based check for non-employee access
  const { hasPermission: canViewTeam, isLoading: teamPermissionLoading } = usePermission('team.view');

  useEffect(() => {
    const checkVisibility = async () => {
      if (!userId) {
        setVisibility({ showCareerTrack: false, showMeetings: false, loading: false });
        return;
      }

      // Wait for permission check to complete
      if (teamPermissionLoading) {
        return;
      }

      // Users with team.view permission (manager, hr_bp, admin) see all menu items
      if (canViewTeam) {
        setVisibility({ showCareerTrack: true, showMeetings: true, loading: false });
        return;
      }

      // For users without team.view permission (typically employees), check conditions
      try {
        // Check grade level for career track visibility
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('grade_id, grades(level)')
          .eq('id', userId)
          .single();

        const gradeLevel = userData?.grades?.level ?? 0;
        const showCareerTrack = gradeLevel > 0;

        // Check meetings visibility: stage participation OR existing 1:1 meetings OR having a manager
        const { data: participantData } = await supabase
          .from('meeting_stage_participants')
          .select('id')
          .eq('user_id', userId)
          .limit(1);

        let showMeetings = (participantData && participantData.length > 0) ?? false;

        if (!showMeetings) {
          // Check if user has any 1:1 meetings (as employee)
          const { data: meetingsData } = await supabase
            .from('one_on_one_meetings')
            .select('id')
            .eq('employee_id', userId)
            .limit(1);
          showMeetings = (meetingsData && meetingsData.length > 0) ?? false;
        }

        if (!showMeetings) {
          // Check if user has an assigned manager (can create stage-less meetings)
          const { data: managerCheck } = await supabase
            .from('users')
            .select('manager_id')
            .eq('id', userId)
            .single();
          showMeetings = !!managerCheck?.manager_id;
        }

        setVisibility({
          showCareerTrack,
          showMeetings,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking menu visibility:', error);
        setVisibility({ showCareerTrack: false, showMeetings: false, loading: false });
      }
    };

    checkVisibility();
  }, [userId, canViewTeam, teamPermissionLoading]);

  return visibility;
};
