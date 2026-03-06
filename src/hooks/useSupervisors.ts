import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Supervisor {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  role: string;
  user_profiles?: {
    avatar_url?: string;
  };
}

export function getFullName(user: { last_name?: string; first_name?: string; middle_name?: string } | null | undefined): string {
  if (!user) return '';
  return [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ');
}

export const useSupervisors = () => {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);

        // Получаем данные текущего пользователя из таблицы users
        const { data: userData } = await supabase
          .from('users')
          .select('manager_id, hr_bp_id')
          .eq('email', currentUser.email)
          .eq('status', true)
          .maybeSingle();

        const supervisorsList: Supervisor[] = [];

        // Получаем руководителя, если есть
        if (userData?.manager_id) {
          const { data: supervisor } = await supabase
            .from('users')
            .select('id, last_name, first_name, middle_name')
            .eq('id', userData.manager_id)
            .eq('status', true)
            .maybeSingle();

          if (supervisor) {
            supervisorsList.push({
              id: supervisor.id,
              last_name: supervisor.last_name || '',
              first_name: supervisor.first_name || '',
              middle_name: supervisor.middle_name || '',
              role: 'Руководитель'
            });
          }
        }

        // Получаем HR BP, если есть
        if (userData?.hr_bp_id) {
          const { data: hrBp } = await supabase
            .from('users')
            .select('id, last_name, first_name, middle_name')
            .eq('id', userData.hr_bp_id)
            .eq('status', true)
            .maybeSingle();

          if (hrBp) {
            supervisorsList.push({
              id: hrBp.id,
              last_name: hrBp.last_name || '',
              first_name: hrBp.first_name || '',
              middle_name: hrBp.middle_name || '',
              role: 'HR BP'
            });
          }
        }

        setSupervisors(supervisorsList);
      } catch (error) {
        console.error('Error fetching supervisors:', error);
        setSupervisors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisors();
  }, [currentUser]);

  return { supervisors, loading, getFullName };
};