import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { GrowthArea } from '@/hooks/useHRAnalytics';
import { Badge } from '@/components/ui/badge';

interface GrowthAreasChartProps {
  growthAreas: GrowthArea[];
}

export const GrowthAreasChart = ({ growthAreas }: GrowthAreasChartProps) => {
  const radarData = growthAreas.slice(0, 8).map(area => ({
    name: area.name.length > 20 ? area.name.substring(0, 17) + '...' : area.name,
    fullName: area.name,
    gap: area.gap,
    affected: area.employees_affected
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Зоны роста (Радар)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis domain={[0, 5]} />
              <Tooltip />
              <Radar 
                name="Разрыв" 
                dataKey="gap" 
                stroke="hsl(var(--destructive))" 
                fill="hsl(var(--destructive))" 
                fillOpacity={0.6} 
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Топ-10 зон роста</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {growthAreas.slice(0, 10).map((area, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{area.name}</span>
                    <Badge variant={area.type === 'skill' ? 'default' : 'secondary'}>
                      {area.type === 'skill' ? 'Навык' : 'Качество'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Затронуто сотрудников: {area.employees_affected}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-destructive">
                    {area.gap.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">разрыв</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
