import React from 'react';
import { useUserCareerProgress } from '@/hooks/useUserCareerProgress';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Target, TrendingUp, Calendar, CheckCircle } from "@/components/icons";

export const CareerProgressWidget: React.FC = () => {
  const { user } = useAuth();
  const { progress, loading: progressLoading } = useUserCareerProgress();
  const { profile } = useCompetencyProfile(user?.id);
  const { tracks, loading: tracksLoading } = useCareerTracks(user?.id, profile);

  if (progressLoading || tracksLoading) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Мой карьерный план</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-caption-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Мой карьерный план</h4>
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-body-md mb-2">Карьерный план не выбран</p>
          <p className="text-muted-foreground text-caption-sm">Выберите карьерный трек для начала развития</p>
        </div>
      </div>
    );
  }

  const currentTrack = tracks.find(track => track.id === progress.career_track_id);
  const currentStep = currentTrack?.steps.find(step => step.id === progress.current_step_id);

  if (!currentTrack) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Мой карьерный план</h4>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-caption-sm">Трек не найден</p>
        </div>
      </div>
    );
  }

  const nextStep = currentStep ? 
    currentTrack.steps.find(step => step.step_order === currentStep.step_order + 1) : 
    currentTrack.steps[0];

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-card">
      <h4 className="text-foreground text-body-base font-semibold mb-6">Мой карьерный план</h4>
      
      {/* Информация о треке */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h5 className="text-foreground text-body-lg font-semibold mb-1">{currentTrack.name}</h5>
            <p className="text-muted-foreground text-body-md mb-2">
              {currentTrack.description || 'Описание не указано'}
            </p>
            <div className="flex items-center gap-4 text-caption-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                Цель: {currentTrack.target_position.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {currentTrack.duration_months} мес.
              </span>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="px-3 py-1 bg-warning/10 text-warning text-caption-sm font-medium rounded-full">
              {currentTrack.compatibility_score.toFixed(0)}% совместимость
            </div>
          </div>
        </div>
      </div>

      {/* Текущий и следующий шаг */}
      <div className="space-y-4">
        {/* Текущий шаг */}
        {currentStep && (
          <div className="border border-warning bg-warning/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-warning" />
                <h6 className="text-foreground text-body-md font-medium">
                  Текущий шаг: {currentStep.grade.name}
                </h6>
              </div>
              <div className="px-2 py-1 bg-warning text-white text-caption-sm font-medium rounded-full">
                {currentStep.compatibility_score.toFixed(0)}% готовность
              </div>
            </div>
            <p className="text-muted-foreground text-caption-sm mb-3">
              {currentStep.description || 'Описание не указано'}
            </p>
            
            {/* Прогресс готовности */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-caption-sm text-muted-foreground mb-1">
                <span>Готовность к шагу</span>
                <span>{currentStep.overall_readiness}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-warning transition-all duration-300"
                  style={{ width: `${currentStep.overall_readiness}%` }}
                />
              </div>
            </div>

            {/* Ключевые требования */}
            <div className="grid grid-cols-2 gap-3 text-caption-sm">
              <div>
                <span className="text-muted-foreground font-medium">Hard Skills готовы:</span>
                <span className="ml-1 text-foreground">
                  {currentStep.required_skills.filter(s => s.is_ready).length}/{currentStep.required_skills.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Soft Skills готовы:</span>
                <span className="ml-1 text-foreground">
                  {currentStep.required_qualities.filter(q => q.is_ready).length}/{currentStep.required_qualities.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Следующий шаг */}
        {nextStep && (
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h6 className="text-foreground text-body-md font-medium">
                  Следующий шаг: {nextStep.grade.name}
                </h6>
              </div>
              <div className="px-2 py-1 bg-muted text-muted-foreground text-caption-sm font-medium rounded-full">
                {nextStep.compatibility_score.toFixed(0)}% готовность
              </div>
            </div>
            <p className="text-muted-foreground text-caption-sm mb-3">
              {nextStep.description || 'Описание не указано'}
            </p>
            
            {/* Прогресс готовности к следующему шагу */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-caption-sm text-muted-foreground mb-1">
                <span>Готовность к переходу</span>
                <span>{nextStep.overall_readiness}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    nextStep.overall_readiness >= 80 ? 'bg-success' : 
                    nextStep.overall_readiness >= 60 ? 'bg-warning' : 'bg-destructive'
                  }`}
                  style={{ width: `${nextStep.overall_readiness}%` }}
                />
              </div>
            </div>

            {/* Что нужно подтянуть */}
            <div className="text-caption-sm">
              <span className="text-muted-foreground font-medium">Осталось подтянуть:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {nextStep.required_skills.filter(s => !s.is_ready).slice(0, 3).map(skill => (
                  <span key={skill.skill_id} className="px-2 py-1 bg-destructive/10 text-destructive rounded">
                    {skill.skill_name}
                  </span>
                ))}
                {nextStep.required_qualities.filter(q => !q.is_ready).slice(0, 2).map(quality => (
                  <span key={quality.quality_id} className="px-2 py-1 bg-destructive/10 text-destructive rounded">
                    {quality.quality_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Кнопка действия */}
      <div className="mt-6">
        <button className="w-full px-4 py-3 bg-warning text-white text-body-md font-medium rounded-lg hover:bg-warning/90 transition-colors">
          Создать план развития
        </button>
      </div>
    </div>
  );
};