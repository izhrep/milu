import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HorizontalBarChart, BarChartDataItem } from '@/components/HorizontalBarChart';
import { getScoreColor } from '@/lib/scoreLabels';

interface CategoryAggregationProps {
  /** Max score for hard skills chart. Defaults to 4 (legacy). */
  hardMaxScore?: number;
  /** Max score for soft skills chart. Defaults to 5 (legacy). */
  softMaxScore?: number;
  skillResults: Array<{
    competency_id: string;
    competency_name: string;
    category_name?: string;
    data: {
      self_assessment: number | null;
      manager_assessment: number | null;
      peers_average: number | null;
      all_average: number | null;
    };
  }>;
  qualityResults: Array<{
    competency_id: string;
    competency_name: string;
    data: {
      self_assessment: number | null;
      manager_assessment: number | null;
      peers_average: number | null;
      all_average: number | null;
    };
  }>;
  roleFilter: string;
}

export const CategoryAggregation = ({ 
  skillResults, 
  qualityResults,
  roleFilter,
  hardMaxScore = 4,
  softMaxScore = 5,
}: CategoryAggregationProps) => {
  
  // Агрегация по категориям навыков
  const aggregateSkillsByCategory = () => {
    const categoryMap = new Map<string, number[]>();
    
    skillResults.forEach(skill => {
      const categoryName = skill.category_name || 'Без категории';
      let value: number | null = null;
      
      switch (roleFilter) {
        case 'self':
          value = skill.data.self_assessment;
          break;
        case 'manager':
          value = skill.data.manager_assessment;
          break;
        case 'peers':
          value = skill.data.peers_average;
          break;
        case 'all':
        case 'all_average':
          value = skill.data.all_average;
          break;
        default:
          value = skill.data.all_average;
      }
      
      if (value !== null && value > 0) {
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, []);
        }
        categoryMap.get(categoryName)!.push(value);
      }
    });
    
    const result: BarChartDataItem[] = [];
    categoryMap.forEach((values, categoryName) => {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      result.push({
        label: categoryName,
        value: average,
        color: getScoreColor(average, hardMaxScore) === 'text-red-600' ? 'hsl(var(--destructive))' :
               getScoreColor(average, hardMaxScore) === 'text-orange-600' ? 'hsl(24, 90%, 50%)' :
               getScoreColor(average, hardMaxScore) === 'text-yellow-600' ? 'hsl(45, 90%, 50%)' :
               getScoreColor(average, hardMaxScore) === 'text-green-600' ? 'hsl(142, 70%, 45%)' :
               'hsl(var(--primary))',
      });
    });
    
    return result.sort((a, b) => b.value - a.value);
  };
  
  // Агрегация качеств (все качества в одну группу или можно группировать по первому слову)
  const aggregateQualities = () => {
    if (qualityResults.length === 0) return null;
    
    const values: number[] = [];
    
    qualityResults.forEach(quality => {
      let value: number | null = null;
      
      switch (roleFilter) {
        case 'self':
          value = quality.data.self_assessment;
          break;
        case 'manager':
          value = quality.data.manager_assessment;
          break;
        case 'peers':
          value = quality.data.peers_average;
          break;
        case 'all':
        case 'all_average':
          value = quality.data.all_average;
          break;
        default:
          value = quality.data.all_average;
      }
      
      if (value !== null && value > 0) {
        values.push(value);
      }
    });
    
    if (values.length === 0) return null;
    
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    
    return [{
      label: 'Soft Skills (все качества)',
      value: average,
      color: getScoreColor(average, softMaxScore) === 'text-red-600' ? 'hsl(var(--destructive))' :
             getScoreColor(average, softMaxScore) === 'text-orange-600' ? 'hsl(24, 90%, 50%)' :
             getScoreColor(average, softMaxScore) === 'text-yellow-600' ? 'hsl(45, 90%, 50%)' :
             getScoreColor(average, softMaxScore) === 'text-green-600' ? 'hsl(142, 70%, 45%)' :
             'hsl(var(--primary))',
    }];
  };
  
  const skillCategoryData = aggregateSkillsByCategory();
  const qualityAggregateData = aggregateQualities();
  
  const roleLabels: Record<string, string> = {
    all: 'Все',
    self: 'Самооценка',
    manager: 'Руководитель',
    peers: 'Коллеги',
    all_except_self: 'Все кроме фидбека сотрудника',
    all_average: 'Все (средняя)',
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Категории навыков */}
          {skillCategoryData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold my-3 text-foreground">
                Hard Skills по категориям
              </h3>
              <HorizontalBarChart
                data={skillCategoryData}
                maxValue={hardMaxScore}
              />
            </div>
          )}
          
          {/* Агрегация качеств */}
          {qualityAggregateData && qualityAggregateData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold my-3 text-foreground">
                Soft Skills (общая оценка)
              </h3>
              <HorizontalBarChart
                data={qualityAggregateData}
                maxValue={softMaxScore}
              />
            </div>
          )}
          
          {skillCategoryData.length === 0 && (!qualityAggregateData || qualityAggregateData.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет данных для отображения агрегации
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
