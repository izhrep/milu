import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Users, Clock, CheckCircle, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSurvey360Assignments } from '@/hooks/useSurvey360Assignments';
import { useAssignmentDraftStatus } from '@/hooks/useAssignmentDraftStatus';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AssignmentCardProps {
  assignment: any;
  isSelf: boolean;
  isManager: boolean;
  currentUserId: string | undefined;
  onNavigate: (id: string) => void;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({ 
  assignment, 
  isSelf, 
  isManager, 
  currentUserId,
  onNavigate 
}) => {
  const { hasDraft, loading: draftLoading } = useAssignmentDraftStatus(assignment.id, currentUserId);
  
  const getButtonText = () => {
    if (hasDraft) {
      if (isSelf) return 'Продолжить опрос "Обратная связь 360" по себе';
      if (isManager) return 'Продолжить оценку подчиненного';
      return 'Продолжить оценку коллеги';
    }
    
  if (isSelf) return 'Начать опрос "Обратная связь 360" по себе';
    if (isManager) return 'Оценить подчиненного';
    return 'Дать фидбек коллеге';
  };

  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                Оценка 360° для сотрудника
              </h3>
              <p className="text-sm text-text-secondary">
                Назначена: {new Date(assignment.assigned_date).toLocaleDateString('ru-RU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {assignment.status === 'pending' || assignment.status === 'approved' ? (
              <>
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                  <Clock className="w-3 h-3 mr-1" />
                  Ожидает
                </Badge>
                <Button
                  onClick={() => onNavigate(assignment.id)}
                  variant={hasDraft ? 'default' : 'default'}
                  disabled={draftLoading}
                >
                  {draftLoading ? 'Загрузка...' : getButtonText()}
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <CheckCircle className="w-3 h-3 mr-1" />
                Завершено
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function MyAssignmentsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const { assignments: survey360Assignments, loading: survey360Loading } = useSurvey360Assignments(currentUser?.id);
  // Skill assignments are now part of survey_360_assignments
  const skillAssignments: any[] = [];
  const skillLoading = false;

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const filterByStatus = <T extends { status: string }>(items: T[] | undefined) => {
    if (!items) return [];
    if (statusFilter === 'all') return items;
    if (statusFilter === 'pending') return items.filter(i => i.status === 'pending' || i.status === 'approved');
    if (statusFilter === 'completed') return items.filter(i => i.status === 'completed');
    return items;
  };

  const filtered360 = filterByStatus(survey360Assignments);
  const filteredSkills = filterByStatus(skillAssignments);

  const stats = {
    total360: survey360Assignments?.length || 0,
    pending360: survey360Assignments?.filter(a => a.status === 'pending' || a.status === 'approved').length || 0,
    completed360: survey360Assignments?.filter(a => a.status === 'completed').length || 0,
    totalSkills: skillAssignments?.length || 0,
    pendingSkills: skillAssignments?.filter(a => a.status === 'pending' || a.status === 'approved').length || 0,
    completedSkills: skillAssignments?.filter(a => a.status === 'completed').length || 0,
  };

  if (survey360Loading || skillLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Мои задания</h1>
        <p className="text-text-secondary mt-2">
          Все назначенные вам оценки и их статусы
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Всего 360°
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{stats.total360}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Ожидает 360°
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pending360}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Всего навыков
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">{stats.totalSkills}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Ожидает навыков
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingSkills}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Все
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('pending')}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Ожидают
        </Button>
        <Button
          variant={statusFilter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('completed')}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Завершено
        </Button>
      </div>

      <Tabs defaultValue="360" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="360" className="gap-2">
            <Users className="h-4 w-4" />
            Оценка 360° ({filtered360.length})
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Навыки ({filteredSkills.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="360" className="space-y-4">
          {filtered360.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-text-secondary">
                Нет заданий по оценке 360°
              </CardContent>
            </Card>
          ) : (
            filtered360.map((assignment) => {
              const isSelf = assignment.evaluated_user_id === currentUser?.id;
              const isManager = assignment.assignment_type === 'manager' || assignment.is_manager_participant === true;
              
              return (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  isSelf={isSelf}
                  isManager={isManager}
                  currentUserId={currentUser?.id}
                  onNavigate={(id) => navigate(`/unified-assessment/${id}`)}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          {filteredSkills.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-text-secondary">
                Нет заданий по оценке навыков
              </CardContent>
            </Card>
          ) : (
            filteredSkills.map((assignment) => (
              <Card key={assignment.id} className="border-0 shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <ClipboardCheck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary">
                          Оценка навыков для сотрудника
                        </h3>
                        <p className="text-sm text-text-secondary">
                          Назначена: {new Date(assignment.assigned_date).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {assignment.status === 'отправлен запрос' ? (
                        <>
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            <Clock className="w-3 h-3 mr-1" />
                            Ожидает
                          </Badge>
                          <Button
                            onClick={() => navigate(`/assessment/${assignment.id}`)}
                          >
                            Начать оценку
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Завершено
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}