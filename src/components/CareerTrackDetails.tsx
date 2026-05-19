import React, { useState } from 'react';
import { Target, Calendar, TrendingUp, CheckCircle, Clock, User, Sparkles } from "@/components/icons";
import { useUserCareerProgress } from '@/hooks/useUserCareerProgress';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { DevelopmentPlanCreator } from '@/components/DevelopmentPlanCreator';
import { toast } from 'sonner';

interface CareerTrackDetailsProps {
  onSelectTrack?: (trackId: string, stepId?: string) => void;
}

export const CareerTrackDetails: React.FC<CareerTrackDetailsProps> = ({ onSelectTrack }) => {
  const { users } = useUsers();
  const { user: authUser } = useAuth();
  const currentUser = users.find(u => u.email === authUser?.email);
  const { progress, loading: progressLoading, selectTrack, refetch: refetchProgress } = useUserCareerProgress();
  const { profile, loading: profileLoading } = useCompetencyProfile(currentUser?.id);
  const { tracks, loading: tracksLoading } = useCareerTracks(currentUser?.id, profile);

  // Debug logging
  console.log('CareerTrackDetails Debug:', {
    currentUser: currentUser?.id,
    progress,
    profileLoading,
    tracksLoading,
    tracksCount: tracks.length,
    profile
  });
  const [planCreatorOpen, setPlanCreatorOpen] = useState(false);

  if (progressLoading || tracksLoading || profileLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chart-3 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Загрузка информации о карьерном треке... 
            {progressLoading && ' (прогресс)'}
            {tracksLoading && ' (треки)'}
            {profileLoading && ' (профиль)'}
          </p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-8 text-center border border-border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-muted-foreground/70" />
          </div>
          <h4 className="text-body-lg font-semibold text-foreground mb-2">Карьерный трек не выбран</h4>
          <p className="text-muted-foreground mb-6">
            Выберите карьерный трек из рекомендованных, чтобы начать планирование развития
          </p>
        </div>
      </div>
    );
  }

  const currentTrack = tracks.find(track => track.id === progress.career_track_id);
  const currentStep = currentTrack?.steps.find(step => step.id === progress.current_step_id);

  if (!currentTrack) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-border">
        <h4 className="text-body-lg font-semibold text-foreground mb-2">Трек не найден</h4>
        <p className="text-muted-foreground">Выбранный карьерный трек больше не доступен</p>
      </div>
    );
  }

  const nextStep = currentStep ? 
    currentTrack.steps.find(step => step.step_order === currentStep.step_order + 1) : 
    currentTrack.steps[0];

  const handleSelectStep = async (stepId: string) => {
    try {
      await selectTrack(progress.career_track_id, stepId);
    } catch (error) {
      console.error('Error selecting step:', error);
    }
  };

  const handleCreatePlan = () => {
    setPlanCreatorOpen(true);
  };

  const getNextStepRequirements = () => {
    if (!nextStep || !profile) return { skills: [], qualities: [] };

    const requiredSkills = nextStep.required_skills?.map(rs => {
      const profileSkill = profile.skills.find(s => s.id === rs.skill_id);
      return {
        id: rs.skill_id,
        name: rs.skill_name || 'Hard Skill',
        current_level: profileSkill?.current_level || 0,
        target_level: rs.target_level,
      };
    }).filter(s => s.current_level < s.target_level) || [];

    const requiredQualities = nextStep.required_qualities?.map(rq => {
      const profileQuality = profile.qualities.find(q => q.id === rq.quality_id);
      return {
        id: rq.quality_id,
        name: rq.quality_name || 'Soft Skill',
        current_level: profileQuality?.current_level || 0,
        target_level: rq.target_level,
      };
    }).filter(q => q.current_level < q.target_level) || [];

    return { skills: requiredSkills, qualities: requiredQualities };
  };

  const { skills: nextStepSkills, qualities: nextStepQualities } = getNextStepRequirements();

  return (
    <div className="space-y-6">
      {/* Информация о выбранном треке */}
      <div className="bg-white rounded-2xl p-6 border border-border">
        <h4 className="text-body-lg font-semibold text-foreground mb-4">Выбранный карьерный трек</h4>
        
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h5 className="text-heading-4 font-bold text-foreground mb-2">{currentTrack.name}</h5>
            <p className="text-muted-foreground mb-4">{currentTrack.description || 'Описание не указано'}</p>
            
            <div className="flex items-center gap-6 text-body-md text-muted-foreground">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Цель: {currentTrack.target_position?.name}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Длительность: {currentTrack.duration_months} мес.
              </span>
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Совместимость: {currentTrack.compatibility_score?.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <h6 className="font-medium text-foreground mb-2">Статистика прогресса</h6>
          <div className="grid grid-cols-3 gap-4 text-body-md">
            <div>
              <span className="text-muted-foreground">Дата выбора:</span>
              <p className="font-medium">{new Date(progress.selected_at).toLocaleDateString('ru-RU')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Статус:</span>
              <p className="font-medium text-success">{progress.status}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Шагов пройдено:</span>
              <p className="font-medium">{currentStep ? currentStep.step_order : 0} из {currentTrack.steps.length}</p>
            </div>
          </div>
          
          {nextStep && (nextStepSkills.length > 0 || nextStepQualities.length > 0) && (
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={handleCreatePlan}
                className="w-full px-4 py-2 bg-gradient-to-r from-chart-3 to-chart-3 text-white text-body-md font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Создать план развития
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Шаги карьерного трека */}
      <div className="bg-white rounded-2xl p-6 border border-border">
        <h4 className="text-body-lg font-semibold text-foreground mb-6">Шаги карьерного трека</h4>
        
        <div className="space-y-4">
          {currentTrack.steps.map((step, index) => {
            const isActive = step.id === progress.current_step_id;
            const isCompleted = currentStep && step.step_order < currentStep.step_order;
            const isNext = !currentStep && index === 0 || (currentStep && step.step_order === currentStep.step_order + 1);
            
            return (
              <div
                key={step.id}
                className={`border rounded-lg p-4 transition-all ${
                  isActive 
                    ? 'border-chart-3/40 bg-chart-3/10' 
                    : isCompleted 
                    ? 'border-success/40 bg-success/10' 
                    : isNext 
                    ? 'border-primary/40 bg-primary/10' 
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive 
                        ? 'bg-chart-3 text-white' 
                        : isCompleted 
                        ? 'bg-success text-white' 
                        : isNext 
                        ? 'bg-primary text-white' 
                        : 'bg-border text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span className="text-body-md font-bold">{step.step_order}</span>
                      )}
                    </div>
                    <div>
                      <h6 className="font-semibold text-foreground">{step.grade.name}</h6>
                      <p className="text-body-md text-muted-foreground">{step.description || 'Описание не указано'}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {step.compatibility_score !== undefined && (
                      <div className="text-body-md text-muted-foreground mb-1">
                        Готовность: {step.compatibility_score.toFixed(0)}%
                      </div>
                    )}
                    {step.duration_months && (
                      <div className="flex items-center gap-1 text-caption-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {step.duration_months} мес.
                      </div>
                    )}
                  </div>
                </div>

                {/* Требования шага */}
                {(step.required_skills?.length > 0 || step.required_qualities?.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {step.required_skills?.length > 0 && (
                      <div>
                        <h6 className="text-body-md font-medium text-foreground mb-2 block">Требуемые Hard Skills:</h6>
                        <div className="flex flex-wrap gap-2">
                          {step.required_skills.map((skill) => (
                            <span
                              key={skill.skill_id}
                              className={`px-2 py-1 text-caption-sm rounded-full ${
                                skill.is_ready 
                                  ? 'bg-success/20 text-success' 
                                  : 'bg-destructive/20 text-destructive'
                              }`}
                            >
                              {skill.skill_name} (ур. {skill.target_level})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {step.required_qualities?.length > 0 && (
                      <div>
                        <h6 className="text-body-md font-medium text-foreground mb-2 block">Требуемые Soft Skills:</h6>
                        <div className="flex flex-wrap gap-2">
                          {step.required_qualities.map((quality) => (
                            <span
                              key={quality.quality_id}
                              className={`px-2 py-1 text-caption-sm rounded-full ${
                                quality.is_ready 
                                  ? 'bg-success/20 text-success' 
                                  : 'bg-destructive/20 text-destructive'
                              }`}
                            >
                              {quality.quality_name} (ур. {quality.target_level})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Кнопка для выбора шага */}
                {isNext && !isActive && (
                  <div className="mt-4">
                    <button
                      onClick={() => handleSelectStep(step.id)}
                      className="w-full px-4 py-2 bg-primary text-white text-body-md font-medium rounded-lg hover:bg-primary transition-colors"
                    >
                      Перейти к этому шагу
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* История движения по шагам */}
      <div className="bg-white rounded-2xl p-6 border border-border">
        <h4 className="text-body-lg font-semibold text-foreground mb-4">История движения по шагам</h4>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 bg-chart-3/20 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-chart-3" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Выбрал карьерный трек: {currentTrack.name}</p>
              <p className="text-body-md text-muted-foreground">{new Date(progress.selected_at).toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
          
          {currentStep && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Текущий шаг: {currentStep.grade.name}</p>
                <p className="text-body-md text-muted-foreground">Готовность: {currentStep.compatibility_score?.toFixed(0)}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <DevelopmentPlanCreator
        open={planCreatorOpen}
        onOpenChange={setPlanCreatorOpen}
        trackName={currentTrack.name}
        stepName={nextStep?.grade.name || 'Следующий шаг'}
        trackId={currentTrack.id}
        stepId={nextStep?.id}
        skills={nextStepSkills}
        qualities={nextStepQualities}
        onPlanCreated={() => {
          toast.success('План развития создан!');
        }}
      />
    </div>
  );
};