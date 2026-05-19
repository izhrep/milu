import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, TrendingUp, FileText } from "@/components/icons";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import { toast } from 'sonner';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  position_name?: string;
  has_skill_results: boolean;
  has_360_results: boolean;
}

const ManagerReportsPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubordinates();
  }, [currentUser]);

  const fetchSubordinates = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Получаем подчинённых через subtree (включая indirect)
      const { data: subtreeIds, error: subtreeError } = await supabase
        .rpc('get_management_subtree_ids', { _manager_id: currentUser.id });
      
      if (subtreeError) throw subtreeError;
      if (!subtreeIds || subtreeIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const { data: employeesData, error: employeesError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          middle_name,
          position_id,
          positions (
            name
          )
        `)
        .in('id', subtreeIds);

      if (employeesError) throw employeesError;

      // Проверяем наличие результатов для каждого подчинённого
      const employeesWithResults = await Promise.all(
        (employeesData || []).map(async (emp: any) => {
          const [skillResults, survey360Results] = await Promise.all([
            supabase
              .from('hard_skill_results')
              .select('id')
              .eq('evaluated_user_id', emp.id)
              .limit(1),
            supabase
              .from('soft_skill_results')
              .select('id')
              .eq('evaluated_user_id', emp.id)
              .limit(1)
          ]);

          return {
            id: emp.id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            middle_name: emp.middle_name,
            position_name: emp.positions?.name,
            has_skill_results: (skillResults.data?.length || 0) > 0,
            has_360_results: (survey360Results.data?.length || 0) > 0
          };
        })
      );

      setEmployees(employeesWithResults);
    } catch (error) {
      console.error('Error fetching subordinates:', error);
      toast.error('Ошибка при загрузке списка подчинённых');
    } finally {
      setLoading(false);
    }
  };

  const getFullName = (emp: Employee) => {
    return [emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="items-stretch border shadow-lg flex overflow-hidden flex-wrap rounded-[32px] border-solid border-background/40">
      <Sidebar />
      
      <div className="flex-1 max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-heading-2 font-bold text-foreground mb-2">Отчёты по подчинённым</h1>
          <p className="text-muted-foreground">Результаты оценок ваших сотрудников</p>
        </div>

        {employees.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 text-muted-foreground/70 mx-auto mb-4" />
            <h3 className="text-heading-4 font-semibold text-foreground mb-2">Нет подчинённых</h3>
            <p className="text-muted-foreground">У вас пока нет подчинённых сотрудников</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {employees.map((employee) => (
              <Card key={employee.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-body-lg font-semibold text-foreground mb-1">
                      {getFullName(employee)}
                    </h3>
                    {employee.position_name && (
                      <p className="text-body-md text-muted-foreground mb-3">{employee.position_name}</p>
                    )}
                    
                    <div className="flex gap-2">
                      {employee.has_skill_results ? (
                        <Badge variant="default" className="bg-success/20 text-success">
                          <FileText className="w-3 h-3 mr-1" />
                          Навыки
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Нет оценки навыков
                        </Badge>
                      )}
                      
                      {employee.has_360_results ? (
                        <Badge variant="default" className="bg-chart-3/20 text-chart-3">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          360°
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Нет оценки 360°
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {employee.has_skill_results && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Просмотр отчёта будет доступен в следующей версии')}
                      >
                        Навыки
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                    {employee.has_360_results && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Просмотр отчёта будет доступен в следующей версии')}
                      >
                        360°
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RightPanel />
    </div>
  );
};

export default ManagerReportsPage;