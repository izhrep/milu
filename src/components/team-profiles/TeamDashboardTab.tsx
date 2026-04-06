import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useNavigate } from 'react-router-dom';
import { TeamMembersTable } from '@/components/TeamMembersTable';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/hooks/usePermission';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StageFilter, useStageFilter } from '@/components/StageFilter';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useSubordinateTree } from '@/hooks/useSubordinateTree';

const TeamDashboardTab = () => {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const navigate = useNavigate();
  
  const { hasPermission: canViewAllUsers } = usePermission('users.view');
  const { hasPermission: canManageTeam } = usePermission('team.manage');
  const { hasPermission: canViewTeam } = usePermission('team.view');

  const [selectedManagerId, setSelectedManagerId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assessmentFilter, setAssessmentFilter] = useState<string>('all');
  
  const { stages: diagnosticStages } = useDiagnosticStages();
  const stageOptions = useMemo(() => {
    return diagnosticStages?.map(s => ({
      id: s.id,
      period: s.period || s.evaluation_period || 'Без периода',
      start_date: s.start_date,
      end_date: s.end_date,
      is_active: s.is_active,
    })) || [];
  }, [diagnosticStages]);
  const { selectedStageId, setSelectedStageId } = useStageFilter(stageOptions);

  const isAdminOrHrbp = canViewAllUsers;
  const effectiveManagerId = isAdminOrHrbp && selectedManagerId !== 'all' 
    ? selectedManagerId 
    : user?.id;

  const { groupedByManager, allSubtreeUsers, isLoading: subtreeLoading, directCount, indirectCount } = useSubordinateTree(
    (canManageTeam || (isAdminOrHrbp && selectedManagerId !== 'all')) ? effectiveManagerId : undefined
  );

  const managersForFilter = useMemo(() => {
    if (!isAdminOrHrbp) return [];
    return users
      .filter(u => u.roles?.some(r => r.role === 'manager'))
      .map(u => ({
        id: u.id,
        name: `${u.last_name || ''} ${u.first_name || ''}`.trim(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, isAdminOrHrbp]);

  const showAllUsersMode = isAdminOrHrbp && selectedManagerId === 'all';
  const baseMembers = showAllUsersMode ? users : allSubtreeUsers.map(su => {
    return users.find(u => u.id === su.id) || su as any;
  });

  const memberIds = baseMembers.map(m => m.id);
  const { data: assessmentsData } = useQuery({
    queryKey: ['team-assessments-filter', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_assessment_results')
        .select('user_id, skill_id, quality_id, self_assessment, peers_average, manager_assessment')
        .in('user_id', memberIds);
      if (error) throw error;
      return data;
    },
    enabled: memberIds.length > 0,
  });

  const usersWithAssessmentData = useMemo(() => {
    const set = new Set<string>();
    assessmentsData?.forEach(r => {
      if (r.self_assessment || r.peers_average || r.manager_assessment) set.add(r.user_id);
    });
    return set;
  }, [assessmentsData]);

  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();
    baseMembers.forEach(m => { if (m.positions?.name) positions.add(m.positions.name); });
    return Array.from(positions).sort();
  }, [baseMembers]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    baseMembers.forEach(m => { if (m.positions?.position_categories?.name) categories.add(m.positions.position_categories.name); });
    return Array.from(categories).sort();
  }, [baseMembers]);

  const filterMember = (member: any) => {
    if (searchQuery) {
      const fullName = `${member.last_name || ''} ${member.first_name || ''} ${member.middle_name || ''}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) return false;
    }
    if (positionFilter !== 'all' && member.positions?.name !== positionFilter) return false;
    if (categoryFilter !== 'all' && member.positions?.position_categories?.name !== categoryFilter) return false;
    if (assessmentFilter !== 'all') {
      const has = usersWithAssessmentData.has(member.id);
      if (assessmentFilter === 'has_data' && !has) return false;
      if (assessmentFilter === 'no_data' && has) return false;
    }
    return true;
  };

  const displayedMembers = useMemo(() => baseMembers.filter(filterMember), 
    [baseMembers, searchQuery, positionFilter, categoryFilter, assessmentFilter, usersWithAssessmentData]);

  if (loading || subtreeLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-surface-secondary rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-surface-secondary rounded w-1/3"></div>
      </div>
    );
  }

  const teamMembers = users.filter(u => u.manager_id === user?.id);
  const hasAccess = canViewAllUsers || canViewTeam || (canManageTeam && teamMembers.length > 0);

  if (!hasAccess) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text-primary mb-2">Доступ ограничен</h3>
            <p className="text-text-secondary">
              Этот раздел доступен только руководителям с подчинёнными, HR BP и администраторам
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
              Вернуться на главную
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdminOrHrbp ? 'lg:grid-cols-3 2xl:grid-cols-6' : 'lg:grid-cols-5'} gap-4 items-end`}>
            {isAdminOrHrbp && (
              <div className="space-y-2">
                <Label>Руководитель</Label>
                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все сотрудники" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все сотрудники</SelectItem>
                    {managersForFilter.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="search-name">Поиск по ФИО</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input
                  id="search-name"
                  placeholder="Введите имя..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position-filter">Должность</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger id="position-filter">
                  <SelectValue placeholder="Все должности" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все должности</SelectItem>
                  {uniquePositions.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-filter">Категория должностей</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {uniqueCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-filter">Обратная связь 360</Label>
              <Select value={assessmentFilter} onValueChange={setAssessmentFilter}>
                <SelectTrigger id="assessment-filter">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="has_data">Есть результаты</SelectItem>
                  <SelectItem value="no_data">Нет результатов</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <StageFilter
              stages={stageOptions}
              selectedStageId={selectedStageId}
              onStageChange={setSelectedStageId}
              label="Этап диагностики"
              showAllOption={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Team stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {showAllUsersMode ? 'Всего сотрудников' : 'Всего подчинённых'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">{displayedMembers.length}</div>
          </CardContent>
        </Card>
        {!showAllUsersMode && (
          <>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Прямые</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-text-primary">{directCount}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Непрямые</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-text-primary">{indirectCount}</div>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Должностей</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">
              {new Set(displayedMembers.map(m => m.position_id).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Всего результатов 360</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">
              {usersWithAssessmentData.size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team members */}
      {displayedMembers.length > 0 ? (
        showAllUsersMode ? (
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Все пользователи</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamMembersTable members={displayedMembers} currentUserId={user?.id || ''} diagnosticStageId={selectedStageId} />
            </CardContent>
          </Card>
        ) : (
          groupedByManager.map(group => {
            const filteredGroupMembers = group.members
              .map(su => users.find(u => u.id === su.id) || su as any)
              .filter(filterMember);
            
            if (filteredGroupMembers.length === 0) return null;

            const intermediateMgrUser = !group.isDirect 
              ? users.find(u => u.id === group.managerId)
              : null;
            const intermediateMgrName = intermediateMgrUser
              ? `${intermediateMgrUser.last_name || ''} ${intermediateMgrUser.first_name || ''}`.trim()
              : undefined;

            return (
              <Card key={group.managerId} className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {group.managerName}
                    <span className="text-sm font-normal text-text-secondary">({filteredGroupMembers.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TeamMembersTable
                    members={filteredGroupMembers}
                    currentUserId={user?.id || ''}
                    diagnosticStageId={selectedStageId}
                    isDirectManager={group.isDirect}
                    indirectManagerName={intermediateMgrName}
                  />
                </CardContent>
              </Card>
            );
          })
        )
      ) : (
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">У вас пока нет подчинённых</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamDashboardTab;
