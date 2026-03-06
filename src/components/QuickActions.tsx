import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ClipboardList, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';

export const QuickActions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { hasPermission: canManageTeam } = usePermission('team.manage');
  const { hasPermission: canManageUsers } = usePermission('users.view');

  const actions = [
    {
      title: 'Команда',
      description: 'Управление командой',
      icon: Users,
      action: () => navigate('/team'),
      color: 'bg-primary',
      show: canManageTeam,
    },
    {
      title: 'Обратная связь 360',
      description: 'Заполнить форму обратной связи',
      icon: ClipboardList,
      action: () => navigate('/questionnaires'),
      color: 'bg-brand-teal',
      show: true,
    },
    {
      title: 'Запланировать встречу',
      description: 'Встреча 1:1 с руководителем',
      icon: Calendar,
      action: () => navigate('/meetings'),
      color: 'bg-brand-navy-light',
      show: true,
    },
    {
      title: 'Админ панель',
      description: 'Управление системой',
      icon: Settings,
      action: () => navigate('/admin'),
      color: 'bg-primary',
      show: canManageUsers,
    },
  ];

  const visibleActions = actions.filter(a => a.show);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleActions.map((action) => (
            <Button
              key={action.title}
              onClick={action.action}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:shadow-sm transition-shadow bg-surface"
            >
              <div className="flex items-center gap-3 w-full">
                <div className={`p-2 rounded-lg ${action.color}`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-foreground">{action.title}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
