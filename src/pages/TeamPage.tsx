import { useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { TEAM_PROFILES_MVP_ENABLED, TEAM_MAP_DEV_ENABLED } from '@/lib/featureFlags';
import TeamDashboardTab from '@/components/team-profiles/TeamDashboardTab';
import TeamProfilesTab from '@/components/team-profiles/TeamProfilesTab';
import TeamMapTab from '@/components/team-profiles/TeamMapTab';
import EmployeeCard from '@/components/team-profiles/EmployeeCard';

const PROFILES_ROLES = ['admin', 'hr_bp'];
const MAP_ROLES = ['admin', 'hr_bp'];

const TeamPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canSeeProfiles = TEAM_PROFILES_MVP_ENABLED && PROFILES_ROLES.includes(user?.role || '');
  const canSeeMap = TEAM_MAP_DEV_ENABLED && MAP_ROLES.includes(user?.role || '');

  // Employee card mode
  const employeeId = searchParams.get('employee');
  const employeeName = searchParams.get('ename') || 'Сотрудник';
  const employeePosition = searchParams.get('epos') || '';
  const fromMap = searchParams.get('from') === 'map';

  const rawTab = searchParams.get('tab') || 'dashboard';
  const activeTab =
    rawTab === 'team-map' && canSeeMap ? 'team-map' :
    rawTab === 'profiles' && canSeeProfiles ? 'profiles' :
    'dashboard';

  const selectedUserId = searchParams.get('user') || null;

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  };

  const handleSelectUser = (id: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'profiles');
    if (id) params.set('user', id);
    else params.delete('user');
    setSearchParams(params, { replace: true });
  };

  const handleSelectEmployee = (emp: { id: string; name: string; position: string }) => {
    const params = new URLSearchParams();
    params.set('employee', emp.id);
    params.set('ename', emp.name);
    params.set('epos', emp.position);
    params.set('from', 'map');
    setSearchParams(params, { replace: true });
  };

  const handleBackFromEmployee = () => {
    const params = new URLSearchParams();
    if (fromMap && canSeeMap) {
      params.set('tab', 'team-map');
    }
    setSearchParams(params, { replace: true });
  };

  // Employee card view
  if (employeeId) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <EmployeeCard
          employee={{ id: employeeId, name: employeeName, position: employeePosition }}
          onBack={handleBackFromEmployee}
          fromMap={fromMap}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Моя команда</h1>
          <p className="text-muted-foreground mt-1">Управление и развитие вашей команды</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="dashboard">Дашборд команды</TabsTrigger>
          {canSeeMap && <TabsTrigger value="team-map">Карта команды</TabsTrigger>}
          {canSeeProfiles && <TabsTrigger value="profiles">Профили команды</TabsTrigger>}
        </TabsList>
        <TabsContent value="dashboard">
          <TeamDashboardTab />
        </TabsContent>
        {canSeeMap && (
          <TabsContent value="team-map">
            <TeamMapTab onSelectEmployee={handleSelectEmployee} />
          </TabsContent>
        )}
        {canSeeProfiles && (
          <TabsContent value="profiles">
            <TeamProfilesTab selectedUserId={selectedUserId} onSelectUser={handleSelectUser} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TeamPage;
