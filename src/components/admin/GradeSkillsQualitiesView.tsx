import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GradeSkillsQualitiesViewProps {
  gradeId: string;
}

export const GradeSkillsQualitiesView = ({ gradeId }: GradeSkillsQualitiesViewProps) => {
  const { data: gradeSkills } = useQuery({
    queryKey: ['grade_skills', gradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_skills')
        .select('skill_id, target_level, hard_skills(name)')
        .eq('grade_id', gradeId);
      if (error) throw error;
      return data;
    },
  });

  const { data: gradeQualities } = useQuery({
    queryKey: ['grade_qualities', gradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_qualities')
        .select('quality_id, target_level, soft_skills(name)')
        .eq('grade_id', gradeId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Навыки</CardTitle>
        </CardHeader>
        <CardContent>
          {gradeSkills && gradeSkills.length > 0 ? (
            <div className="space-y-2">
              {gradeSkills.map((item: any) => (
                <div key={item.skill_id} className="flex justify-between items-center p-2 border rounded text-sm">
                  <span>{item.skills?.name}</span>
                  <Badge variant="secondary">Уровень: {item.target_level}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Навыки не назначены</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Качества</CardTitle>
        </CardHeader>
        <CardContent>
          {gradeQualities && gradeQualities.length > 0 ? (
            <div className="space-y-2">
              {gradeQualities.map((item: any) => (
                <div key={item.quality_id} className="flex justify-between items-center p-2 border rounded text-sm">
                  <span>{item.qualities?.name}</span>
                  <Badge variant="secondary">Уровень: {item.target_level}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Качества не назначены</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
