import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { useUserSkills } from '@/hooks/useUserSkills';
import { useUserQualities } from '@/hooks/useUserQualities';
import { useAuth } from '@/contexts/AuthContext';

export const DashboardStats = () => {
  const { user } = useAuth();
  const { skills } = useUserSkills();
  const { qualities } = useUserQualities();

  const stats = [
    {
      title: 'Hard Skills',
      value: skills.length || 0,
      icon: TrendingUp,
      gradient: 'bg-gradient-purple',
    },
    {
      title: 'Soft Skills',
      value: qualities.length || 0,
      icon: Trophy,
      gradient: 'bg-gradient-teal',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-0 shadow-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary flex items-center justify-between">
              {stat.title}
              <div className={`p-2 rounded-lg ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-text-primary">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
