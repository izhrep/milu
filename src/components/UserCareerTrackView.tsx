import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle, ArrowRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface UserCareerTrackViewProps {
  trackId: string;
}

export const UserCareerTrackView: React.FC<UserCareerTrackViewProps> = ({ trackId }) => {
  const { data: trackData, isLoading } = useQuery({
    queryKey: ['career-track-view', trackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_tracks')
        .select(`
          *,
          track_types (
            name,
            description
          ),
          target_positions:positions!career_tracks_target_position_id_fkey (
            name
          )
        `)
        .eq('id', trackId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stepsData } = useQuery({
    queryKey: ['career-track-steps', trackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_track_steps')
        .select(`
          *,
          grades (
            name,
            description,
            key_tasks
          )
        `)
        .eq('career_track_id', trackId)
        .order('step_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ['track-skills', trackId],
    queryFn: async () => {
      if (!stepsData) return [];
      
      const gradeIds = stepsData.map(s => s.grade_id);
      const { data, error } = await supabase
        .from('grade_skills')
        .select(`
          grade_id,
          target_level,
          hard_skills (
            name,
            description
          )
        `)
        .in('grade_id', gradeIds);
      
      if (error) throw error;
      return data;
    },
    enabled: !!stepsData,
  });

  const { data: qualitiesData } = useQuery({
    queryKey: ['track-qualities', trackId],
    queryFn: async () => {
      if (!stepsData) return [];
      
      const gradeIds = stepsData.map(s => s.grade_id);
      const { data, error } = await supabase
        .from('grade_qualities')
        .select(`
          grade_id,
          target_level,
          soft_skills (
            name
          )
        `)
        .in('grade_id', gradeIds);
      
      if (error) throw error;
      return data;
    },
    enabled: !!stepsData,
  });

  if (isLoading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  if (!trackData) {
    return <div className="text-center py-8 text-text-secondary">Трек не найден</div>;
  }

  return (
    <div className="space-y-6">
      {/* Track Header */}
      <Card className="border-0 shadow-card bg-gradient-subtle">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{trackData.name}</CardTitle>
              {trackData.description && (
                <p className="text-text-secondary mt-2">{trackData.description}</p>
              )}
            </div>
            {trackData.track_types && (
              <Badge variant="outline" className="ml-4">
                {trackData.track_types.name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {trackData.target_positions && (
              <div>
                <p className="text-sm text-text-secondary">Целевая должность</p>
                <p className="font-medium">{trackData.target_positions.name}</p>
              </div>
            )}
            {trackData.duration_months && (
              <div>
                <p className="text-sm text-text-secondary">Продолжительность</p>
                <p className="font-medium">{trackData.duration_months} мес.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Этапы карьерного трека</h3>
        {stepsData && stepsData.length > 0 ? (
          <div className="space-y-4">
            {stepsData.map((step, index) => {
              const stepSkills = skillsData?.filter(s => s.grade_id === step.grade_id) || [];
              const stepQualities = qualitiesData?.filter(q => q.grade_id === step.grade_id) || [];

              return (
                <Card key={step.id} className="border-0 shadow-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-purple text-white font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{step.grades?.name}</CardTitle>
                          {step.grades?.description && (
                            <p className="text-sm text-text-secondary mt-1">{step.grades.description}</p>
                          )}
                        </div>
                      </div>
                      {step.duration_months && (
                        <Badge variant="outline">{step.duration_months} мес.</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {step.grades?.key_tasks && (
                      <div>
                        <p className="text-sm font-medium text-text-primary mb-2">Ключевые задачи:</p>
                        <p className="text-sm text-text-secondary">{step.grades.key_tasks}</p>
                      </div>
                    )}

                    {stepSkills.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-text-primary mb-2">Навыки:</p>
                        <div className="flex flex-wrap gap-2">
                          {stepSkills.map((skill, idx) => (
                            <Badge key={idx} variant="secondary">
                              {skill.hard_skills?.name} (уровень {skill.target_level})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {stepQualities.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-text-primary mb-2">Качества:</p>
                        <div className="flex flex-wrap gap-2">
                          {stepQualities.map((quality, idx) => (
                            <Badge key={idx} variant="outline">
                              {quality.soft_skills?.name} (уровень {quality.target_level})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  {index < stepsData.length - 1 && (
                    <div className="flex justify-center pb-4">
                      <ArrowRight className="h-6 w-6 text-text-tertiary" />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-card">
            <CardContent className="pt-6 text-center text-text-secondary">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет этапов для этого трека</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
