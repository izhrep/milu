import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock } from 'lucide-react';

interface Activity {
  id: string;
  user: string;
  action: string;
  time: string;
  type: 'assessment' | 'development' | 'achievement';
}

const mockActivities: Activity[] = [
  {
    id: '1',
    user: 'Иванов И.И.',
    action: 'завершил опрос профессиональных навыков',
    time: '2 часа назад',
    type: 'assessment',
  },
  {
    id: '2',
    user: 'Петров П.П.',
    action: 'получил достижение "Мастер продаж"',
    time: '5 часов назад',
    type: 'achievement',
  },
  {
    id: '3',
    user: 'Сидорова А.С.',
    action: 'обновила план индивидуального развития',
    time: '1 день назад',
    type: 'development',
  },
];

export const RecentActivity = () => {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Последняя активность</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-brand-purple text-white text-sm">
                  {activity.user.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
                  <Clock className="h-3 w-3" />
                  {activity.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
