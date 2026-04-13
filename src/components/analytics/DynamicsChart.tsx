import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DynamicTrend } from '@/hooks/useHRAnalytics';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface DynamicsChartProps {
  dynamics: DynamicTrend[];
  /** Max scale value for Y-axis domain. Defaults to 5 (legacy). */
  maxScale?: number;
  /** If true, shows a warning that cross-stage scales differ */
  mixedScalesWarning?: boolean;
}

export const DynamicsChart = ({ dynamics, maxScale = 5, mixedScalesWarning = false }: DynamicsChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика развития компетенций</CardTitle>
      </CardHeader>
      <CardContent>
        {mixedScalesWarning && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Этапы используют разные шкалы оценки. Прямое сравнение числовых значений может быть некорректным.
            </AlertDescription>
          </Alert>
        )}
        {dynamics.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dynamics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[0, maxScale]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="skill_average" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Навыки" 
              />
              <Line 
                type="monotone" 
                dataKey="quality_average" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Качества" 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            Недостаточно данных для отображения динамики
          </div>
        )}
      </CardContent>
    </Card>
  );
};
