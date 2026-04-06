import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { TEAM_PROFILES_MVP_ENABLED } from '@/lib/featureFlags';
import TeamDashboardTab from '@/components/team-profiles/TeamDashboardTab';
import TeamProfilesTab from '@/components/team-profiles/TeamProfilesTab';

const PROFILES_ROLES = ['admin', 'hr_bp'];

const TeamPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canSeeProfiles = TEAM_PROFILES_MVP_ENABLED && PROFILES_ROLES.includes(user?.role || '');

  const rawTab = searchParams.get('tab') || 'dashboard';
  const activeTab = (rawTab === 'profiles' && canSeeProfiles) ? 'profiles' : 'dashboard';
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Моя команда</h1>
          <p className="text-text-secondary mt-1">Управление и развитие вашей команды</p>
        </div>
      </div>

      {canSeeProfiles ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="dashboard">Дашборд команды</TabsTrigger>
            <TabsTrigger value="profiles">Профили команды</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <TeamDashboardTab />
          </TabsContent>
          <TabsContent value="profiles">
            <TeamProfilesTab selectedUserId={selectedUserId} onSelectUser={handleSelectUser} />
          </TabsContent>
        </Tabs>
      ) : (
        <TeamDashboardTab />
      )}
    </div>
  );
};

export default TeamPage;
