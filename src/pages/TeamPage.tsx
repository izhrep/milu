import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Users, TrendingUp, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useNavigate } from 'react-router-dom';
import { TeamMembersTable } from '@/components/TeamMembersTable';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/hooks/usePermission';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StageFilter, useStageFilter } from '@/components/StageFilter';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';

const TeamPage = () => {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const navigate = useNavigate();
  
  // Check permissions
  const { hasPermission: canViewAllUsers } = usePermission('users.view');
  const { hasPermission: canManageTeam } = usePermission('team.manage');
  const { hasPermission: canViewTeam } = usePermission('team.view');

  // Get current user data
  const currentUser = users.find(u => u.id === user?.id);
  
  // Get team members (subordinates of current user)
  const teamMembers = users.filter(u => u.manager_id === user?.id);

  // Get company colleagues - show all users from same company (excluding self)
  // Admin users are only visible to those with users.view permission
  const companyColleagues = users.filter(u => {
    // Exclude self
    if (u.id === user?.id) return false;
    // Without users.view permission, exclude admin users
    if (!canViewAllUsers && u.roles?.some(r => r.role === 'admin')) return false;
    // Include all other users (RLS policy already filters by company)
    return true;
  });

  // For users with users.view (admin/hr_bp), always show all users
  // For managers (canManageTeam), always show subordinates (no toggle needed)
  const [showAllUsers, setShowAllUsers] = useState(canViewAllUsers);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assessmentFilter, setAssessmentFilter] = useState<string>('all');
  
  // Stage filter
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
  
  // Determine which users to display (base list before filtering)
  let baseMembers = teamMembers;
  if (canViewAllUsers) {
    // Users with users.view permission see all users
    baseMembers = users;
  } else if (canViewTeam && showAllUsers) {
    baseMembers = companyColleagues;
  }

  // Fetch assessment results for filtering
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

  // Create a set of user IDs that have assessment data
  const usersWithAssessmentData = useMemo(() => {
    const usersWithData = new Set<string>();
    if (assessmentsData) {
      assessmentsData.forEach(result => {
        // Check if user has any valid assessment scores
        if (result.self_assessment || result.peers_average || result.manager_assessment) {
          usersWithData.add(result.user_id);
        }
      });
    }
    return usersWithData;
  }, [assessmentsData]);

  // Get unique positions and categories for filters
  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();
    baseMembers.forEach(member => {
      if (member.positions?.name) {
        positions.add(member.positions.name);
      }
    });
    return Array.from(positions).sort();
  }, [baseMembers]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    baseMembers.forEach(member => {
      if (member.positions?.position_categories?.name) {
        categories.add(member.positions.position_categories.name);
      }
    });
    return Array.from(categories).sort();
  }, [baseMembers]);

  // Apply all filters
  const displayedMembers = useMemo(() => {
    return baseMembers.filter(member => {
      // Search by name
      if (searchQuery) {
        const fullName = `${member.last_name || ''} ${member.first_name || ''} ${member.middle_name || ''}`.toLowerCase();
        if (!fullName.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      // Filter by position
      if (positionFilter !== 'all' && member.positions?.name !== positionFilter) {
        return false;
      }

      // Filter by category
      if (categoryFilter !== 'all' && member.positions?.position_categories?.name !== categoryFilter) {
        return false;
      }

      // Filter by assessment data (360 results)
      if (assessmentFilter !== 'all') {
        const hasAssessmentData = usersWithAssessmentData.has(member.id);
        
        if (assessmentFilter === 'has_data' && !hasAssessmentData) {
          return false;
        }
        if (assessmentFilter === 'no_data' && hasAssessmentData) {
          return false;
        }
      }

      return true;
    });
  }, [baseMembers, searchQuery, positionFilter, categoryFilter, assessmentFilter, usersWithAssessmentData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-surface-secondary rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-surface-secondary rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  // Check access rights
  const hasAccess = canViewAllUsers || canViewTeam || (canManageTeam && teamMembers.length > 0);

  if (!hasAccess) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-lg font-medium text-text-primary mb-2">Доступ ограничен</h3>
              <p className="text-text-secondary">
                Этот раздел доступен только руководителям с подчинёнными, HR BP и администраторам
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Вернуться на главную
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Моя команда</h1>
          <p className="text-text-secondary mt-1">
            Управление и развитие вашей команды
          </p>
        </div>
        
        {/* Toggle: Company view (only for hr_bp with team.view but without users.view) */}
        {canViewTeam && !canViewAllUsers && !canManageTeam && companyColleagues.length > 0 && (
          <div className="flex items-center space-x-2">
            <Switch
              id="show-all-users"
              checked={showAllUsers}
              onCheckedChange={setShowAllUsers}
            />
            <Label htmlFor="show-all-users" className="cursor-pointer">
              {showAllUsers ? 'Моя компания' : 'Мои подчиненные'}
            </Label>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Stage filter */}
            <StageFilter
              stages={stageOptions}
              selectedStageId={selectedStageId}
              onStageChange={setSelectedStageId}
              label="Этап диагностики"
              showAllOption={false}
            />

            {/* Search by name */}
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

            {/* Position filter */}
            <div className="space-y-2">
              <Label htmlFor="position-filter">Должность</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger id="position-filter">
                  <SelectValue placeholder="Все должности" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все должности</SelectItem>
                  {uniquePositions.map(position => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div className="space-y-2">
              <Label htmlFor="category-filter">Категория должностей</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assessment filter */}
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
          </div>
        </CardContent>
      </Card>

      {/* Team stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Всего сотрудников</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">{displayedMembers.length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Активных</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">
              {displayedMembers.filter(m => m.status).length}
            </div>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium text-text-secondary">Подразделений</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">
              {new Set(displayedMembers.map(m => m.department_id).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team members table */}
      {displayedMembers.length > 0 ? (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>
              {canViewAllUsers 
                ? 'Все пользователи' 
                : canViewTeam && showAllUsers 
                  ? 'Все сотрудники компании' 
                  : 'Сотрудники команды'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeamMembersTable members={displayedMembers} currentUserId={user?.id || ''} diagnosticStageId={selectedStageId} />
          </CardContent>
        </Card>
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

export default TeamPage;
