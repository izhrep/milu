import { QuickActions } from '@/components/QuickActions';
import { TaskList } from '@/components/TaskList';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Use permission-based check instead of role-based
  const { hasPermission: canViewTeam } = usePermission('team.view');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Добро пожаловать, {user?.full_name || 'Пользователь'}!
          </h1>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Quick actions and tasks */}
        <div className="lg:col-span-2 space-y-6">
          {canViewTeam && <QuickActions />}
          
          {user && (
            <Card className="border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Мои задачи</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/tasks')}
                  className="text-brand-purple hover:text-brand-purple/80"
                >
                  Все задачи <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <TaskList userId={user.id} />
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right column - Stats */}
        <div className="space-y-6">
          {/* Future widgets can be added here */}
        </div>
      </div>
    </div>
  );
};

export default Index;
