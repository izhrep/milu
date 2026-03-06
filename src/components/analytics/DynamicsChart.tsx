import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DynamicTrend } from '@/hooks/useHRAnalytics';

interface DynamicsChartProps {
  dynamics: DynamicTrend[];
}

export const DynamicsChart = ({ dynamics }: DynamicsChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика развития компетенций</CardTitle>
      </CardHeader>
      <CardContent>
        {dynamics.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dynamics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[0, 5]} />
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
