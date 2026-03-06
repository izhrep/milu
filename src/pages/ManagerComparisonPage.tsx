import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerComparison } from '@/hooks/useManagerComparison';
import { ManagerComparisonTable } from '@/components/ManagerComparisonTable';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function ManagerComparisonPage() {
  const { user } = useAuth();
  const { employees, loading, refetch } = useManagerComparison(user?.id);
  
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [skills, setSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [qualities, setQualities] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchFilterData = async () => {
      const [deptRes, skillRes, qualityRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('hard_skills').select('id, name').order('name'),
        supabase.from('soft_skills').select('id, name').order('name'),
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (skillRes.data) setSkills(skillRes.data);
      if (qualityRes.data) setQualities(qualityRes.data);
    };

    fetchFilterData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <RightPanel />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Сравнение подчинённых</h1>
            <p className="text-muted-foreground mt-2">
              Анализ результатов диагностики по ключевым компетенциям
            </p>
          </div>

          <ManagerComparisonTable
            employees={employees}
            onFilterChange={refetch}
            departments={departments}
            skills={skills}
            qualities={qualities}
          />
        </div>
      </main>
      <RightPanel />
    </div>
  );
}
