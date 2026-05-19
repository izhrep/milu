import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserGradeQualities } from '@/hooks/useUserGradeQualities';
import { Award } from "@/components/icons";

export const QualitiesGradeWidget = () => {
  const { qualities, loading, error } = useUserGradeQualities();

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            Качества
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            Качества
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-md text-muted-foreground">Ошибка загрузки данных</p>
        </CardContent>
      </Card>
    );
  }

  if (qualities.length === 0) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            Качества
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-md text-muted-foreground">
            Качества не назначены для вашего грейда
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-accent" />
          Качества по грейду
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {qualities.map((quality) => {
          const currentLevel = quality.current_level || 0;
          const targetLevel = quality.target_level;
          const progressPercent = (currentLevel / 4) * 100;
          const targetPercent = (targetLevel / 4) * 100;

          return (
            <div key={quality.quality_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-body-md font-medium text-foreground">
                  {quality.quality_name}
                </span>
                <div className="flex items-center gap-2 text-caption-sm text-muted-foreground">
                  <span className={currentLevel ? 'text-accent font-semibold' : ''}>
                    {currentLevel ? currentLevel.toFixed(1) : 'не оценено'}
                  </span>
                  <span>/</span>
                  <span className="font-semibold">{targetLevel.toFixed(1)}</span>
                </div>
              </div>
              <div className="relative">
                <Progress value={progressPercent} className="h-2" />
                <div
                  className="absolute top-0 h-2 w-0.5 bg-accent"
                  style={{ left: `${targetPercent}%` }}
                  title={`Целевой уровень: ${targetLevel}`}
                />
              </div>
              {quality.last_assessed && (
                <p className="text-caption-sm text-muted-foreground">
                  Последняя оценка:{' '}
                  {new Date(quality.last_assessed).toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
