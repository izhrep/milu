import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CompetencyAverage } from '@/hooks/useHRAnalytics';

interface CompetencyChartProps {
  competencies: CompetencyAverage[];
  title?: string;
}

export const CompetencyChart = ({ competencies, title = 'Средние баллы по компетенциям' }: CompetencyChartProps) => {
  // Take top 15 for better visualization
  const topCompetencies = competencies.slice(-15);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topCompetencies} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 5]} />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="average" fill="hsl(var(--primary))" name="Средний балл" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-sm text-muted-foreground mt-4">
          Показаны топ-15 компетенций. Всего оценено: {competencies.length}
        </p>
      </CardContent>
    </Card>
  );
};
