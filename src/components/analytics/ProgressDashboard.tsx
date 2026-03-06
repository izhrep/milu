import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DiagnosticProgress } from '@/hooks/useHRAnalytics';
import { Users, CheckCircle, TrendingUp } from 'lucide-react';

interface ProgressDashboardProps {
  progress: DiagnosticProgress | null;
}

export const ProgressDashboard = ({ progress }: ProgressDashboardProps) => {
  if (!progress) return null;

  const skillPercentage = progress.total_participants > 0 
    ? Math.round((progress.completed_skill / progress.total_participants) * 100)
    : 0;

  const quality360Percentage = progress.total_participants > 0
    ? Math.round((progress.completed_360 / progress.total_participants) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Участники</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.total_participants}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Всего в диагностике
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Навыки</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.completed_skill}</div>
          <Progress value={skillPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {skillPercentage}% завершено
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">360°</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.completed_360}</div>
          <Progress value={quality360Percentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {quality360Percentage}% завершено
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
